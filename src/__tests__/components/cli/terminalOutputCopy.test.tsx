/**
 * The selection toolbar's Copy calls navigator.clipboard.writeText, which REJECTS
 * when the page lacks clipboard permission / focus / a secure context. The promise
 * was dropped, so a refused copy was an unhandled rejection and the user had no
 * trace of why nothing was copied. The refusal is now caught and logged.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({
  logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

import { useTerminalOutput } from '@/components/cli/TerminalOutput/useTerminalOutput';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  warn.mockClear();
});

function fakeSelection(text: string) {
  const rect = { left: 10, top: 10, width: 40, height: 12, bottom: 22, right: 50, x: 10, y: 10, toJSON: () => ({}) };
  return {
    isCollapsed: false,
    toString: () => text,
    getRangeAt: () => ({ getBoundingClientRect: () => rect }),
    removeAllRanges: vi.fn(),
  } as unknown as Selection;
}

describe('useTerminalOutput — Copy', () => {
  it('catches and logs a refused clipboard write', async () => {
    vi.spyOn(document, 'getSelection').mockReturnValue(fakeSelection('LNK2019 unresolved external'));
    const writeText = vi.fn().mockRejectedValue(new Error('Document is not focused.'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const scrollRef = { current: document.createElement('div') };
    const { result } = renderHook(() =>
      useTerminalOutput({ logs: [], scrollRef, onBuildFix: vi.fn(), scrollBtnVisible: false, isAutoScroll: true }),
    );

    act(() => { result.current.handleMouseUp(); });
    await waitFor(() => expect(result.current.selectionToolbar).not.toBeNull());

    await act(async () => { result.current.handleSelectionCopy(); });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('LNK2019 unresolved external');
  });
});
