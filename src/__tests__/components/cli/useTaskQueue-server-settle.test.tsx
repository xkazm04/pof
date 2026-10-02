import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// scan-sweep --challenge cli-terminal-system/A — the terminal no longer POSTs a run's
// @@CALLBACKs: it declares them with the query POST and reads the server's verdict,
// from the stream when attached and from the execution status when hidden.

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
import { registerCallback, type CallbackStatus } from '@/lib/cli-task';
import { UI_TIMEOUTS } from '@/lib/constants';

type CompleteFn = (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { this.readyState = 2; }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

const CB_URL = 'http://localhost:3000/api/checklist/complete';

function queryPostBodies(): Record<string, unknown>[] {
  return apiFetch.mock.calls
    .filter(([url, init]) => url === '/api/claude-terminal/query' && (init as { method?: string } | undefined)?.method === 'POST')
    .map(([, init]) => JSON.parse((init as { body: string }).body));
}

describe('useTaskQueue — server-settled callbacks', () => {
  const realES = globalThis.EventSource;
  const realFetch = globalThis.fetch;
  const fetchMock = vi.fn();
  let statusReply: Record<string, unknown> = { status: 'running', callbackStatus: null };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ json: async () => ({ success: true }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    statusReply = { status: 'running', callbackStatus: null };
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-1', streamUrl: '/stream?executionId=exec-1', logFilePath: null, model: null, effort: null };
      }
      if (url.startsWith('/api/claude-terminal/query?executionId=') && !init?.method) {
        return { execution: { id: 'exec-1', ...statusReply } };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    globalThis.fetch = realFetch;
    apiFetch.mockReset();
  });

  function promptWithCallback(): { prompt: string; id: string } {
    const id = registerCallback({ url: CB_URL, method: 'POST', staticFields: { moduleId: 'm' }, schemaHint: '"completed": true' });
    return { id, prompt: `Do the work.\n\n@@CALLBACK:${id}\n{ "completed": true }\n@@END_CALLBACK` };
  }

  it('declares the run\'s callbacks with the query POST and completes from the server\'s callbacks frame — no client POST', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { result } = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete,
    }));
    const { id, prompt } = promptWithCallback();
    await act(async () => { await result.current.submitPrompt(prompt, false); });

    const body = queryPostBodies().at(-1)!;
    expect((body.callbacks as { id: string }[])[0].id).toBe(id);

    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => {
      es.emit({ type: 'connected', data: {}, timestamp: 1 });
      es.emit({ type: 'message', data: { type: 'assistant', content: `@@CALLBACK:${id}\n{"completed":true}\n@@END_CALLBACK` }, timestamp: 2 });
      es.emit({ type: 'result', data: { isError: false }, timestamp: 3 });
      await vi.advanceTimersByTimeAsync(10);
    });
    // The verdict is the server's: nothing fires before the callbacks frame.
    expect(onTaskComplete).not.toHaveBeenCalled();

    await act(async () => {
      es.emit({ type: 'callbacks', data: { status: 'confirmed', failed: [] }, timestamp: 4 });
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.callbackSettleMax + 100);
    });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', true, { callbackStatus: 'confirmed' });
    expect(fetchMock.mock.calls.some(([u]) => u === CB_URL)).toBe(false);
  });

  it('a hidden run settles from the execution status without re-show; a later re-show does not complete it again', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { result, rerender } = renderHook((p: { visible: boolean }) => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: p.visible, onTaskComplete,
    }), { initialProps: { visible: true } });
    const { prompt } = promptWithCallback();
    await act(async () => { await result.current.submitPrompt(prompt, false); });
    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => { es.emit({ type: 'connected', data: {}, timestamp: 1 }); });
    expect(result.current.isStreaming).toBe(true);

    rerender({ visible: false });
    statusReply = { status: 'completed', callbackStatus: 'confirmed' };
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });

    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', true, { callbackStatus: 'confirmed' });
    expect(result.current.isStreaming).toBe(false);
    const esCount = FakeEventSource.instances.length;

    rerender({ visible: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances.length).toBe(esCount); // no re-attach to a settled run
    expect(fetchMock.mock.calls.some(([u]) => u === CB_URL)).toBe(false);
  });

  it('a hidden run whose callbacks are still settling waits for the verdict', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const { result, rerender } = renderHook((p: { visible: boolean }) => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: p.visible, onTaskComplete,
    }), { initialProps: { visible: true } });
    const { prompt } = promptWithCallback();
    await act(async () => { await result.current.submitPrompt(prompt, false); });
    await act(async () => { FakeEventSource.instances.at(-1)!.emit({ type: 'connected', data: {}, timestamp: 1 }); });

    rerender({ visible: false });
    statusReply = { status: 'completed', callbackStatus: null };
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });
    expect(onTaskComplete).not.toHaveBeenCalled();

    statusReply = { status: 'completed', callbackStatus: 'failed' };
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', true, { callbackStatus: 'failed' });
  });
});
