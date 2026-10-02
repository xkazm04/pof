import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, fireEvent, screen } from '@testing-library/react';

// scan-sweep --challenge cli-terminal-system/B — a live server run is re-attachable: a
// reload (or remount) resumes the session's run once, with a working Abort, never a
// second spawn and never a callback POST; a re-shown terminal resumes by position.

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-utils')>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
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
import { InlineTerminal } from '@/components/cli/InlineTerminal';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { bindSessionRun } from '@/components/cli/store/sessionRun';
import type { CallbackStatus } from '@/lib/cli-task';

type CompleteFn = (taskId: string, success: boolean, meta?: { callbackStatus?: CallbackStatus; outcomeUnknown?: boolean }) => void;

/** The stream route as the tab sees it: frames are replayed from `serverEvents` past the url's `after` cursor. */
let serverEvents: { type: string; data: Record<string, unknown>; timestamp: number; seq: number }[] = [];

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { this.closed = true; }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  /** What the real route sends on connect: `connected`, then every event after the cursor. */
  replay() {
    const after = Number(new URL(this.url, 'http://h').searchParams.get('after') ?? '0');
    this.emit({ type: 'connected', data: {}, timestamp: 0 });
    for (const ev of serverEvents) if (ev.seq > after) this.emit(ev);
  }
}

const STREAM_1 = '/api/claude-terminal/stream?executionId=exec-1';
const CB_URL = 'http://localhost:3000/api/checklist/complete';

const queryPosts = () => apiFetch.mock.calls.filter(([url, init]) =>
  url === '/api/claude-terminal/query' && (init as { method?: string } | undefined)?.method === 'POST');

