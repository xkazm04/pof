import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — hiding a terminal cancelled the
// pending log-flush frame without flushing, so lines that arrived in the frame
// before the hide sat in the buffer until some later line arrived. A run that
// then settled while hidden (hidden poll -> finishRun adds no line) left its
// transcript tail missing on re-show.

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

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

describe('useTaskQueue — hiding flushes buffered log lines', () => {
  const realES = globalThis.EventSource;
  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') {
        return { executionId: 'exec-1', streamUrl: '/api/claude-terminal/stream?executionId=exec-1', logFilePath: null, model: null, effort: null };
      }
      return { execution: { id: 'exec-1', status: 'running' } };
    });
  });
  afterEach(() => {
    (globalThis as unknown as { EventSource: unknown }).EventSource = realES;
    apiFetch.mockReset();
  });

  it('a line buffered in the frame before a hide is in the transcript', async () => {
    const hook = renderHook(({ visible }) => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible,
    }), { initialProps: { visible: true } });
    await act(async () => { await hook.result.current.submitPrompt('go', false); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); }); // flush the echoed prompt
    const es = FakeEventSource.instances.at(-1)!;

    act(() => {
      es.emit({ type: 'message', data: { type: 'assistant', content: 'last words before hide' }, timestamp: 1, seq: 1 });
      hook.rerender({ visible: false });
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(hook.result.current.logs.map((l) => l.content)).toContain('last words before hide');
  });
});
