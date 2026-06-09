'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/lib/motion';
import { withOpacity, OPACITY_50, OPACITY_25 } from '@/lib/chart-colors';

interface RipplePulseProps {
  /**
   * Pulse fires whenever this value changes (the initial mount is skipped).
   * Pass a stable signature of the upstream state, not an object identity that
   * churns on every render, or the panel will strobe.
   */
  trigger: string | number;
  /** Ring color. */
  color: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a panel and emits a brief (~250ms) ring-pulse whenever `trigger`
 * changes, drawing a visual thread from an upstream control to its downstream
 * effect. The ring is an inset, pointer-events-none overlay so it never shifts
 * layout or intercepts clicks. Honors prefers-reduced-motion (no pulse).
 */
export function RipplePulse({ trigger, color, children, className }: RipplePulseProps) {
  const prefersReduced = useReducedMotion();
  const ringOpacity = useMotionValue(0);
  const isFirst = useRef(true);

  useEffect(() => {
    // Don't pulse on first mount — only on genuine downstream changes.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (prefersReduced) return;
    ringOpacity.set(0.9);
    const controls = animate(ringOpacity, 0, { duration: 0.25, ease: EASE_OUT });
    return () => controls.stop();
  }, [trigger, prefersReduced, ringOpacity]);

  return (
    <div className={`relative ${className ?? ''}`}>
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{
          opacity: ringOpacity,
          boxShadow: `inset 0 0 0 2px ${withOpacity(color, OPACITY_50)}, inset 0 0 16px 0 ${withOpacity(color, OPACITY_25)}`,
        }}
      />
    </div>
  );
}
