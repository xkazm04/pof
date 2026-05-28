'use client';

import type { LucideIcon } from 'lucide-react';
import type { SemanticDensity, SemanticToken } from '@/lib/game-director-styles';
import { withOpacity, OPACITY_15, OPACITY_20 } from '@/lib/chart-colors';

interface StatusChipProps {
  /** Resolved token (color + label + icon). Use SESSION_STATUS_TOKENS / REGRESSION_STATUS_TOKENS lookup. */
  token: SemanticToken;
  /** `default` (15% bg) for ambient labels, `dense` (20% bg) for emphasis. */
  density?: SemanticDensity;
  /** Show the leading icon from the token (default: false — chips stay compact). */
  showIcon?: boolean;
  /** Override label rendered (default: `token.label`). */
  label?: string;
  /** Override icon used (default: `token.icon`). */
  icon?: LucideIcon;
  /** Capitalize the label visually (does not change the underlying string). */
  capitalize?: boolean;
  className?: string;
}

/**
 * Semantic status chip — pair to {@link SeverityBadge} for non-severity status
 * values (playtest-session lifecycle, regression-fingerprint lifecycle).
 * Driven by tokens in `@/lib/game-director-styles`.
 */
export function StatusChip({
  token,
  density = 'default',
  showIcon = false,
  label,
  icon,
  capitalize = false,
  className = '',
}: StatusChipProps) {
  const Icon = icon ?? token.icon;
  const opacity = density === 'dense' ? OPACITY_20 : OPACITY_15;
  const capClass = capitalize ? 'capitalize' : '';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium ${capClass} ${className}`}
      style={{ color: token.color, backgroundColor: withOpacity(token.color, opacity) }}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {label ?? token.label}
    </span>
  );
}
