import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Hoisted spies (vi.mock factories run before imports).
const { recordSpend, spawn } = vi.hoisted(() => ({ recordSpend: vi.fn(), spawn: vi.fn() }));

// Record spend into a spy instead of the real SQLite DB.
vi.mock('@/lib/cli-spend-db', () => ({ recordSpend: (...a: unknown[]) => recordSpend(...a) }));
// Never let an abort spawn a real taskkill in the test.
vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: vi.fn() }));
// Intercept spawn (both named + default) — cli-service uses the named import.
vi.mock('child_process', () => {
  const spawnFn = (...a: unknown[]) => spawn(...a);
  return { spawn: spawnFn, default: { spawn: spawnFn } };
});

// Fake ChildProcess whose streams we drive by hand.
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
  proc.pid = 4242;
  return proc;
}

import { startExecution, abortExecution } from '@/lib/claude-terminal/cli-service';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-spend-'));

function resultLine(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'result', is_error: false, total_cost_usd: 0.42, duration_ms: 1234,
    usage: { input_tokens: 10, output_tokens: 5 }, session_id: 's1', ...over,
  }) + '\n';
}

describe('cli-service — server-side spend recording', () => {
  beforeEach(() => {
    recordSpend.mockClear();
    spawn.mockReset();
    spawn.mockImplementation(() => makeFakeProc());
  });
  afterEach(() => { vi.clearAllTimers(); });

  it('autonomous spawn: records a completed row with the passed attribution + metrics', () => {
    const id = startExecution(TMP, 'p', undefined, undefined, {
      attribution: { moduleId: 'bestiary', taskType: 'one-shot-propose', taskLabel: 'Propose bestiary' },
    });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;

    proc.stdout.emit('data', Buffer.from(resultLine()));
    proc.emit('close', 0);

    expect(id).toMatch(/^exec-/);
    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'bestiary', taskType: 'one-shot-propose', taskLabel: 'Propose bestiary',
      status: 'completed', success: true, costUsd: 0.42, tokensIn: 10, tokensOut: 5, durationMs: 1234,
    }));
  });

  it('failure: a non-zero exit with no result records a failed, zero-cost row', () => {
    startExecution(TMP, 'p', undefined, undefined, { attribution: { taskType: 'checklist' } });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;

    proc.emit('close', 1);

    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'checklist', status: 'failed', success: false, costUsd: 0,
    }));
  });

  it('no double-count: a result followed by an error exit records exactly once', () => {
    startExecution(TMP, 'p', undefined, undefined, { attribution: { taskType: 'interactive' } });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;

    proc.stdout.emit('data', Buffer.from(resultLine()));
    proc.emit('close', 1); // late error after a clean result — must not re-record

    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(recordSpend.mock.calls[0][0]).toMatchObject({ status: 'completed' });
  });

  it('aborted: an aborted run records an aborted row', () => {
    const id = startExecution(TMP, 'p', undefined, undefined, { attribution: { taskType: 'module-scan' } });
    const proc = spawn.mock.results[0].value as ReturnType<typeof makeFakeProc>;

    abortExecution(id);
    proc.emit('close', 1); // the kill triggers a non-zero close

    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledWith(expect.objectContaining({ status: 'aborted', success: false }));
  });
});
