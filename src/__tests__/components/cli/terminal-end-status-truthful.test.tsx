import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, cleanup } from '@testing-library/react';
import { TerminalHeader } from '@/components/cli/TerminalHeader';

// scan-sweep 2026-11-08 cli-terminal-shell: the header chip read "Ready" after a start
// failure, an error frame, or a server-arbitrated failed / lost run.

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

type HeaderProps = Parameters<typeof TerminalHeader>[0];
function chip(over: Partial<HeaderProps>) {
  const { getByRole } = render(
    <TerminalHeader title="t" sessionId={null} isStreaming={false} executionInfo={null} lastResult={null}
      logFilePath={null} editCount={0} writeCount={0} queuePendingCount={0} onClear={vi.fn()} onResume={vi.fn()} {...over} />,
  );
  return getByRole('status').textContent ?? '';
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

afterEach(cleanup);

describe('TerminalHeader end status', () => {
  it('shows Error for an error end, Unknown for a lost run, Ready otherwise', () => {
    expect(chip({ error: 'Failed to start: x' })).toContain('Error');
    cleanup();
    expect(chip({ error: 'Outcome unknown', outcomeUnknown: true })).toContain('Unknown');
    cleanup();
    expect(chip({})).toContain('Ready');
  });
});

describe('useTaskQueue end states reach the header inputs', () => {
  const realES = globalThis.EventSource;
  let statusFn: () => unknown = () => ({ execution: { id: 'exec-1', status: 'running' } });

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-1', streamUrl: '/stream?executionId=exec-1', logFilePath: null, model: null, effort: null };
      }
      if (url.startsWith('/api/claude-terminal/query?executionId=') && !init?.method) return statusFn();
      return {};
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset();
  });

  async function hiddenRun() {
    const hook = renderHook((p: { visible: boolean }) => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: p.visible, onTaskComplete: vi.fn(),
    }), { initialProps: { visible: true } });
    await act(async () => { await hook.result.current.submitPrompt('go', false); });
    await act(async () => { FakeEventSource.instances.at(-1)!.emit({ type: 'connected', data: {}, timestamp: 1 }); });
    hook.rerender({ visible: false });
    return hook;
  }

  it('a server-arbitrated failure ends as an error result, not idle', async () => {
    statusFn = () => ({ execution: { id: 'exec-1', status: 'failed' } });
    const hook = await hiddenRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });
    expect(hook.result.current.isStreaming).toBe(false);
    expect(hook.result.current.lastResult?.isError).toBe(true);
  });

  it('a run the server lost ends with outcomeUnknown', async () => {
    statusFn = () => { throw new Error('Execution not found'); };
    const hook = await hiddenRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.stuckCheckInterval + 10); });
    expect(hook.result.current.outcomeUnknown).toBe(true);
  });

  it('an error frame leaves error set for the header', async () => {
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete: vi.fn(),
    }));
    await act(async () => { await hook.result.current.submitPrompt('go', false); });
    await act(async () => {
      FakeEventSource.instances.at(-1)!.emit({ type: 'connected', data: {}, timestamp: 1 });
      FakeEventSource.instances.at(-1)!.emit({ type: 'error', data: { error: 'boom' }, timestamp: 2 });
    });
    expect(hook.result.current.error).toBe('boom');
  });
});
