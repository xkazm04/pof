/**
 * Batch review settles each module's CLI run through the one settlement seam
 * (`settleExecution`, run-settle.ts) and records WHY a module failed.
 *
 * Before: its own spawn-and-wait copy polled every 2 s for up to 600 s (both hardcoded),
 * marked a run that ended without a @@CALLBACK as `completed` (a review that recorded
 * nothing, reported as done), and wrote `CLI execution failed` for a timeout and a crash
 * alike.
 *
 * Real cli-service over a fake child_process; the batch clock is faked.
 * scan-sweep --challenge run challenge-2026-09-29b, card ai-developer-tools-api/A.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NextRequest } from 'next/server';
import type { BatchReviewState } from '@/types/batch-review';

const { killSpy, spawnMock, resolveCallback } = vi.hoisted(() => ({
  killSpy: vi.fn(),
  spawnMock: vi.fn(),
  resolveCallback: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: (p: unknown) => killSpy(p) }));
vi.mock('@/lib/cli-spend-db', () => ({ recordSpend: vi.fn() }));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const spawn = (...a: unknown[]) => spawnMock(...a);
  return { ...actual, default: { ...actual, spawn }, spawn };
});
vi.mock('@/lib/cli-task', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cli-task')>();
  return {
    ...actual,
    TaskFactory: { featureReview: () => ({}) },
    buildTaskPrompt: () => 'prompt',
    resolveCallback: (...a: unknown[]) => (resolveCallback as (...x: unknown[]) => unknown)(...a),
  };
});

type FakeChild = EventEmitter & {
  pid: number; killed: boolean; stdout: EventEmitter; stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }; kill: ReturnType<typeof vi.fn>;
};
function fakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild;
  proc.pid = 5151;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.kill = vi.fn();
  return proc;
}

import { UI_TIMEOUTS } from '@/lib/constants';

type Route = typeof import('@/app/api/feature-matrix/batch-review/route');
let route: Route;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-batch-settle-'));

const assistantLine = (text: string) => JSON.stringify({
  type: 'assistant',
  message: { id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text }], model: 'x', stop_reason: 'end_turn' },
}) + '\n';
const resultLine = JSON.stringify({ type: 'result', is_error: false, session_id: 's' }) + '\n';

const post = (moduleIds: string[]) => new NextRequest('http://localhost/api/feature-matrix/batch-review', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectPath: TMP, moduleIds }),
});

async function batch(): Promise<BatchReviewState> {
  const json = await (await route.GET()).json();
  return json.data.batch;
}

/** Yield to the real event loop until `pred` holds (setImmediate is not faked). */
async function until(pred: () => boolean | Promise<boolean>, rounds = 200): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    if (await pred()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error('condition never held');
}

const child = (i: number) => spawnMock.mock.results[i].value as FakeChild;

beforeEach(async () => {
  vi.resetModules();
  killSpy.mockClear();
  resolveCallback.mockClear();
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => fakeChild());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  route = await import('@/app/api/feature-matrix/batch-review/route');
});
afterEach(() => { vi.useRealTimers(); });

describe('batch-review — module settlement carries its reason', () => {
  it('case 6: a run that completes with text but no @@CALLBACK is an error naming no-callback', async () => {
    expect((await route.POST(post(['arpg-combat']))).status).toBe(200);
    await until(() => spawnMock.mock.calls.length === 1);

    child(0).stdout.emit('data', Buffer.from(assistantLine('Reviewed everything, looks fine.')));
    child(0).stdout.emit('data', Buffer.from(resultLine));
    child(0).emit('close', 0);

    await until(async () => (await batch()).status !== 'running');
    const [mod] = (await batch()).modules;
    expect(mod.status).toBe('error');
    expect(mod.error).toMatch(/no-callback/);
    expect(resolveCallback).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('a run that emits its @@CALLBACK resolves it and completes', async () => {
    expect((await route.POST(post(['arpg-combat']))).status).toBe(200);
    await until(() => spawnMock.mock.calls.length === 1);
    child(0).stdout.emit('data', Buffer.from(assistantLine('@@CALLBACK:cb-9\n{"features": []}\n@@END_CALLBACK')));
    await until(async () => (await batch()).status !== 'running');
    const [mod] = (await batch()).modules;
    expect(mod.status).toBe('completed');
    expect(resolveCallback).toHaveBeenCalledWith('cb-9', '{"features": []}');
  });

  it('case 7: a timeout and an exit code 1 read differently and name their cause', async () => {
    expect((await route.POST(post(['arpg-combat', 'arpg-loot']))).status).toBe(200);
    await until(() => spawnMock.mock.calls.length === 1);

    // Module 1 never answers: only the batch clock can end it.
    await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.batchReviewTimeout);
    await until(() => spawnMock.mock.calls.length === 2);
    expect(killSpy).toHaveBeenCalledTimes(1);

    // Module 2 crashes.
    child(1).emit('close', 1);
    await until(async () => (await batch()).status !== 'running');

    const [timedOut, crashed] = (await batch()).modules;
    expect(timedOut.status).toBe('error');
    expect(crashed.status).toBe('error');
    expect(timedOut.error).toMatch(/timeout/);
    expect(crashed.error).toMatch(/exit code 1/);
    expect(timedOut.error).not.toBe(crashed.error);
  });
});
