/** useDebouncedValue holds the old value until the input has been quiet for delayMs. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useDebouncedValue', () => {
  it('updates only after delayMs of no change, and a newer value restarts the wait', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), { initialProps: { v: 1 } });
    expect(result.current).toBe(1);
    rerender({ v: 2 });
    act(() => { vi.advanceTimersByTime(99); });
    expect(result.current).toBe(1);
    rerender({ v: 3 });
    act(() => { vi.advanceTimersByTime(99); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(3);
  });
});
