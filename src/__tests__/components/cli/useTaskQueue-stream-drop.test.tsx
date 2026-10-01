import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// scan-sweep --challenge cli-terminal-shell/A — a dropped or silent stream no longer ends
// a run: the tab asks the server (GET /api/claude-terminal/query) and applies the
// arbitrated verdict — reconnect with the seq cursor, wait and re-consult, or end once.

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/components/cli/taskRegistry', () => ({
  registerTaskStart: vi.fn(() => Promise.resolve({ success: true })),
  registerTaskComplete: vi.fn(() => Promise.resolve(undefined)),
  sendTaskHeartbeat: vi.fn(() => Promise.resolve(true)),
  getTaskStatus: vi.fn(() => Promise.resolve({ found: true, status: 'running', isStale: false })),
  clearSessionTasks: vi.fn(() => Promise.resolve(0)),
  attachTaskExecution: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('@/components/cli/skills', () => ({
  injectSkillsIntoPrompt: ({ basePrompt }: { basePrompt: string }) => ({ prompt: basePrompt }),
}));

import { useTaskQueue } from '@/components/cli/useTaskQueue';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CallbackStatus } from '@/lib/cli-task';

type CompleteFn = (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus; outcomeUnknown?: boolean }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { this.closed = true; }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  triggerError() { this.onerror?.(); }
}

const STATUS_URL = '/api/claude-terminal/query?executionId=exec-1';
/** What the status GET does next: a reply, or a rejection (unreachable / gone). */
let statusReplies: (Record<string, unknown> | Error)[] = [];

const statusGets = () => apiFetch.mock.calls.filter(([url, init]) => url === STATUS_URL && !(init as { method?: string } | undefined)?.method);
const deletes = () => apiFetch.mock.calls.filter(([url, init]) => url === STATUS_URL && (init as { method?: string } | undefined)?.method === 'DELETE');

describe('useTaskQueue — a dropped stream is arbitrated by the server', () => {
  const realES = globalThis.EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    statusReplies = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-1', streamUrl: '/api/claude-terminal/stream?executionId=exec-1', logFilePath: null, model: null, effort: null };
      }
      if (url === STATUS_URL && !init?.method) {
        const next = statusReplies.length > 1 ? statusReplies.shift()! : statusReplies[0];
        if (next === undefined) throw new Error('no status reply scripted');
        if (next instanceof Error) throw next;
        return { execution: { id: 'exec-1', callbackStatus: null, ...next } };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset();
  });

  async function startVisibleRun(onTaskComplete: CompleteFn) {
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete,
    }));
    await act(async () => { await hook.result.current.submitPrompt('go', false); });
    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => {
      es.emit({ type: 'connected', data: {}, timestamp: 0 });
      for (const seq of [1, 2, 3]) es.emit({ type: 'message', data: { type: 'assistant', content: `line ${seq}` }, timestamp: seq, seq });
    });
    return { ...hook, es };
  }

  it('a drop on a live run reconnects with after=<lastSeq> and ends once from the real result', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { result, es } = await startVisibleRun(onTaskComplete);
    statusReplies = [{ status: 'running' }];

    await act(async () => {
      es.triggerError();
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamReconnectDelay + 10);
    });
    expect(onTaskComplete).not.toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    const reopened = FakeEventSource.instances.at(-1)!;
    expect(reopened.url).toContain('after=3');

    await act(async () => {
      reopened.emit({ type: 'result', data: { isError: false }, timestamp: 9, seq: 4 });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete.mock.calls[0].slice(0, 2)).toEqual(['interactive', true]);
  });

  it('a drop after the run finished records the server outcome (success), not a failure', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { es } = await startVisibleRun(onTaskComplete);
    statusReplies = [{ status: 'completed', isError: false }];

    await act(async () => {
      es.triggerError();
      // Today's bug: completeOnce(false) fired synchronously right here.
      expect(onTaskComplete).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamReconnectDelay + 10);
    });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', true);
  });

  it('an unreachable server means wait — the run is re-consulted after streamSilenceMax and then ends once', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { es } = await startVisibleRun(onTaskComplete);
    statusReplies = [new TypeError('Failed to fetch'), { status: 'error' }];

    await act(async () => {
      es.triggerError();
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamReconnectDelay + 10);
    });
    expect(statusGets()).toHaveLength(1);
    expect(onTaskComplete).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamSilenceMax + 10); });
    expect(statusGets()).toHaveLength(2);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', false);

    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamSilenceMax * 2); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });

  it('a silent visible stream is detected: any frame (heartbeat included) resets the timer; silence issues exactly one GET', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { es } = await startVisibleRun(onTaskComplete);
    statusReplies = [{ status: 'running' }];

    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamSilenceMax - 1000); });
    await act(async () => { es.emit({ type: 'heartbeat', data: {}, timestamp: 5 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.streamSilenceMax - 1000); });
    expect(statusGets()).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1010); });
    expect(statusGets()).toHaveLength(1);
    // Verdict applied: the run is live, so the half-open stream is replaced at the cursor.
    expect(es.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances.at(-1)!.url).toContain('after=3');
    expect(onTaskComplete).not.toHaveBeenCalled();
  });

  it('[guard] Abort stays immediate: DELETE, one failed completion, no status GET first', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { result } = await startVisibleRun(onTaskComplete);

    await act(async () => { await result.current.handleAbort(); });
    expect(deletes()).toHaveLength(1);
    expect(statusGets()).toHaveLength(0);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', false);
  });
});
