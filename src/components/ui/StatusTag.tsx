'use client';

import type { CSSProperties } from 'react';
import { STATUS_TOKENS, type StatusLevel } from '@/lib/status-token';

interface StatusTagProps {
  /** Ramp level — drives color, glyph, and accessible label. */
  level: StatusLevel;
  /** Override the word (default token.word, e.g. budget counts or domain labels). */
  word?: string;
  /** Show the leading glyph (default true) — the non-color shape cue. */
  showIcon?: boolean;
  /** Show the word text (default true). */
  showWord?: boolean;
  /** Extra classes on the badge span. */
  className?: string;
  /** Style overrides merged after the token's color/bg/border. */
  style?: CSSProperties;
  /** Icon size classes (default `w-3 h-3`). */
  iconClassName?: string;
}

/**
 * Colorblind-safe status badge — a single primitive that always renders the
 * status glyph beside its word, both tinted from the shared {@link STATUS_TOKENS}.
 * Use it anywhere a bare color currently carries OVER / WARN / OK meaning so the
 * status reads by shape + icon + text, not hue alone (WCAG 1.4.1).
 */
export function StatusTag({
  level,
  word,
  showIcon = true,
  showWord = true,
  className = '',
  style,
  iconClassName = 'w-3 h-3',
}: StatusTagProps) {
  const token = STATUS_TOKENS[level];
  const Icon = token.Icon;
  const label = word ?? token.word;
  return (
    <span
      data-status={level}
      aria-label={token.label}
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.15em] ${className}`}
      style={{ color: token.color, backgroundColor: token.bg, border: `1px solid ${token.border}`, ...style }}
    >
      {showIcon && <Icon aria-hidden className={`${iconClassName} flex-shrink-0`} strokeWidth={2.5} />}
      {showWord && label}
    </span>
  );
}
