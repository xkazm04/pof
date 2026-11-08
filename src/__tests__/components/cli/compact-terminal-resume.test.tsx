import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — CompactTerminal's Resume button: it used to read the input state of the render before setInput('Continue'), so it sent nothing (or the stale draft).

const submitPrompt = vi.fn(() => Promise.resolve());
let fileChanges: { filePath: string; changeType: 'edit' | 'write' | 'read'; toolUseId: string }[] = [];

vi.mock('@/components/cli/useTaskQueue', () => ({
  useTaskQueue: () => ({
    logs: [], fileChanges, isStreaming: false, sessionId: 'sess-1', executionInfo: null,
    lastResult: null, error: null, currentTaskId: null, logFilePath: null,
    resolvedModel: null, resolvedEffort: null, buildParseCache: new Map(),
    submitPrompt, attachExecution: vi.fn(), handleAbort: vi.fn(), handleClear: vi.fn(),
  }),
}));
vi.mock('@/components/cli/TerminalOutput', () => ({ TerminalOutput: () => null }));
vi.mock('@/components/cli/AntiPatternWarning', () => ({ AntiPatternWarning: () => null }));

import { CompactTerminal } from '@/components/cli/CompactTerminal';

afterEach(() => { cleanup(); submitPrompt.mockClear(); fileChanges = []; });

describe('CompactTerminal header actions', () => {
  it('Resume sends "Continue" into the existing session', async () => {
    const { container } = render(<CompactTerminal instanceId="t1" projectPath="/p" />);
    const resume = container.querySelector('button[aria-label="Resume session"]') as HTMLButtonElement;
    expect(resume).not.toBeNull();
    await act(async () => { fireEvent.click(resume); await new Promise((r) => setTimeout(r, 5)); });
    expect(submitPrompt).toHaveBeenCalledTimes(1);
    expect(submitPrompt.mock.calls[0]).toEqual(['Continue', true]);
  });
});
