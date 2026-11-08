import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRovingFocus } from '@/components/layout-lab/hooks/useRovingFocus';

afterEach(cleanup);

describe('useRovingFocus follows the externally selected index', () => {
  it('moves the tab-stop when `initial` changes, and still lets arrows move it afterwards', () => {
    const { result, rerender } = renderHook(({ sel }) => useRovingFocus(5, sel, vi.fn()), { initialProps: { sel: 1 } });
    expect(result.current.itemProps(1).tabIndex).toBe(0);

    rerender({ sel: 3 });
    expect(result.current.active).toBe(3);
    expect(result.current.itemProps(3).tabIndex).toBe(0);
    expect(result.current.itemProps(1).tabIndex).toBe(-1);

    act(() => result.current.setActive(0)); // a keyboard move is not undone by an unchanged selection
    rerender({ sel: 3 });
    expect(result.current.active).toBe(0);
  });
});
