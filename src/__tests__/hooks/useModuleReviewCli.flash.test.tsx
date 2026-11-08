/**
 * The completion-flash highlight lasts UI_TIMEOUTS.completionFlash (the repo's one
 * timing table), not a literal in the hook. Pinned by overriding the constant: a
 * hook that hard-codes its own number keeps the highlight past the configured time.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const h = vi.hoisted(() => ({ onItemCompleted: null as null | ((id: string) => void) }));

vi.mock('@/lib/constants', async (orig) => {
  const actual = await orig<typeof import('@/lib/constants')>();
  return { ...actual, UI_TIMEOUTS: { ...actual.UI_TIMEOUTS, completionFlash: 50 } };
});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: (opts: { onItemCompleted?: (id: string) => void }) => {
    h.onItemCompleted = opts.onItemCompleted ?? null;
    return { execute: vi.fn(), isRunning: false };
  },
}));

import { useModuleReviewCli } from '@/hooks/useModuleReviewCli';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

describe('useModuleReviewCli — completion flash', () => {
  it('clears the highlight after UI_TIMEOUTS.completionFlash', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useModuleReviewCli({ moduleId: 'audio', moduleLabel: 'Audio', accentColor: STATUS_SUCCESS, onToast: vi.fn() }),
    );
    act(() => { h.onItemCompleted!('au-1'); });
    expect(result.current.lastCompletedId).toBe('au-1');
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current.lastCompletedId).toBeNull();
  });
});
