'use client';

import type { CSSProperties, ReactNode } from 'react';

/** De-emphasis tier → AA-compliant color token (never an opacity-dimmed muted hack). */
const TONE_CLASS = {
  /** Quietest readable tier — `--text-subtle`, still ≥4.5:1 AA. The default. */
  subtle: 'text-text-subtle',
  /** Standard secondary tier — full-strength `--text-muted`. */
  muted: 'text-text-muted',
} as const;

export type MicroLabelTone = keyof typeof TONE_CLASS;

interface MicroLabelProps {
  children: ReactNode;
  /** De-emphasis tier (default `subtle`). Both tiers clear WCAG AA contrast. */
  tone?: MicroLabelTone;
  /** Render monospace — for IDs, counts, badge codes, diagram labels. */
  mono?: boolean;
  /** Uppercase + slight tracking — for eyebrow/badge labels. */
  uppercase?: boolean;
  /** Element to render (default `span`). */
  as?: 'span' | 'div' | 'p';
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-hidden'?: boolean;
}

/**
 * The shared de-emphasized micro-text primitive. Two guarantees, in one place, so
 * the WCAG fix lands once for every caller:
 *
 *   1. **Size floor.** Always renders at `text-xs` (12px) — the legible floor from
 *      {@link TEXT_SCALE}. It never drops to `text-[9px]`/`text-[10px]`/`text-2xs`,
 *      which is what these labels used to do.
 *   2. **AA color.** Color comes from a tier token (`--text-subtle` / `--text-muted`),
 *      both of which clear 4.5:1 on the dark app and the lab Blueprint/Studio themes —
 *      replacing the old `text-text-muted/40–/70` opacity hacks that fell below AA.
 *
 * Use it for breadcrumb separators, badge codes, captions, and any other small
 * de-emphasized label instead of hand-rolling a muted-plus-tiny `<span>`.
 */
export function MicroLabel({
  children,
  tone = 'subtle',
  mono = false,
  uppercase = false,
  as: Tag = 'span',
  className = '',
  style,
  title,
  'aria-hidden': ariaHidden,
}: MicroLabelProps) {
  const classes = [
    'text-xs', // 12px floor — never smaller
    TONE_CLASS[tone],
    mono && 'font-mono',
    uppercase && 'uppercase tracking-wide',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} style={style} title={title} aria-hidden={ariaHidden}>
      {children}
    </Tag>
  );
}
