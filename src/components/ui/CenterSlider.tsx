'use client';

import { type CSSProperties } from 'react';
import { ACCENT_EMERALD, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

interface CenterSliderProps {
  /** Current value, in the same unit as `min`/`max`/`neutral` (e.g. percent). */
  value: number;
  min: number;
  max: number;
  /** Neutral anchor the fill grows outward from (default 100). */
  neutral?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** Color for values above neutral (buffs). Defaults to emerald. */
  buffColor?: string;
  /** Color for values below neutral (nerfs). Defaults to rose. */
  nerfColor?: string;
  /** Format the signed delta readout. Receives `value - neutral`. */
  formatDelta?: (delta: number) => string;
  className?: string;
  id?: string;
}

const clampPct = (n: number) => Math.min(Math.max(n, 0), 100);

const defaultFormatDelta = (delta: number) => `${delta > 0 ? '+' : ''}${delta}%`;

/**
 * Center-anchored range slider for buff/nerf tuning. Unlike a bare
 * `<input type="range">`, the neutral point is a visible anchor: a tick marks
 * `neutral`, and a colored fill grows *out from that anchor* toward the thumb —
 * emerald to the right for buffs (value > neutral), rose to the left for nerfs
 * (value < neutral). The readout shows the signed delta from neutral (e.g.
 * `+35%` / `-20%`) in tabular-nums rather than the raw value, so the direction
 * and magnitude of a change are legible at a glance. The thumb scales up while
 * dragging/focused (see `.center-slider` in globals.css) for tactile feedback.
 */
export function CenterSlider({
  value,
  min,
  max,
  neutral = 100,
  step = 1,
  onChange,
  ariaLabel,
  buffColor = ACCENT_EMERALD,
  nerfColor = STATUS_ERROR,
  formatDelta = defaultFormatDelta,
  className = '',
  id,
}: CenterSliderProps) {
  const span = max - min;
  const toPct = (n: number) => (span > 0 ? clampPct(((n - min) / span) * 100) : 0);

  const neutralPct = toPct(neutral);
  const valuePct = toPct(value);
  const delta = value - neutral;
  const dirColor = value > neutral ? buffColor : value < neutral ? nerfColor : STATUS_NEUTRAL;
  const deltaText = formatDelta(delta);

  // Fill spans between the neutral anchor and the current value.
  const fillLeft = Math.min(neutralPct, valuePct);
  const fillWidth = Math.abs(valuePct - neutralPct);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1 h-4 flex items-center">
        {/* Base track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-surface-deep" />
        {/* Center-origin fill — grows out from the neutral anchor toward the thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-[width,left] duration-150"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, backgroundColor: dirColor }}
        />
        {/* Neutral tick */}
        <div
          className="absolute top-1/2 w-0.5 h-3 rounded-full bg-text-muted"
          style={{ left: `${neutralPct}%`, transform: 'translate(-50%, -50%)' }}
          aria-hidden="true"
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          aria-valuetext={deltaText}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--center-thumb': dirColor } as CSSProperties}
          className="center-slider absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full h-1.5"
        />
      </div>
      <span
        className="text-2xs font-mono tabular-nums w-12 text-right flex-shrink-0 text-text-muted"
        style={delta === 0 ? undefined : { color: dirColor }}
      >
        {deltaText}
      </span>
    </div>
  );
}
