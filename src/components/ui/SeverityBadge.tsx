'use client';

import type { FindingSeverity } from '@/types/game-director';
import { SEVERITY_TOKENS, type SemanticDensity } from '@/lib/game-director-styles';
import { withOpacity, OPACITY_15, OPACITY_20 } from '@/lib/chart-colors';

interface SeverityBadgeProps {
  severity: FindingSeverity;
  /** `default` (15% bg) for inline labels, `dense` (20% bg) for emphasis. */
  density?: SemanticDensity;
  /** Show the leading severity icon (default: true). */
  showIcon?: boolean;
  /** Override label (default: capitalized severity name). */
  label?: string;
  /** Render label in uppercase tracking-wider (for alert headers). */
  upper?: boolean;
  className?: string;
}

/**
 * Semantic severity chip — single source of truth for finding-severity colors.
 * Replaces the four parallel maps in DirectorOverview / SessionDetail /
 * FindingsExplorer / RegressionTrackerView with one token-driven primitive.
 * Token lookup in `@/lib/game-director-styles` (`SEVERITY_TOKENS`).
 */
export function SeverityBadge({
  severity,
  density = 'default',
  showIcon = true,
  label,
  upper = false,
  className = '',
}: SeverityBadgeProps) {
  const token = SEVERITY_TOKENS[severity];
  const Icon = token.icon;
  const opacity = density === 'dense' ? OPACITY_20 : OPACITY_15;
  const labelClass = upper ? 'uppercase tracking-wider font-bold' : 'font-medium';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs ${labelClass} ${className}`}
      style={{ color: token.color, backgroundColor: withOpacity(token.color, opacity) }}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {label ?? token.label}
    </span>
  );
}
