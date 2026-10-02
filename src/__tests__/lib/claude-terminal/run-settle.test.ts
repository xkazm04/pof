/**
 * ONE SETTLEMENT FOR A SERVER-SIDE CLI RUN.
 *
 * The server had three hand-rolled spawn-and-wait copies (awaitCallback, batch-review's
 * waitForExecution, deep-eval's cliExecutor), each with its own clocks and failure words.
 * `awaitCallback` never settled a run that ended cleanly without a callback: it waited the
 * full 5-minute window, then taskkilled the already-exited PID and overwrote `completed`
 * with `aborted`. `settleExecution` settles the moment the run ends, with a closed reason
 * vocabulary: no-callback | timeout | cancelled | exit-nonzero | error-result |
 * spawn-error | not-found.
 *
 * The clock is faked and NEVER advanced in the end-of-run cases, so a build that only
 * gives up on a timer cannot pass them.
 *
 * scan-sweep --challenge run challenge-2026-09-29b, card ai-developer-tools-api/A.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { killSpy, spawnMock } = vi.hoisted(() => ({ killSpy: vi.fn(), spawnMock: vi.fn() }));

vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: (p: unknown) => killSpy(p) }));
vi.mock('@/lib/cli-spend-db', () => ({ recordSpend: vi.fn() }));
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const spawn = (...a: unknown[]) => spawnMock(...a);
  return { ...actual, default: { ...actual, spawn }, spawn };
});

type FakeChild = EventEmitter & {
  pid: number; killed: boolean;
  stdout: EventEmitter; stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
};

function fakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild;
  proc.pid = 4242;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.kill = vi.fn();
  return proc;
}

import { startExecution, getExecution } from '@/lib/claude-terminal/cli-service';
import { settleExecution } from '@/lib/claude-terminal/run-settle';
import { startDeepEvalJob, cancelDeepEvalJob } from '@/lib/evaluator/deep-eval-job';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-run-settle-'));

const assistantLine = (text: string) => JSON.stringify({
  type: 'assistant',
  message: { id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text }], model: 'x', stop_reason: 'end_turn' },
}) + '\n';
const resultLine = (isError: boolean) =>
  JSON.stringify({ type: 'result', is_error: isError, total_cost_usd: 0, duration_ms: 10, session_id: 's' }) + '\n';
const MARKER = '@@CALLBACK:cb-1\n{"done": true}\n@@END_CALLBACK';

/** Start a run on a fresh fake child and hand both back. */
function start(): { id: string; proc: FakeChild } {
  const id = startExecution(TMP, 'p', undefined, undefined, {});
  const proc = spawnMock.mock.results[spawnMock.mock.results.length - 1].value as FakeChild;
  return { id, proc };
}

