import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// scan-sweep 2026-11-08 cli-terminal-shell: a second submit in the same tick as a live
// dispatch is refused by the re-entrancy latch; it must say so in the transcript.

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

afterEach(() => { cleanup(); apiFetch.mockReset(); });

describe('useTaskQueue busy drop', () => {
  it('a same-tick second submit leaves a Busy system line', async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    const hook = renderHook(() => useTaskQueue({
      instanceId: 'i1', projectPath: '/p', taskQueue: [], autoStart: false, enabledSkills: [], visible: true, onTaskComplete: vi.fn(),
    }));
    await act(async () => {
      void hook.result.current.submitPrompt('one', false);
      await hook.result.current.submitPrompt('two', false);
    });
    await vi.waitFor(() => {
      expect(hook.result.current.logs.some((l) => l.type === 'system' && l.content.includes('Busy'))).toBe(true);
    });
  });
});
