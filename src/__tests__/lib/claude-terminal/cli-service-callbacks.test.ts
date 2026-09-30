import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// scan-sweep --challenge cli-terminal-system/A — the execution that owns a run
// settles its declared @@CALLBACKs (never a real Claude spawn: spawn is mocked).

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('@/lib/cli-spend-db', () => ({ recordSpend: vi.fn() }));
vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: vi.fn() }));
vi.mock('child_process', () => {
  const spawnFn = (...a: unknown[]) => spawn(...a);
  return { spawn: spawnFn, default: { spawn: spawnFn } };
});

function makeFakeProc() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter; stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    killed: boolean; kill: ReturnType<typeof vi.fn>; pid: number;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.killed = false;
  proc.kill = vi.fn();
  proc.pid = 4243;
  return proc;
}

import { startExecution, getExecutionStatus, type CLIExecutionEvent } from '@/lib/claude-terminal/cli-service';
import type { TaskCallback } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-cb-settle-'));
const ORIGIN = getAppOrigin(); // the server's own origin (what an absent appOrigin falls back to)
const CB1: TaskCallback = {
  id: 'cb-1', url: `${ORIGIN}/api/checklist/complete`, method: 'POST', staticFields: { moduleId: 'm' }, schemaHint: '',
};

function assistantLine(text: string) {
  return JSON.stringify({ type: 'assistant', message: { id: 'a', type: 'message', role: 'assistant', content: [{ type: 'text', text }], model: 'x', stop_reason: 'end' } }) + '\n';
}
const RESULT_LINE = JSON.stringify({ type: 'result', is_error: false, session_id: 's1' }) + '\n';

async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('cli-service — server-side callback settlement', () => {
  const fetchMock = vi.fn();
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    spawn.mockReset();
    spawn.mockImplementation(() => makeFakeProc());
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ json: async () => ({ success: true, data: {} }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('a run declaring cb-1 POSTs it once on end, emits a callbacks event and records callbackStatus', async () => {
    const events: CLIExecutionEvent[] = [];
    const id = startExecution(TMP, 'p', undefined, (e) => events.push(e), { callbacks: [CB1], appOrigin: ORIGIN });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;

    proc.stdout.emit('data', Buffer.from(assistantLine('done\n@@CALLBACK:cb-1\n{"completed":true}\n@@END_CALLBACK')));
    proc.stdout.emit('data', Buffer.from(RESULT_LINE));
    proc.emit('close', 0);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(CB1.url);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ completed: true, moduleId: 'm' });
    const cbEvents = events.filter((e) => (e.type as string) === 'callbacks');
    expect(cbEvents).toHaveLength(1);
    expect(cbEvents[0].data).toMatchObject({ status: 'confirmed' });
    expect(getExecutionStatus(id)?.callbackStatus).toBe('confirmed');
  });

  it('without appOrigin the settlement resolves against the server origin', async () => {
    startExecution(TMP, 'p', undefined, undefined, { callbacks: [CB1] });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;
    proc.stdout.emit('data', Buffer.from(assistantLine('@@CALLBACK:cb-1\n{"completed":true}\n@@END_CALLBACK')));
    proc.stdout.emit('data', Buffer.from(RESULT_LINE));
    proc.emit('close', 0);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(CB1.url);
  });

  it('declared callbacks but no marker -> missing, no POST', async () => {
    const id = startExecution(TMP, 'p', undefined, undefined, { callbacks: [CB1], appOrigin: ORIGIN });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;
    proc.stdout.emit('data', Buffer.from(assistantLine('no marker here')));
    proc.stdout.emit('data', Buffer.from(RESULT_LINE));
    proc.emit('close', 0);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getExecutionStatus(id)?.callbackStatus).toBe('missing');
  });

  it('[guard] a run declaring no callbacks never POSTs and emits no callbacks event', async () => {
    const events: CLIExecutionEvent[] = [];
    const id = startExecution(TMP, 'p', undefined, (e) => events.push(e));
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;
    proc.stdout.emit('data', Buffer.from(assistantLine('@@CALLBACK:cb-1\n{"completed":true}\n@@END_CALLBACK')));
    proc.stdout.emit('data', Buffer.from(RESULT_LINE));
    proc.emit('close', 0);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events.some((e) => (e.type as string) === 'callbacks')).toBe(false);
    expect(getExecutionStatus(id)?.callbackStatus ?? null).toBeNull();
  });
});
