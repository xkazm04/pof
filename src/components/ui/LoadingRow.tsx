'use client';

import { Loader2 } from 'lucide-react';

interface LoadingRowProps {
  /** Text shown beside the spinner (e.g. "Loading patterns…"). */
  label: string;
  /** Accent colour for the spinner (defaults to the muted text token). */
  color?: string;
  /** Vertical padding treatment. `block` centers in a tall region; `inline` is compact. */
  variant?: 'block' | 'inline';
  className?: string;
}

/**
 * Single source for the "spinner + label" loading indicator used across module
 * dashboards. Previously every view hand-rolled its own spinner markup and copy,
 * so treatments drifted (different sizes, colours, and none announced to AT).
 *
 * Renders `role="status"` + `aria-live="polite"` so screen readers announce the
 * load, and honours `prefers-reduced-motion` via the global rule that neutralises
 * `animate-spin`.
 */
export function LoadingRow({ label, color, variant = 'block', className = '' }: LoadingRowProps) {
  const wrapper =
    variant === 'block'
      ? 'flex items-center justify-center py-16'
      : 'flex items-center gap-2';
  return (
    <div className={`${wrapper} ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: color ?? 'var(--text-muted)' }} aria-hidden />
      <span className={`${variant === 'block' ? 'ml-3 ' : ''}text-sm text-text-muted`}>{label}</span>
    </div>
  );
}
