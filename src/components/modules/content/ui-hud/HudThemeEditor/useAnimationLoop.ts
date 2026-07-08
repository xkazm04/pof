import { useState, useEffect, useRef } from 'react';

// ── Animation hook ─────────────────────────────────────────────────────────

export function useAnimationLoop(active: boolean): number {
  const [time, setTime] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      setTime((now - startRef.current) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return time;
}