describe('useTaskQueue — re-attach and resume', () => {
  const realES = globalThis.EventSource;
  const realFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    serverEvents = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-9', streamUrl: '/api/claude-terminal/stream?executionId=exec-9', logFilePath: null, model: null, effort: null };
      }
      if (url.startsWith('/api/claude-terminal/query?executionId=') && !init?.method) {
        return { execution: { status: 'running', callbackStatus: null } };
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

  const baseOpts = { instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [] };

  it('submitPrompt reports the server execution id exactly once when the query POST resolves', async () => {
    const onExecutionStarted = vi.fn();
    const { result } = renderHook(() => useTaskQueue({ ...baseOpts, onExecutionStarted }));
    await act(async () => { await result.current.submitPrompt('go', false); });
    expect(onExecutionStarted).toHaveBeenCalledTimes(1);
    expect(onExecutionStarted).toHaveBeenCalledWith('exec-9');
  });

  it('attachExecution opens exactly one stream for that run, spawns nothing, and Abort kills that run', async () => {
    const onTaskStart = vi.fn();
    const { result } = renderHook(() => useTaskQueue({ ...baseOpts, onTaskStart }));
    await act(async () => { result.current.attachExecution('exec-1'); });

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe(STREAM_1);
    expect(onTaskStart).toHaveBeenCalledTimes(1);
    expect(result.current.isStreaming).toBe(true);
    expect(queryPosts()).toHaveLength(0);

    await act(async () => { await result.current.handleAbort(); });
    expect(apiFetch).toHaveBeenCalledWith('/api/claude-terminal/query?executionId=exec-1', { method: 'DELETE' });
    expect(queryPosts()).toHaveLength(0);
  });

  it('an attached replay shows each line once and completes once with NO callback verdict and no callback POST', async () => {
    const onTaskComplete = vi.fn<CompleteFn>();
    const onCallbacksUnresolved = vi.fn();
    const { result } = renderHook(() => useTaskQueue({ ...baseOpts, onTaskComplete, onCallbacksUnresolved }));
    await act(async () => { result.current.attachExecution('exec-1'); });
    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => {
      es.emit({ type: 'connected', data: {}, timestamp: 1 });
      es.emit({ type: 'message', data: { type: 'assistant', content: 'hello' }, timestamp: 2, seq: 1 });
      // The run's own marker is replayed too — the server already settled it.
      es.emit({ type: 'message', data: { type: 'assistant', content: '@@CALLBACK:cb-x\n{"completed":true}\n@@END_CALLBACK' }, timestamp: 3, seq: 2 });
      es.emit({ type: 'result', data: { isError: false }, timestamp: 4, seq: 3 });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.logs.filter((l) => l.content === 'hello')).toHaveLength(1);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete.mock.calls[0][0]).toBe('interactive');
    expect(onTaskComplete.mock.calls[0][1]).toBe(true);
    expect(onTaskComplete.mock.calls[0][2]?.callbackStatus).toBeUndefined();
    expect(onCallbacksUnresolved).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => String(u) === CB_URL)).toBe(false);
    expect(queryPosts()).toHaveLength(0);
  });

  it('an attached run the server no longer holds ends as unknown (not failed) with a plain system line', async () => {
    const sid = useCLIPanelStore.getState().createSession({ label: 'T' });
    useCLIPanelStore.getState().setCurrentExecution(sid, 'exec-1', null);
    const run = bindSessionRun(sid);
    const { result } = renderHook(() => useTaskQueue({ ...baseOpts, instanceId: sid, onTaskStart: run.onTaskStart, onTaskComplete: run.onTaskComplete }));
    await act(async () => { result.current.attachExecution('exec-1'); });
    expect(useCLIPanelStore.getState().sessions[sid].isRunning).toBe(true);

    await act(async () => {
      FakeEventSource.instances.at(-1)!.emit({ type: 'error', data: { error: 'Execution not found' }, timestamp: 1 });
      await vi.advanceTimersByTimeAsync(100);
    });
    const sess = useCLIPanelStore.getState().sessions[sid];
    expect(sess.isRunning).toBe(false);
    expect(sess.lastTaskSuccess).toBeNull();
    expect(sess.currentExecutionId).toBeNull();
    expect(result.current.logs.some((l) => l.type === 'system' && /no longer on the server/i.test(l.content))).toBe(true);
  });

  it('re-show resumes from the last position seen: the new stream asks for after=3 and adds no duplicate lines', async () => {
    const { result, rerender } = renderHook((p: { visible: boolean }) => useTaskQueue({ ...baseOpts, visible: p.visible }), { initialProps: { visible: true } });
    await act(async () => { await result.current.submitPrompt('go', false); });
    serverEvents = [1, 2, 3].map((seq) => ({ type: 'message', data: { type: 'assistant', content: `line ${seq}` }, timestamp: seq, seq }));
    await act(async () => {
      FakeEventSource.instances.at(-1)!.replay();
      await vi.advanceTimersByTimeAsync(50);
    });
    const before = result.current.logs.length;
    expect(result.current.logs.filter((l) => l.type === 'assistant')).toHaveLength(3);

    rerender({ visible: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    rerender({ visible: true });
    await act(async () => {
      const es = FakeEventSource.instances.at(-1)!;
      es.replay();
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(FakeEventSource.instances.at(-1)!.url.endsWith('&after=3')).toBe(true);
    expect(result.current.logs.length).toBe(before);
  });
});

describe('InlineTerminal — reload -> mount -> attach', () => {
  const realES = globalThis.EventSource;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('{}'))) as unknown as typeof fetch;
    localStorage.clear();
    useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-9', streamUrl: '/api/claude-terminal/stream?executionId=exec-9', logFilePath: null, model: null, effort: null };
      }
      if (url.startsWith('/api/claude-terminal/query?executionId=') && !init?.method) {
        return { execution: { status: 'running', callbackStatus: null } };
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

  async function dispatchThenReload(): Promise<string> {
    const id = useCLIPanelStore.getState().createSession({ label: 'T', moduleId: 'arpg-combat' });
    const first = render(<InlineTerminal sessionId={id} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: id, prompt: 'long run' } }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(queryPosts()).toHaveLength(1);
    // The session records the server run it owns (onExecutionStarted -> setCurrentExecution).
    expect(useCLIPanelStore.getState().sessions[id].currentExecutionId).toBe('exec-9');

    // Reload: the page goes away, the persisted store is rehydrated through merge.
    first.unmount();
    await act(async () => { await (useCLIPanelStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate(); });
    const sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(false);
    expect(sess.currentExecutionId).toBe('exec-9');
    return id;
  }

  it('the remounted terminal re-attaches to its run once (Running, no second spawn) and ends it with the real outcome', async () => {
    const id = await dispatchThenReload();
    const esBefore = FakeEventSource.instances.length;

    render(<InlineTerminal sessionId={id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    const attached = FakeEventSource.instances.slice(esBefore).filter((es) => !es.closed);
    expect(attached).toHaveLength(1);
    expect(attached[0].url).toBe('/api/claude-terminal/stream?executionId=exec-9');
    expect(queryPosts()).toHaveLength(1);
    expect(useCLIPanelStore.getState().sessions[id].isRunning).toBe(true);
    expect(screen.getByText(/Re-attached to run exec-9/)).toBeTruthy();

    await act(async () => {
      attached[0].emit({ type: 'connected', data: {}, timestamp: 1 });
      attached[0].emit({ type: 'message', data: { type: 'assistant', content: 'done' }, timestamp: 2, seq: 1 });
      attached[0].emit({ type: 'result', data: { isError: false }, timestamp: 3, seq: 2 });
      await vi.advanceTimersByTimeAsync(100);
    });
    const sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(false);
    expect(sess.lastTaskSuccess).toBe(true);
    expect(sess.lastCallbackStatus).toBeNull();
    expect(sess.currentExecutionId).toBeNull();
    expect(queryPosts()).toHaveLength(1);
  });

  it('Abort on the re-attached terminal kills exactly that run', async () => {
    const id = await dispatchThenReload();
    render(<InlineTerminal sessionId={id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Abort running task'));
      await vi.advanceTimersByTimeAsync(50);
    });
    const deletes = apiFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'DELETE');
    expect(deletes).toEqual([['/api/claude-terminal/query?executionId=exec-9', { method: 'DELETE' }]]);
    expect(useCLIPanelStore.getState().sessions[id].isRunning).toBe(false);
    expect(queryPosts()).toHaveLength(1);
  });
});
