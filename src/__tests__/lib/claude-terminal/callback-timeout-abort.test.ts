/**
 * A CALLBACK TIMEOUT MUST KILL THE SESSION IT STOPPED WAITING FOR.
 *
 * `awaitCallback` used to `reject()` on timeout and nothing else: the spawned Claude
 * process kept running, kept editing files and kept billing tokens, with no operator
 * affordance anywhere pointing at it. The caller (`POST /api/one-shot/step`) then reported
 * a failure and the Produce panel offered "Retry with same prompt" — so the orphan was
 * about to be joined by a SECOND billed session doing the same work.
 *
 * The abort is asserted through what it observably does — the process tree is killed and
 * the execution is marked `aborted` (which is what stamps the spend row) — rather than by
 * spying on the module's own internal call. Criterion over instruction: this proves the
 * process is actually dead, which a call-count on `abortExecution` would not.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const killSpy = vi.fn();

vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: (p: unknown) => killSpy(p) }));
vi.mock('@/lib/cli-spend-db', () => ({ recordSpend: vi.fn() }));

/** A child process stand-in that never emits anything — the orphan case, exactly. */
function fakeChild() {
  const proc = new EventEmitter() as EventEmitter & Record<string, unknown>;
  proc.pid = 4242;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.kill = vi.fn();
  return proc;
}

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  // BOTH the named and the default export: cli-service's named import resolves through
  // `default` here, so a default of `actual` spawned the REAL claude CLI in this test.
  const spawn = vi.fn(() => fakeChild());
  return { ...actual, default: { ...actual, spawn }, spawn };
});

import { spawn } from 'child_process';
import { startExecution, awaitCallback, getExecution } from '@/lib/claude-terminal/cli-service';

describe('awaitCallback — timeout aborts the execution before rejecting', () => {
  beforeEach(() => { killSpy.mockClear(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('kills the process tree and marks the execution aborted', async () => {
    const id = startExecution(process.cwd(), 'produce something', undefined, undefined, {});

    await expect(awaitCallback(id, { timeoutMs: 5 })).rejects.toThrow(/callback timeout/);

    // The session that was still running (and billing) is gone…
    expect(killSpy).toHaveBeenCalledTimes(1);
    // …and the execution says so, which is what stamps its spend row `aborted`.
    expect(getExecution(id)?.status).toBe('aborted');
    expect(getExecution(id)?.aborted).toBe(true);
  });

  it('says in the rejection that the execution was aborted, so the caller reports the whole truth', async () => {
    const id = startExecution(process.cwd(), 'produce something', undefined, undefined, {});
    await expect(awaitCallback(id, { timeoutMs: 5 })).rejects.toThrow(/execution aborted/);
  });
});

/**
 * A RUN THAT ENDED IS NOT WAITED ON (challenge-2026-09-29b, ai-developer-tools-api/A).
 * A clean end with no @@CALLBACK used to hold awaitCallback for the full window, then
 * taskkill the exited PID and flip `completed` to `aborted`. The clock is faked and never
 * advanced: only settling on the end itself can pass.
 */
describe('awaitCallback — a clean end without a callback rejects at once', () => {
  beforeEach(() => {
    killSpy.mockClear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('case 2: rejects "ended without a callback", kills nothing, and the execution stays completed', async () => {
    const id = startExecution(process.cwd(), 'produce something', undefined, undefined, {});
    const results = vi.mocked(spawn).mock.results;
    const proc = results[results.length - 1].value as ReturnType<typeof fakeChild> & { stdout: EventEmitter };
    const waiting = awaitCallback(id, { timeoutMs: 60000 });

    proc.stdout.emit('data', Buffer.from(JSON.stringify({
      type: 'assistant',
      message: { id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done, no marker' }], model: 'x', stop_reason: 'end_turn' },
    }) + '\n'));
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', is_error: false, session_id: 's' }) + '\n'));
    proc.emit('close', 0);

    await expect(waiting).rejects.toThrow(/ended without a callback/);
    expect(killSpy).not.toHaveBeenCalled();
    expect(getExecution(id)?.status).toBe('completed');
  });
});
