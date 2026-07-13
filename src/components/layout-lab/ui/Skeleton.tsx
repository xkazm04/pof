import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** Reduced-motion: render a static muted fill instead of the animated shimmer. */
  reduce?: boolean;
  circle?: boolean;
  style?: CSSProperties;
}

/**
 * Loading-state shimmer block for the lab's hydration skeletons. Decorative, so it
 * is `aria-hidden` (the surrounding region owns the busy semantics). Under reduced
 * motion it drops the `lab-shimmer` animation for a static muted fill (the global
 * `prefers-reduced-motion` rule also neutralizes the keyframe — belt and braces).
 */
export function Skeleton({ width = '100%', height = 12, radius = 4, reduce, circle, style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      data-testid="lab-skeleton"
      className={reduce ? undefined : 'lab-shimmer'}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: circle ? '50%' : radius,
        background: reduce ? 'var(--lab-line)' : undefined,
        ...style,
      }}
    />
  );
}
