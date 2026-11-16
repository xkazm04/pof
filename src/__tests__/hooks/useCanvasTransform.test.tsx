import type { PointerEvent, WheelEvent } from 'react';
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

describe('useCanvasTransform wheel during a drag', () => {
  it('continues the pan from the zoomed position instead of snapping back', () => {
    const { result } = renderHook(() => useCanvasTransform());
    const ptr = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, target: {} }) as unknown as PointerEvent<Element>;
    act(() => result.current.startPan(ptr(0, 0)));
    act(() => result.current.onPointerMove(ptr(10, 0)));
    act(() => result.current.onWheel(wheel(-100)));
    const zoomed = result.current.transform;
    expect(zoomed.panX).not.toBe(10);
    act(() => result.current.onPointerMove(ptr(20, 0)));
    expect(result.current.transform.panX).toBeCloseTo(zoomed.panX + 10);
    expect(result.current.transform.zoom).toBeCloseTo(zoomed.zoom);
  });
});
