import type { WheelEvent } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCanvasTransform } from '@/hooks/useCanvasTransform';

afterEach(cleanup);

const wheel = (deltaY: number, deltaX = 0) => ({
  deltaX, deltaY, clientX: 50, clientY: 50, preventDefault: vi.fn(),
  currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
}) as unknown as WheelEvent;

describe('useCanvasTransform wheel', () => {
  it('a purely horizontal wheel does not zoom', () => {
    const { result } = renderHook(() => useCanvasTransform());
    act(() => result.current.onWheel(wheel(0, 40)));
    expect(result.current.transform.zoom).toBe(1);
  });

  it('vertical wheel still zooms both ways', () => {
    const { result } = renderHook(() => useCanvasTransform());
    act(() => result.current.onWheel(wheel(-100)));
    expect(result.current.transform.zoom).toBeCloseTo(1.1);
    act(() => result.current.onWheel(wheel(100)));
    expect(result.current.transform.zoom).toBeCloseTo(0.99);
  });
});
