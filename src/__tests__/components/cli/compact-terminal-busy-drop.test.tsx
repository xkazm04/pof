import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// scan-sweep 2026-11-08 cli-terminal-shell: a pof-cli-prompt that reaches a terminal
// mid-run used to be dropped without a trace; it must leave a 'not sent' system line.

const submitPrompt = vi.fn(() => Promise.resolve());
const logBusyDrop = vi.fn();
let streaming = true;

vi.mock('@/components/cli/useTaskQueue', () => ({
  useTaskQueue: () => ({
    logs: [], fileChanges: [], isStreaming: streaming, sessionId: 'sess-1', executionInfo: null,
    lastResult: null, error: null, currentTaskId: null, logFilePath: null,
    resolvedModel: null, resolvedEffort: null, buildParseCache: new Map(),
    submitPrompt, attachExecution: vi.fn(), handleAbort: vi.fn(), handleClear: vi.fn(), logBusyDrop,
  }),
}));
vi.mock('@/components/cli/TerminalOutput', () => ({ TerminalOutput: () => null }));
vi.mock('@/components/cli/AntiPatternWarning', () => ({ AntiPatternWarning: () => null }));

import { CompactTerminal } from '@/components/cli/CompactTerminal';

afterEach(() => { cleanup(); submitPrompt.mockClear(); logBusyDrop.mockClear(); streaming = true; });

function send(prompt: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: 't1', prompt } }));
  });
}

describe('CompactTerminal pof-cli-prompt while busy', () => {
  it('logs a not-sent line and does not submit while streaming', () => {
    render(<CompactTerminal instanceId="t1" projectPath="/p" />);
    send('second action');
    expect(logBusyDrop).toHaveBeenCalledTimes(1);
    expect(submitPrompt).not.toHaveBeenCalled();
  });

  it('submits normally when idle, with no busy line', () => {
    streaming = false;
    render(<CompactTerminal instanceId="t1" projectPath="/p" />);
    send('go');
    expect(submitPrompt).toHaveBeenCalledTimes(1);
    expect(logBusyDrop).not.toHaveBeenCalled();
  });
});