beforeEach(() => {
  killSpy.mockClear();
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => fakeChild());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('settleExecution — the run ends, the wait ends', () => {
  it('case 1: a clean-ended run with no callback settles no-callback at once, kills nothing, stays completed', async () => {
    const { id, proc } = start();
    const settling = settleExecution(id, { expect: 'callback', timeoutMs: 60000 });

    proc.stdout.emit('data', Buffer.from(assistantLine('I did the work but forgot the marker.')));
    proc.stdout.emit('data', Buffer.from(resultLine(false)));
    proc.emit('close', 0);

    expect(await settling).toMatchObject({ ok: false, error: { reason: 'no-callback' } });
    expect(killSpy).not.toHaveBeenCalled();
    expect(getExecution(id)?.status).toBe('completed');
  });

  it('a callback marker settles ok with the parsed marker', async () => {
    const { id, proc } = start();
    const settling = settleExecution(id, { expect: 'callback', timeoutMs: 60000 });
    proc.stdout.emit('data', Buffer.from(assistantLine(MARKER)));
    const r = await settling;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.callback).toMatchObject({ callbackId: 'cb-1', data: { done: true } });
  });

  it('[guard] case 3: a run that never emits times out, is killed once and marked aborted', async () => {
    const { id } = start();
    const settling = settleExecution(id, { expect: 'callback', timeoutMs: 5 });
    vi.advanceTimersByTime(5);

    expect(await settling).toMatchObject({ ok: false, error: { reason: 'timeout' } });
    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(getExecution(id)?.status).toBe('aborted');
  });

  it('case 4: cancelling via the signal kills once, marks aborted, and a late callback changes nothing', async () => {
    const { id, proc } = start();
    const controller = new AbortController();
    const settling = settleExecution(id, { expect: 'callback', signal: controller.signal });

    controller.abort();
    proc.stdout.emit('data', Buffer.from(assistantLine(MARKER)));

    expect(await settling).toMatchObject({ ok: false, error: { reason: 'cancelled' } });
    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(getExecution(id)?.aborted).toBe(true);
    // The seam let go of the run: nothing it left behind can act on a late event.
    expect(getExecution(id)?.listeners.size).toBe(0);
  });

  it('case 5a: expect end — a non-zero exit is exit-nonzero naming the code', async () => {
    const { id, proc } = start();
    const settling = settleExecution(id, { expect: 'end' });
    proc.emit('close', 1);
    const r = await settling;
    expect(r).toMatchObject({ ok: false, error: { reason: 'exit-nonzero' } });
    if (!r.ok) expect(r.error.message).toMatch(/code 1/);
  });

  it('case 5b: expect end — result{isError:true} is error-result', async () => {
    const { id, proc } = start();
    const settling = settleExecution(id, { expect: 'end' });
    proc.stdout.emit('data', Buffer.from(resultLine(true)));
    expect(await settling).toMatchObject({ ok: false, error: { reason: 'error-result' } });
  });

  it('case 5c: expect end — a clean exit with text and no result event resolves the concatenated text', async () => {
    const { id, proc } = start();
    const settling = settleExecution(id, { expect: 'end' });
    proc.stdout.emit('data', Buffer.from(assistantLine('alpha')));
    proc.stdout.emit('data', Buffer.from(assistantLine('beta')));
    proc.emit('close', 0);
    const r = await settling;
    expect(r).toMatchObject({ ok: true, data: { text: 'alphabeta' } });
  });

  it('case 5d: a spawn that failed synchronously settles spawn-error at once — read at subscribe time, no hang', async () => {
    spawnMock.mockImplementationOnce(() => { throw new Error('spawn claude.cmd ENOENT'); });
    const id = startExecution(TMP, 'p', undefined, undefined, {});
    expect(getExecution(id)?.status).toBe('error');

    const r = await settleExecution(id, { expect: 'end' });
    expect(r).toMatchObject({ ok: false, error: { reason: 'spawn-error' } });
    if (!r.ok) expect(r.error.message).toMatch(/ENOENT/);
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('an unknown execution id is not-found', async () => {
    expect(await settleExecution('exec-nope', { expect: 'end' })).toMatchObject({ ok: false, error: { reason: 'not-found' } });
  });
});

/** Let the fake children's scripted setImmediate emissions and the engine's awaits run. */
async function drain(rounds = 50): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
}

const ctx = (projectPath: string) => ({ projectName: 'PoF', projectPath, ueVersion: '5.5' });

describe('[guard] case 8: deep-eval passes settle through the seam', () => {
  it('a clean exit with text resolves the text; result{isError:true} rejects the pass', async () => {
    let n = 0;
    spawnMock.mockImplementation(() => {
      const proc = fakeChild();
      const isErrorRun = ++n === 1;
      setImmediate(() => {
        if (isErrorRun) { proc.stdout.emit('data', Buffer.from(resultLine(true))); proc.emit('close', 1); return; }
        proc.stdout.emit('data', Buffer.from(assistantLine('[]')));
        proc.emit('close', 0);
      });
      return proc;
    });

    const started = startDeepEvalJob({ projectPath: TMP, moduleIds: ['audio'], projectContext: ctx(TMP) });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const result = await started.data.done;

    expect(n).toBe(4);
    // One pass failed with the typed reason; the other three parsed '[]' as clean.
    const errors = Object.values(result.passErrors.audio ?? {});
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/error-result/);
    expect(Object.values(result.passStatuses.audio).filter((s) => s === 'done')).toHaveLength(3);
  });

  it('cancelling the job kills every in-flight execution', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-run-settle-cancel-'));
    const started = startDeepEvalJob({ projectPath, moduleIds: ['audio'], projectContext: ctx(projectPath) });
    expect(started.ok).toBe(true);
    await drain(5);
    expect(spawnMock).toHaveBeenCalledTimes(4);

    const snap = await cancelDeepEvalJob(projectPath);
    expect(snap?.status).toBe('cancelled');
    expect(killSpy).toHaveBeenCalledTimes(4);
    for (const r of spawnMock.mock.results) expect(killSpy).toHaveBeenCalledWith(r.value);
  });
});
