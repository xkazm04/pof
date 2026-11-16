import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — Abort is armed while a run is
// still CONNECTING (the query POST is in flight and the server is spawning the
// CLI). An Abort in that window must reap the process the POST then reports,
// never open its stream, and never fire a second completion.

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const registry = vi.hoisted(() => ({
  registerTaskStart: vi.fn(() => Promise.resolve({ success: true })),
  registerTaskComplete: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('@/components/cli/taskRegistry', () => ({
  registerTaskStart: registry.registerTaskStart,
  registerTaskComplete: registry.registerTaskComplete,
  sendTaskHeartbeat: vi.fn(() => Promise.resolve(true)),
  getTaskStatus: vi.fn(() => Promise.resolve({ found: true, status: 'running', isStale: false })),
  clearSessionTasks: vi.fn(() => Promise.resolve(0)),
  attachTaskExecution: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('@/components/cli/skills', () => ({
  injectSkillsIntoPrompt: ({ basePrompt }: { basePrompt: string }) => ({ prompt: basePrompt }),
}));

import { useTaskQueue } from '@/components/cli/useTaskQueue';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close() { this.closed = true; }
}

const LATE_EXEC = '/api/claude-terminal/query?executionId=exec-late';
const isPost = (url: string, init?: { method?: string }) => url === '/api/claude-terminal/query' && init?.method === 'POST';

describe('useTaskQueue — Abort while the run is still starting', () => {
  const realES = globalThis.EventSource;
  let releasePost: () => void;

  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (isPost(url, init)) {
        return new Promise((resolve) => {
          releasePost = () => resolve({ executionId: 'exec-late', streamUrl: '/api/claude-terminal/stream?executionId=exec-late', logFilePath: null, model: null, effort: null });
        });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset();
  });

  const deletesOfLateRun = () => apiFetch.mock.calls.filter(([url, init]) => url === LATE_EXEC && (init as { method?: string } | undefined)?.method === 'DELETE');

  it('interactive: the process spawned behind an aborted POST is killed and never streamed', async () => {
    const onTaskComplete = vi.fn();
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete,
    }));
    let submitted!: Promise<void>;
    act(() => { submitted = hook.result.current.submitPrompt('go', false); });
    expect(hook.result.current.isStreaming).toBe(true);

    await act(async () => { await hook.result.current.handleAbort(); });
    expect(onTaskComplete).toHaveBeenCalledTimes(1);

    await act(async () => { releasePost(); await submitted; });
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(deletesOfLateRun()).toHaveLength(1);
    expect(hook.result.current.isStreaming).toBe(false);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });

  it('queued: a task aborted before its POST returns is killed and never streamed', async () => {
    const onTaskComplete = vi.fn();
    const task = { id: 't1', label: 'Task', prompt: 'do it', status: 'pending' as const };
    const { result } = renderHook(() => useTaskQueue({
      instanceId: 'i2', projectPath: '/p', taskQueue: [task as never], autoStart: true, enabledSkills: [], visible: true, onTaskComplete,
    }));
    await vi.waitFor(() => expect(apiFetch.mock.calls.some(([u, i]) => isPost(u as string, i as { method?: string }))).toBe(true), { timeout: 5000 });
    // The POST is issued before React commits the streaming state; under a loaded
    // full-suite run the render can lag the call, so wait for it rather than read it once.
    await vi.waitFor(() => expect(result.current.isStreaming).toBe(true), { timeout: 5000 });

    await act(async () => { await result.current.handleAbort(); });
    await act(async () => { releasePost(); await Promise.resolve(); await Promise.resolve(); });
    await vi.waitFor(() => expect(deletesOfLateRun()).toHaveLength(1));
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
  });
});
