'use client';

import { STATUS_TOKENS, type StatusLevel } from '@/lib/status-token';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /**
   * Render the leading status glyph on a semantic variant (default true). Opt
   * out only where the badge's own text already names the status — the glyph is
   * the non-color cue, so dropping it puts the badge back on hue alone.
   * Ignored by `default`, which carries no status.
   */
  showIcon?: boolean;
  className?: string;
}

/**
 * The three semantic variants are the canonical status ramp under UI names, so
 * their color, background, border, and glyph all resolve from {@link STATUS_TOKENS}
 * rather than a second local hue table that could drift from it.
 *
 * The accessible label is the one thing NOT taken from the token: the ramp's
 * `bad.label` is budget vocabulary ("Over limit"), and a `<Badge variant="error">crash</Badge>`
 * must not announce "Over limit crash". Colour + shape stay single-sourced; the
 * word is stated in Badge's own vocabulary.
 */
const SEMANTIC: Record<Exclude<BadgeVariant, 'default'>, { level: StatusLevel; label: string }> = {
  success: { level: 'ok', label: 'OK' },
  warning: { level: 'warn', label: 'Warning' },
  error: { level: 'bad', label: 'Error' },
};

const BASE = 'inline-flex items-center px-1.5 py-0.5 text-2xs font-medium rounded border';
const DEFAULT_CLASSES = 'text-text-muted bg-surface-hover border-border-bright';

/**
 * Badge — the app's most-used inline status pill.
 *
 * `default` is a neutral chip. The `success` / `warning` / `error` variants are
 * status, so they always pair their color with a distinct glyph and an
 * accessible name (WCAG 1.4.1): a row of bare counts like "12 3 1" reads and
 * announces as three different states, not three identical numbers.
 *
 * The glyph is capped at `w-3 h-3` (12px) — the same size `StatusTag` uses — so
 * it fits inside the 10px `text-2xs` line box without growing the dense strips
 * (EconomyRunsStrip, CallstackCard) that pack these badges into a single row.
 */
export function Badge({ children, variant = 'default', showIcon = true, className = '' }: BadgeProps) {
  if (variant === 'default') {
    return <span className={`${BASE} ${DEFAULT_CLASSES} ${className}`}>{children}</span>;
  }

  const { level, label } = SEMANTIC[variant];
  const token = STATUS_TOKENS[level];
  const Icon = token.Icon;

  return (
    <span
      data-status={level}
      className={`${BASE} gap-1 ${className}`}
      style={{ color: token.color, backgroundColor: token.bg, borderColor: token.border }}
    >
      {showIcon && (
        <Icon role="img" aria-label={label} className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
      )}
      {children}
    </span>
  );
}
