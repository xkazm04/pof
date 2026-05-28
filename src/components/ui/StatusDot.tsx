'use client';

import type { CSSProperties } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import {
  withOpacity,
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_WARNING,
  STATUS_INFO,
  STATUS_NEUTRAL,
} from '@/lib/chart-colors';

type StatusDotSize = 'xs' | 'sm' | 'md' | 'lg';
type StatusDotEmphasis = 'none' | 'ring' | 'halo';

/**
 * Semantic status states. When provided via the `state` prop, the dot
 * auto-derives color, an inset glyph (Check / X / AlertTriangle), an
 * aria-label, and a pulsing ring for `progress` — so state is conveyed by
 * shape + icon, not only hue (WCAG 1.4.1).
 */
export type StatusDotState = 'ok' | 'fail' | 'warn' | 'progress' | 'pending' | 'idle';

interface StatusDotProps {
  /** Semantic state — auto-derives color, glyph, pulse, and aria-label. */
  state?: StatusDotState;
  /** Hex/CSS color override. Required if `state` is not provided. */
  color?: string;
  size?: StatusDotSize;
  /**
   * Glow style:
   *  - 'none': flat fill, no shadow
   *  - 'ring': boxShadow `0 0 0 3px ${color}33` — outline halo
   *  - 'halo': boxShadow `0 0 6px ${color}99` — soft glow
   */
  emphasis?: StatusDotEmphasis;
  /** Override the auto-derived aria-label (defaults to state label or title). */
  label?: string;
  /** Optional native title tooltip. */
  title?: string;
  className?: string;
}

const sizeClass: Record<StatusDotSize, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
};

/** Glyph dimension expressed as a CSS calc fraction of the dot. */
const GLYPH_SCALE = 0.7;

type GlyphComponent = typeof Check;

const stateConfig: Record<
  StatusDotState,
  { color: string; Glyph: GlyphComponent | null; label: string; pulse: boolean }
> = {
  ok: { color: STATUS_SUCCESS, Glyph: Check, label: 'OK', pulse: false },
  fail: { color: STATUS_ERROR, Glyph: X, label: 'Failed', pulse: false },
  warn: { color: STATUS_WARNING, Glyph: AlertTriangle, label: 'Warning', pulse: false },
  progress: { color: STATUS_INFO, Glyph: null, label: 'In progress', pulse: true },
  pending: { color: STATUS_NEUTRAL, Glyph: null, label: 'Pending', pulse: false },
  idle: { color: STATUS_NEUTRAL, Glyph: null, label: 'Idle', pulse: false },
};

/**
 * Unified status / category dot. Subsumes the inline `w-2 h-2 rounded-full`
 * implementations across `core-engine/dzin-panels/*` (ui-perfectionist 09.2)
 * AND the color-only status dots in `project-setup/StatusChecklist`,
 * `LiveCodingPanel` history, and detected-project badges.
 *
 * Two render modes:
 *  - **Semantic** (`state="ok" | "fail" | "warn" | "progress" | ...`): color,
 *    glyph, aria-label, and pulse are derived from the state — state is
 *    conveyed by shape + icon, not only hue (WCAG 1.4.1).
 *  - **Color-only** (`color="#..."`): legacy category-dot usage with no glyph.
 *
 * Always renders a `flex-shrink-0` `<span>` with `role="img"` and an
 * `aria-label`. The inset glyph is sized to ~70% of the dot and rendered
 * with `strokeWidth={3}` for legibility at small sizes; it auto-hides on
 * `xs`/`sm` where it would be illegible — the aria-label still announces.
 */
export function StatusDot({
  state,
  color: colorOverride,
  size = 'sm',
  emphasis = 'none',
  label,
  title,
  className = '',
}: StatusDotProps) {
  const config = state ? stateConfig[state] : null;
  const color = colorOverride ?? config?.color ?? STATUS_NEUTRAL;
  const Glyph = config?.Glyph ?? null;
  const showGlyph = Glyph !== null && (size === 'md' || size === 'lg');
  const pulse = config?.pulse ?? false;
  const ariaLabel = label ?? title ?? config?.label;

  const style: CSSProperties = { backgroundColor: color };
  if (emphasis === 'ring') {
    style.boxShadow = `0 0 0 3px ${withOpacity(color, '33')}`;
  } else if (emphasis === 'halo') {
    style.boxShadow = `0 0 6px ${withOpacity(color, '99')}`;
  } else if (pulse) {
    // Pulsing outline ring for in-progress states — visible motion cue beyond color.
    style.boxShadow = `0 0 0 2px ${withOpacity(color, '66')}`;
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={title}
      className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-full ${sizeClass[size]} ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={style}
    >
      {showGlyph && Glyph && (
        <Glyph
          aria-hidden="true"
          strokeWidth={3}
          className="text-white"
          style={{ width: `${GLYPH_SCALE * 100}%`, height: `${GLYPH_SCALE * 100}%` }}
        />
      )}
    </span>
  );
}
