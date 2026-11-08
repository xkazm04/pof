/** useSuspendableSelector is documented as a drop-in for zustand's useStore(selector). */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useSuspendableSelector } from '@/hooks/useSuspend';
import { create } from 'zustand';

afterEach(cleanup);

describe('useSuspendableSelector', () => {
  it('reads the new key in the render where a closure selector changes', () => {
    const store = create<{ values: Record<string, number> }>(() => ({ values: { a: 1, b: 2 } }));
    const { result, rerender } = renderHook(
      ({ key }) => useSuspendableSelector(store, (s) => s.values[key]),
      { initialProps: { key: 'a' } },
    );
    expect(result.current).toBe(1);
    rerender({ key: 'b' });
    expect(result.current).toBe(2);
  });
});
