'use client';

import { useState, useCallback, type RefObject, type PointerEvent } from 'react';

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
 * Spread the returned handlers onto the draggable `<svg>` (move/up/leave) and
 * wire `onPointerDown` to the drag handle:
 *
 *   const svgRef = useRef<SVGSVGElement>(null);
 *   const drag = useDragAngle(svgRef, SVG_CENTER, setForwardAngle);
 *   <svg ref={svgRef} onPointerMove={drag.onPointerMove}
 *        onPointerUp={drag.onPointerUp} onPointerLeave={drag.onPointerUp}>
 *     <circle onPointerDown={drag.onPointerDown} … />
 */
export interface DragAngle {
  /** True while a drag is in progress (between pointer-down and pointer-up). */
  isDragging: boolean;
  /** Begin a drag — wire to the drag handle's `onPointerDown`. */
  onPointerDown: () => void;
  /** Update the angle while dragging — wire to the svg's `onPointerMove`. */
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void;
  /** End a drag — wire to the svg's `onPointerUp` / `onPointerLeave`. */
  onPointerUp: () => void;
}

export function useDragAngle(
  svgRef: RefObject<SVGSVGElement | null>,
  center: number,
  onAngleChange: (angle: number) => void,
): DragAngle {
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(() => setIsDragging(true), []);
  const onPointerUp = useCallback(() => setIsDragging(false), []);

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
