import { useRef, useCallback } from 'react';

/**
 * Shared scrub-click logic for timeline lanes.
 * Converts a click position (accounting for scroll) into a time value
 * and calls `onScrub(t)`.
 */
export function useScrubLane(
  totalDuration: number,
  onScrub: (t: number) => void,
  pxPerSec = 40,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(totalDuration, 5);
  const totalWidth = duration * pxPerSec;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
      const t = Math.max(0, Math.min(duration, x / pxPerSec));
      onScrub(t);
    },
    [duration, pxPerSec, onScrub],
  );

  return { containerRef, duration, pxPerSec, totalWidth, handleClick } as const;
}

/** Inline style for the white scrub-position indicator line */
export function scrubLineStyle(scrubTime: number, pxPerSec: number): React.CSSProperties {
  return { left: scrubTime * pxPerSec, backgroundColor: 'white' };
}

/** Class list shared by every scrub line indicator */
export const SCRUB_LINE_CLASS = 'absolute top-0 h-full w-px pointer-events-none z-10';
