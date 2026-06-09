import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent, RefObject } from 'react';
import { useDragAngle } from '@/hooks/useDragAngle';

/** A fake <svg> whose getBoundingClientRect is anchored at the viewport origin. */
function makeSvgRef(left = 0, top = 0): RefObject<SVGSVGElement | null> {
  const el = {
    getBoundingClientRect: () => ({ left, top, right: 0, bottom: 0, width: 0, height: 0, x: left, y: top, toJSON() {} }),
  } as unknown as SVGSVGElement;
  return { current: el };
}

/** Minimal pointer event carrying just the client coords the hook reads. */
function pointerAt(clientX: number, clientY: number): PointerEvent<SVGSVGElement> {
  return { clientX, clientY } as PointerEvent<SVGSVGElement>;
}

describe('useDragAngle', () => {
  it('starts not dragging and ignores pointer moves until a pointer-down', () => {
    const onAngleChange = vi.fn();
    const ref = makeSvgRef();
    const { result } = renderHook(() => useDragAngle(ref, 100, onAngleChange));

    expect(result.current.isDragging).toBe(false);
    act(() => result.current.onPointerMove(pointerAt(200, 100)));
    expect(onAngleChange).not.toHaveBeenCalled();
  });

  it('reports atan2(y, x) about the center while dragging', () => {
    const onAngleChange = vi.fn();
    const ref = makeSvgRef();
    const { result } = renderHook(() => useDragAngle(ref, 100, onAngleChange));

    act(() => result.current.onPointerDown());
    expect(result.current.isDragging).toBe(true);

    // (200,100): dx=100, dy=0 → 0 rad (due east)
    act(() => result.current.onPointerMove(pointerAt(200, 100)));
    expect(onAngleChange).toHaveBeenLastCalledWith(0);

    // (100,200): dx=0, dy=100 → +PI/2 (due south, SVG y-down)
    act(() => result.current.onPointerMove(pointerAt(100, 200)));
    expect(onAngleChange).toHaveBeenLastCalledWith(Math.PI / 2);
  });

  it('subtracts the element offset before computing the angle', () => {
    const onAngleChange = vi.fn();
    const ref = makeSvgRef(50, 30); // svg offset within the viewport
    const { result } = renderHook(() => useDragAngle(ref, 100, onAngleChange));

    act(() => result.current.onPointerDown());
    // client (250,130) → local (200,100) → dx=100, dy=0 → 0 rad
    act(() => result.current.onPointerMove(pointerAt(250, 130)));
    expect(onAngleChange).toHaveBeenLastCalledWith(0);
  });

  it('stops reporting once the pointer is released', () => {
    const onAngleChange = vi.fn();
    const ref = makeSvgRef();
    const { result } = renderHook(() => useDragAngle(ref, 100, onAngleChange));

    act(() => result.current.onPointerDown());
    act(() => result.current.onPointerUp());
    expect(result.current.isDragging).toBe(false);

    onAngleChange.mockClear();
    act(() => result.current.onPointerMove(pointerAt(200, 100)));
    expect(onAngleChange).not.toHaveBeenCalled();
  });
});
