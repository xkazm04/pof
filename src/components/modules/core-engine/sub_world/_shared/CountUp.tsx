'use client';

import { useEffect, useState } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/lib/motion';

interface CountUpProps {
  /** Target value to animate toward. Animates from the previous value. */
  value: number;
  /** Animation duration in seconds. */
  durationS?: number;
  className?: string;
  /** Optional formatter for the rounded display value. */
  format?: (n: number) => string;
}

/**
 * Animates an integer counting up (or down) toward `value`, easing from
 * whatever it currently shows. Honors prefers-reduced-motion by rendering the
 * target instantly. Keep it for small, glanceable counters (badge tallies);
 * it rounds to whole numbers on each frame.
 */
export function CountUp({ value, durationS = 0.4, className, format }: CountUpProps) {
  const prefersReduced = useReducedMotion();
  const motionVal = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced) return;
    // `animate` continues from the motion value's current position, so a value
    // change mid-animation re-targets smoothly instead of snapping.
    const controls = animate(motionVal, value, {
      duration: durationS,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, durationS, prefersReduced, motionVal]);

  const shown = Math.round(prefersReduced ? value : display);
  return <span className={className}>{format ? format(shown) : shown}</span>;
}
