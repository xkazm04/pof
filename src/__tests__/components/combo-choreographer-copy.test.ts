/**
 * `handleCopy` must not claim success when the clipboard write actually fails.
 *
 * `navigator.clipboard.writeText` returns a Promise — the choreographer's
 * handler fired `setCopied(true)` unconditionally without awaiting it, so a
 * rejected write (denied permission, insecure context, browser quirk) still
 * showed "Copied!" to the user. This is the exact "a surface cannot prove
 * something" case the repo's own UI-honesty convention names.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIComboChoreographer } from '@/components/modules/content/animations/AIComboChoreographer/useAIComboChoreographer';

vi.mock('@/stores/blenderMCPStore', () => ({
  useBlenderMCPStore: (selector: (s: { connection: { connected: boolean } }) => unknown) =>
    selector({ connection: { connected: false } }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error -- test cleanup of a jsdom-polyfilled global
  delete navigator.clipboard;
});

describe('useAIComboChoreographer handleCopy', () => {
  it('sets copied=true when the clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useAIComboChoreographer());
    await act(async () => {
      result.current.handleCopy('some code');
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('some code');
    expect(result.current.copied).toBe(true);
  });

  it('does NOT set copied=true when the clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useAIComboChoreographer());
    await act(async () => {
      result.current.handleCopy('some code');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.copied).toBe(false);
  });
});
