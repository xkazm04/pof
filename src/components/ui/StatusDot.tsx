'use client';

import type { CSSProperties } from 'react';
import { withOpacity } from '@/lib/chart-colors';

type StatusDotSize = 'xs' | 'sm' | 'md';
type StatusDotEmphasis = 'none' | 'ring' | 'halo';

interface StatusDotProps {
  /** Hex/CSS color for the dot fill. */
  color: string;
  size?: StatusDotSize;
  /**
   * Glow style:
   *  - 'none': flat fill, no shadow
   *  - 'ring': boxShadow `0 0 0 3px ${color}33` — outline halo
   *  - 'halo': boxShadow `0 0 6px ${color}99` — soft glow
   */
  emphasis?: StatusDotEmphasis;
  /** Optional aria-label for screen readers (defaults to title). */
  label?: string;
  /** Optional native title tooltip. */
  title?: string;
  className?: string;
}

const sizeClass: Record<StatusDotSize, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
};

/**
 * Unified status / category dot. Subsumes the 8+ inline `w-2 h-2 rounded-full`
 * implementations across `core-engine/dzin-panels/*` (ui-perfectionist 09.2).
 *
 * Standardizes three sizes (1.5/2/3 px) and three emphasis tiers (none / ring /
 * halo) so adjacent panels render visually consistent dots at the same hierarchy
 * level. Always renders a `flex-shrink-0` `<span>` and forwards `aria-label`.
 */
export function StatusDot({
  color,
  size = 'sm',
  emphasis = 'none',
  label,
  title,
  className = '',
}: StatusDotProps) {
  const style: CSSProperties = { backgroundColor: color };
  if (emphasis === 'ring') {
    style.boxShadow = `0 0 0 3px ${withOpacity(color, '33')}`;
  } else if (emphasis === 'halo') {
    style.boxShadow = `0 0 6px ${withOpacity(color, '99')}`;
  }
  return (
    <span
      role="img"
      aria-label={label ?? title}
      title={title}
      className={`inline-block flex-shrink-0 rounded-full ${sizeClass[size]} ${className}`}
      style={style}
    />
  );
}
