/** useScrollRestoration restores each tab's own scrollTop when the active tab changes. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useScrollRestoration', () => {
  it('captures the outgoing tab offset and restores it on return; a new tab starts at 0', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 0; });
    const { result, rerender } = renderHook(({ tab }) => useScrollRestoration<'a' | 'b'>(tab), { initialProps: { tab: 'a' as 'a' | 'b' } });
    const el = document.createElement('div');
    result.current.scrollRef.current = el;
    el.scrollTop = 120;
    act(() => result.current.captureScroll());
    rerender({ tab: 'b' });
    expect(el.scrollTop).toBe(0);
    el.scrollTop = 40;
    act(() => result.current.captureScroll());
    rerender({ tab: 'a' });
    expect(el.scrollTop).toBe(120);
    rerender({ tab: 'b' });
    expect(el.scrollTop).toBe(40);
  });
});
