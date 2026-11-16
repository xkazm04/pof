import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — CompactTerminal's the header's 'N files edited/created' badges counted Edit/Write tool calls, not files.

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

describe('CompactTerminal header metrics', () => {
  it('the edited/created badges count files, not tool calls', () => {
    fileChanges = [
      { filePath: 'Source/A.cpp', changeType: 'edit', toolUseId: 'u1' },
      { filePath: 'Source/A.cpp', changeType: 'edit', toolUseId: 'u2' },
      { filePath: 'Source/A.cpp', changeType: 'edit', toolUseId: 'u3' },
      { filePath: 'Source/B.h', changeType: 'write', toolUseId: 'u4' },
      { filePath: 'Source/B.h', changeType: 'write', toolUseId: 'u5' },
    ];
    const { container } = render(<CompactTerminal instanceId="t1" projectPath="/p" />);
    const labels = [...container.querySelectorAll('[data-testid="pof-cli-metric-cluster"] span[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(labels).toEqual(['1 file edited', '1 file created']);
  });
});
