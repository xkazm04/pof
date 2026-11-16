/**
 * `usePromptSuggestions` shows suggestions for the prompt that is in the box NOW.
 *
 * Clearing the box used to `setSuggestions([])` while the previous keystroke's
 * debounce timer was still armed — 500 ms later it fired, fetched the old text
 * and repainted suggestions under an empty prompt. And two overlapping requests
 * wrote in arrival order, so a slow older answer could replace a newer one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const pending: Array<{ url: string; resolve: (v: unknown) => void }> = [];
vi.mock('@/lib/api-utils', () => ({
  apiFetch: vi.fn((url: string) => new Promise((resolve) => { pending.push({ url, resolve }); })),
}));

import { usePromptSuggestions } from '@/hooks/useSessionAnalytics';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const tip = (message: string) => ({ suggestions: [{ type: 'module-tip', message, confidence: 0.5 }] });

describe('usePromptSuggestions — no stale suggestions', () => {
  beforeEach(() => { pending.length = 0; vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('clearing the prompt cancels the armed debounce', async () => {
    const { result } = renderHook(() => usePromptSuggestions(MOD));
    await act(async () => { await result.current.fetchSuggestions('add a dodge roll'); });
    await act(async () => { await result.current.fetchSuggestions(''); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(pending).toHaveLength(0);
    expect(result.current.suggestions).toEqual([]);
  });

  it('an older request answering last does not replace the newer answer', async () => {
    const { result } = renderHook(() => usePromptSuggestions(MOD));
    await act(async () => { await result.current.fetchSuggestions('first'); });
    await act(async () => { vi.advanceTimersByTime(600); });
    await act(async () => { await result.current.fetchSuggestions('second'); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1].resolve(tip('for second')); });
    await act(async () => { pending[0].resolve(tip('for first')); });
    expect(result.current.suggestions.map(s => s.message)).toEqual(['for second']);
  });

  it('a request still in flight when the prompt is cleared does not repaint', async () => {
    const { result } = renderHook(() => usePromptSuggestions(MOD));
    await act(async () => { await result.current.fetchSuggestions('first'); });
    await act(async () => { vi.advanceTimersByTime(600); });
    await act(async () => { await result.current.fetchSuggestions(''); });
    await act(async () => { pending[0].resolve(tip('for first')); });
    expect(result.current.suggestions).toEqual([]);
  });
});
