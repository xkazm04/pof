/**
 * One run-lifecycle door (scan-sweep --challenge cli-terminal-shell/A).
 *
 * A CLI run used to end through TWO store writes at two different times:
 * onStreamingChange(false) flipped isRunning=false with NO outcome as soon as the
 * SSE result landed, and onTaskComplete wrote the outcome only after the callback
 * settle race (up to callbackSettleMax). Every consumer watching the isRunning edge
 * therefore read the PREVIOUS run's outcome. These cases pin the sequenced door:
 * beginRun -> settling -> ONE atomic endRun carrying this run's outcome.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';

// ── Mocks (terminal transport + fire-and-forget analytics) ──────────────────
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

// The run's callbacks are settled by the SERVER (cli-terminal-system/A): the test
// plays its `callbacks` verdict frame 2000 ms after the result, as REJECTED.
import { registerCallback } from '@/lib/cli-task';

vi.mock('@/hooks/useSessionAnalytics', () => ({ recordSessionOutcome: vi.fn() }));

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { bindSessionRun } from '@/components/cli/store/sessionRun';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { eventBusBridgeLifecycle } from '@/lib/event-bus-bridge';
import { eventBus } from '@/lib/event-bus';
import { deriveStatusForModule } from '@/components/layout/SidebarL2/helpers';
import { InlineTerminal } from '@/components/cli/InlineTerminal';
import type { CallbackStatus } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;

function newSession(sessionKey = 'arpg-combat-cli'): string {
  return useCLIPanelStore.getState().createSession({ sessionKey, moduleId: MODULE, label: 'T' });
}

// ── Fake EventSource ────────────────────────────────────────────────────────
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { /* noop */ }
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

const realES = globalThis.EventSource;
const realFetch = globalThis.fetch;

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  globalThis.fetch = vi.fn(() => Promise.resolve(new Response('{}'))) as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
  (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
  apiFetch.mockReset();
});

describe('bindSessionRun (the handlers InlineTerminal passes to CompactTerminal)', () => {
  it('stream end alone leaves the session running (settling); the completion ends it with its callback status', () => {
    const id = newSession();
    const h = bindSessionRun(id);
    h.onTaskStart('interactive');
    h.onStreamingChange(true);

    h.onStreamingChange(false);
    let sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(true);
    expect(sess.runPhase).toBe('settling');

    h.onTaskComplete('interactive', true, { callbackStatus: 'missing' });
    sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(false);
    expect(sess.lastCallbackStatus).toBe('missing');
    expect(sess.lastTaskSuccess).toBe(true);
  });
});

describe('useModuleCLI onComplete reads THIS run, not the previous one', () => {
  it('a failed callback settling 2000 ms after the stream fires onComplete once with (true, failed)', async () => {
    vi.useFakeTimers();
    const id = newSession('arpg-combat-cli');
    const onComplete = vi.fn<(s: boolean, cb?: CallbackStatus) => void>();
    renderHook(() => useModuleCLI({
      moduleId: MODULE, sessionKey: 'arpg-combat-cli', label: 'T', accentColor: 'var(--x)', onComplete,
    }));
    const h = bindSessionRun(id);

    // Previous run: confirmed.
    act(() => { h.onTaskStart('interactive'); h.onStreamingChange(true); });
    act(() => { h.onStreamingChange(false); h.onTaskComplete('interactive', true, { callbackStatus: 'confirmed' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    onComplete.mockClear();

    // This run: stream ends, callback settles 2000 ms later as failed.
    act(() => { h.onTaskStart('interactive'); h.onStreamingChange(true); });
    act(() => { h.onStreamingChange(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    act(() => { h.onTaskComplete('interactive', true, { callbackStatus: 'failed' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(true, 'failed');
    expect(onComplete).not.toHaveBeenCalledWith(true, 'confirmed');
  });
});

describe('event-bus-bridge cli.task.completed', () => {
  it('run 2 ending failed emits success:false (not run 1\'s true)', () => {
    eventBusBridgeLifecycle.init();
    const completed: boolean[] = [];
    const off = eventBus.on('cli.task.completed', (e) => { completed.push(e.payload.success); });
    try {
      const id = newSession();
      const h = bindSessionRun(id);
      h.onTaskStart('interactive'); h.onStreamingChange(true); h.onStreamingChange(false);
      h.onTaskComplete('interactive', true, { callbackStatus: 'confirmed' });
      h.onTaskStart('interactive'); h.onStreamingChange(true); h.onStreamingChange(false);
      h.onTaskComplete('interactive', false, { callbackStatus: 'failed' });
      expect(completed).toEqual([true, false]);
    } finally {
      off();
      eventBusBridgeLifecycle.dispose();
    }
  });
});

describe('SidebarL2 deriveStatusForModule', () => {
  it('a re-dispatched session whose previous run failed reads running, not failed', () => {
    const id = newSession();
    const h = bindSessionRun(id);
    h.onTaskStart('interactive');
    h.onTaskComplete('interactive', false);
    expect(deriveStatusForModule(useCLIPanelStore.getState().sessions, MODULE)).toBe('failed');
    h.onTaskStart('interactive');
    expect(deriveStatusForModule(useCLIPanelStore.getState().sessions, MODULE)).toBe('running');
  });
});

describe('InlineTerminal settle window', () => {
  it('stays running while the callback settles; once it ends, the next pof-cli-prompt POSTs exactly once', async () => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockImplementation(() => Promise.resolve({
      executionId: 'exec-1', streamUrl: '/stream?executionId=exec-1', logFilePath: null, model: null, effort: null,
    }));
    const cbId = registerCallback({ url: 'http://localhost:3000/api/checklist/complete', method: 'POST', staticFields: {}, schemaHint: '' });
    const queryPosts = () => apiFetch.mock.calls.filter(([url, init]) =>
      url === '/api/claude-terminal/query' && (init as { method?: string } | undefined)?.method === 'POST').length;
    const prompt = (text: string) => act(() => {
      window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: id, prompt: text } }));
    });

    const id = newSession();
    render(<InlineTerminal sessionId={id} />);

    prompt(`first run\n@@CALLBACK:${cbId}\n{}\n@@END_CALLBACK`);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(queryPosts()).toBe(1);
    expect(useCLIPanelStore.getState().sessions[id].isRunning).toBe(true);

    const es = FakeEventSource.instances.at(-1)!;
    await act(async () => {
      es.emit({ type: 'message', data: { type: 'assistant', content: `@@CALLBACK:${cbId}\n{"ok":true}\n@@END_CALLBACK` }, timestamp: 1 });
      es.emit({ type: 'result', data: { isError: false, sessionId: 's1' }, timestamp: 2 });
      await vi.advanceTimersByTimeAsync(10);
    });
    // The server settles 2000 ms later (rejected) and streams its verdict.
    setTimeout(() => es.emit({
      type: 'callbacks',
      data: { status: 'failed', failed: [{ callbackId: cbId, payload: '{"ok":true}', error: 'rejected' }] },
      timestamp: 3,
    }), 2000);

    // Stream ended, callback not settled: the session (module button) still reads running.
    let sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(true);
    expect(sess.runPhase).toBe('settling');

    // A prompt arriving inside the settle window does not start a second run.
    prompt('too early');
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(queryPosts()).toBe(1);

    // Callback settles (rejected) -> endRun lands with THIS run's status.
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    sess = useCLIPanelStore.getState().sessions[id];
    expect(sess.isRunning).toBe(false);
    expect(sess.lastCallbackStatus).toBe('failed');

    prompt('second run');
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(queryPosts()).toBe(2);
  });
});
