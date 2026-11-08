import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — a run whose query POST fails
// (server error, network down) used to end with only the reducer's `error`, which
// no host reads: the transcript showed the echoed prompt and nothing else, and the
// header fell back to "Ready". The failure must reach the transcript.

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

describe('useTaskQueue — a run that fails to start says so in the transcript', () => {
  beforeEach(() => {
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/claude-terminal/query' && init?.method === 'POST') throw new Error('Claude CLI not found on PATH');
      return {};
    });
  });
  afterEach(() => { apiFetch.mockReset(); });

  it('interactive: the start error is logged as an error line', async () => {
    const onTaskComplete = vi.fn();
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete,
    }));
    await act(async () => { await hook.result.current.submitPrompt('go', false); });
    await vi.waitFor(() => expect(hook.result.current.logs.some((l) => l.type === 'user')).toBe(true));
    const errors = hook.result.current.logs.filter((l) => l.type === 'error');
    expect(errors.map((l) => l.content)).toEqual(['Failed to start: Claude CLI not found on PATH']);
    expect(onTaskComplete).toHaveBeenCalledWith('interactive', false);
  });

  it('queued: the start error is logged as an error line', async () => {
    const task = { id: 't1', label: 'Task', prompt: 'do it', status: 'pending' as const };
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [task as never], autoStart: true, enabledSkills: [], visible: true,
    }));
    await vi.waitFor(() => expect(hook.result.current.logs.some((l) => l.type === 'error')).toBe(true), { timeout: 6000 });
    const errors = hook.result.current.logs.filter((l) => l.type === 'error');
    expect(errors.map((l) => l.content)).toEqual(['Failed to start: Claude CLI not found on PATH']);
  });
});
