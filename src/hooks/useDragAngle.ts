'use client';

import {
  useState, useCallback, useEffect,
  type RefObject, type PointerEvent,
} from 'react';

/**
 * Pointer handlers + drag state for a "drag-to-rotate" forward-vector control,
 * extracted from the verbatim duplication in FlankAngleHeatmap and
 * SquadChoreographyEditor. Pointer position is converted to an angle (radians,
 * standard SVG convention: 0 = +x/east) about the SVG center via `Math.atan2`.
 *
 * The hook owns only the `isDragging` flag and the pointer math; where the
 * resulting angle is stored is the caller's concern, reported through
 * `onAngleChange`. Pass a stable callback (a setter or a `useCallback`) — it is
 * read on every drag move.
 *
 * The drag survives the pointer leaving the SVG: `onPointerDown` captures the
 * pointer (`setPointerCapture`) so move/up events keep routing through the SVG
 * even outside its bounds, and a window-level `pointerup`/`pointercancel`
 * listener guarantees the drag ends on release anywhere — the gesture never
 * silently sticks or drops mid-rotation. Do NOT wire `onPointerLeave` to
 * `onPointerUp`; that would end the drag the moment the pointer exits.
 *
 * Spread the returned handlers onto the draggable `<svg>` (move/up) and wire
 * `onPointerDown` to the drag handle:
 *
 *   const svgRef = useRef<SVGSVGElement>(null);
 *   const drag = useDragAngle(svgRef, SVG_CENTER, setForwardAngle);
 *   <svg ref={svgRef} onPointerMove={drag.onPointerMove}
 *        onPointerUp={drag.onPointerUp}>
 *     <circle onPointerDown={drag.onPointerDown} … />
 */
export interface DragAngle {
  /** True while a drag is in progress (between pointer-down and pointer-up). */
  isDragging: boolean;
  /** Begin a drag — wire to the drag handle's `onPointerDown`. */
  onPointerDown: (e?: PointerEvent<Element>) => void;
  /** Update the angle while dragging — wire to the svg's `onPointerMove`. */
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void;
  /** End a drag — wire to the svg's `onPointerUp`. */
  onPointerUp: () => void;
}

export function useDragAngle(
  svgRef: RefObject<SVGSVGElement | null>,
  center: number,
  onAngleChange: (angle: number) => void,
): DragAngle {
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e?: PointerEvent<Element>) => {
    // Capture the pointer so the gesture keeps tracking (and terminates
    // cleanly) even when the pointer exits the small SVG mid-drag.
    if (e) {
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // Capture is best-effort (unavailable in some test environments);
        // the window-level pointerup fallback below still ends the drag.
      }
    }
    setIsDragging(true);
  }, []);
  const onPointerUp = useCallback(() => setIsDragging(false), []);

  // Safety net: however the gesture ends (release outside the SVG, OS-level
  // cancel, capture lost), the drag state is cleared on the next pointer-up.
  useEffect(() => {
    if (!isDragging) return;
    const end = () => setIsDragging(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [isDragging]);

  const onPointerMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!isDragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - center;
      const y = e.clientY - rect.top - center;
      onAngleChange(Math.atan2(y, x));
    },
    [isDragging, svgRef, center, onAngleChange],
  );

  return { isDragging, onPointerDown, onPointerMove, onPointerUp };
}
