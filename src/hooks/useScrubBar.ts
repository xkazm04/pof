import { useRef, useCallback, useEffect } from 'react';

/**
 * Reusable drag-scrub hook for timeline bars.
 * Converts mouse drag position to a time value within [0, totalTime]
 * and calls `onScrub(t)` on mousedown + mousemove.
 */
export function useScrubBar(totalTime: number, onScrub: (t: number) => void) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleInteraction = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(pct * totalTime);
  }, [totalTime, onScrub]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleInteraction(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleInteraction]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    handleInteraction(e.clientX);
  }, [handleInteraction]);

  return { barRef, onMouseDown } as const;
}
