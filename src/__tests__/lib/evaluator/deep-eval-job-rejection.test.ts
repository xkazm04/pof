/**
 * scan-sweep night 2026-11-08 (module-evaluator): a deep-eval run whose engine promise
 * REJECTS must settle its job as `error`. Before, the job's `.then` had no rejection
 * branch: the snapshot stayed `running` forever, every later start for that project
 * answered `already-running` (409) until the process restarted, and the route's
 * `void done` left the rejection unhandled.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn(() => 'exec-unused'),
  abortExecution: vi.fn(() => true),
  getExecution: vi.fn(() => undefined),
}));

vi.mock('@/lib/evaluator/deep-eval-engine', () => ({
  runDeepEval: vi.fn(() => Promise.reject(new Error('engine blew up'))),
}));

import { startDeepEvalJob, getDeepEvalJob, cancelDeepEvalJob } from '@/lib/evaluator/deep-eval-job';

const flush = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe('deep-eval job — a rejected engine run', () => {
  it('settles the snapshot as error with the reason, and frees the project for a new start', async () => {
    const executePass = vi.fn(async () => '[]');
    const first = startDeepEvalJob({ projectPath: 'C:/rejected', moduleIds: ['audio'], executePass });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await expect(first.data.done).rejects.toThrow('engine blew up');
    await flush();

    const snap = getDeepEvalJob('C:/rejected');
    expect(snap?.status).toBe('error');
    expect(snap?.error).toContain('engine blew up');
    expect(snap?.finishedAt).not.toBeNull();

    const second = startDeepEvalJob({ projectPath: 'C:/rejected', moduleIds: ['audio'], executePass });
    expect(second.ok).toBe(true);
    if (second.ok) await second.data.done.catch(() => undefined);
  });

  it('cancel of a job whose run rejects resolves with the snapshot instead of throwing', async () => {
    const started = startDeepEvalJob({ projectPath: 'C:/rejected-cancel', moduleIds: ['audio'], executePass: vi.fn(async () => '[]') });
    expect(started.ok).toBe(true);
    const snap = await cancelDeepEvalJob('C:/rejected-cancel');
    expect(snap?.status).toBe('cancelled');
  });
});
