import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks for the queued-dispatch dependencies ──────────────────────────────
const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const registerTaskStart = vi.fn();
const registerTaskComplete = vi.fn();
const getTaskStatus = vi.fn();
vi.mock('@/components/cli/taskRegistry', () => ({
  registerTaskStart: (...a: unknown[]) => registerTaskStart(...a),
  registerTaskComplete: (...a: unknown[]) => registerTaskComplete(...a),
  sendTaskHeartbeat: vi.fn(() => Promise.resolve(true)),
  getTaskStatus: (...a: unknown[]) => getTaskStatus(...a),
  clearSessionTasks: vi.fn(() => Promise.resolve(0)),
  attachTaskExecution: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/components/cli/skills', () => ({
  injectSkillsIntoPrompt: ({ basePrompt }: { basePrompt: string }) => ({ prompt: basePrompt }),
}));

import { useTaskQueue } from '@/components/cli/useTaskQueue';
import type { QueuedTask } from '@/components/cli/types';
import type { CallbackStatus } from '@/lib/cli-task';

type CompleteFn = (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus }) => void;

// ── Fake EventSource ────────────────────────────────────────────────────────
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { this.readyState = 2; }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  triggerError() { this.onerror?.(); }
}

const PENDING: QueuedTask = { id: 't1', status: 'pending', prompt: 'do it', label: 'Task 1' } as QueuedTask;

function baseOpts(onTaskComplete: CompleteFn) {
  return {
    instanceId: 'inst-1',
    projectPath: '/proj',
    taskQueue: [PENDING],
    autoStart: true,
    enabledSkills: [],
    visible: true,
    onTaskComplete,
  };
}

/** Advance to the queued-dispatch and return the created EventSource. */
async function startQueuedRun() {
  // nextTaskDelay (3000) → executeTask → apiFetch(query) → connectToStream.
  await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
  const es = FakeEventSource.instances.at(-1);
  expect(es).toBeTruthy();
  return es!;
}

describe('useTaskQueue — single completion latch', () => {
  const realES = globalThis.EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockResolvedValue({ executionId: 'exec-1', streamUrl: '/stream?executionId=exec-1', logFilePath: null });
    registerTaskStart.mockResolvedValue({ success: true });
    registerTaskComplete.mockResolvedValue(undefined);
    getTaskStatus.mockResolvedValue({ found: true, status: 'running', isStale: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset(); registerTaskStart.mockReset(); registerTaskComplete.mockReset(); getTaskStatus.mockReset();
  });

  it('a clean result completes exactly once — a later stream onerror is ignored', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    renderHook(() => useTaskQueue(baseOpts(onTaskComplete)));
    const es = await startQueuedRun();

    // Result SSE latches completion synchronously; the callback-settle race then
    // fires the single completion (no markers → 'missing').
    await act(async () => {
      es.emit({ type: 'result', data: { isError: false, sessionId: 's1' } });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('t1', true, { callbackStatus: 'missing' });

    // A stray abnormal stream end AFTER completion must not double-fire.
    await act(async () => { es.triggerError(); await vi.advanceTimersByTimeAsync(0); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });

  it('the stuck poller completes once and latches — a later onerror is ignored', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    renderHook(() => useTaskQueue(baseOpts(onTaskComplete)));
    const es = await startQueuedRun();

    // The server-side registry reports the task completed; the stuck poller (30s)
    // observes it and fires completion.
    getTaskStatus.mockResolvedValue({ found: true, status: 'completed', isStale: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('t1', true);

    // Latch holds across paths: a subsequent stream onerror does not re-complete.
    await act(async () => { es.triggerError(); await vi.advanceTimersByTimeAsync(0); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });
});
