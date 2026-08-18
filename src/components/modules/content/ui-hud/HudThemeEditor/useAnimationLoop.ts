import { useState, useEffect, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';

// ── Animation hook ─────────────────────────────────────────────────────────

export function useAnimationLoop(active: boolean): number {
  const [time, setTime] = useState(0);
  // Seconds already animated before the current rAF run. Lives outside the
  // effect so a suspend/resume can pick the clock back up mid-stream.
  const elapsedRef = useRef(0);

  /* Suspend-gated (see `useSuspend.ts`). The module LRU keeps this pane MOUNTED
     while hidden (`display:none`) and the browser only throttles rAF for a
     hidden TAB — so without this gate a hidden HUD theme editor keeps a 60fps
     setState loop running for nobody.

     Pausing is lossless because the clock is an ACCUMULATOR, not a wall-clock
     delta: on pause the cleanup banks the seconds elapsed so far into
     `elapsedRef`, and on resume the run rebases onto the current frame
     timestamp. The returned `time` therefore continues from exactly where it
     stopped rather than jumping forward by the hidden span (which would tear
     the sine-driven previews) or snapping back to zero. No frame is emitted
     while suspended, so there is no mid-frame artefact to resume out of. */
  useSuspendableEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      setTime(elapsedRef.current + (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      elapsedRef.current += (performance.now() - start) / 1000;
      cancelAnimationFrame(raf);
    };
  }, [active]);

  // Toggling the animation OFF still restarts the clock at zero on the next
  // activation — unchanged from before the suspend gate. Only suspension (which
  // never touches `active`) preserves the accumulator. Declared after the loop
  // so this reset runs on the same commit as the cleanup that banked the time.
  useEffect(() => {
    if (!active) elapsedRef.current = 0;
  }, [active]);

  return time;
}
