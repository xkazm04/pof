'use client';

import { useState, type ReactNode } from 'react';

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Track + thumb color; derived from the calling module's accent. */
  accent: string;
  onChange: (value: number) => void;
  /** Tick labels rendered in a justify-between row beneath the track (e.g. Fast / Steep). */
  ticks?: ReactNode[];
  /** Format the on-drag/focus value bubble. Defaults to `String(value)`. */
  formatValue?: (value: number) => string;
  /** Accessible name for the slider. */
  ariaLabel?: string;
  title?: string;
  id?: string;
  className?: string;
}

/**
 * Themed range-input primitive shared across tuning panels. Unlike a bare
 * `<input type="range">`, it:
 *   - derives its track + thumb color from an `accent` prop (no hardcoded color),
 *   - surfaces a value bubble above the thumb while dragging or keyboard-focused,
 *   - renders optional tick labels, and
 *   - carries the shared `.focus-ring` for a visible keyboard focus state.
 *
 * Sizing/motion live here so every call site shares one polished control.
 */
export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  accent,
  onChange,
  ticks,
  formatValue,
  ariaLabel,
  title,
  id,
  className = '',
}: RangeSliderProps) {
  const [active, setActive] = useState(false);

  // Guard the divisor so an unconfigured min === max never yields a NaN offset.
  const span = max - min;
  const pct = span > 0 ? Math.min(Math.max(((value - min) / span) * 100, 0), 100) : 0;
  const bubbleText = formatValue ? formatValue(value) : String(value);

  return (
    <div className={`relative ${className}`}>
      {active && (
        <div
          data-testid="range-slider-bubble"
          className="absolute -top-7 z-10 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-xs font-mono font-bold text-white shadow-md pointer-events-none whitespace-nowrap"
          style={{ left: `${pct}%`, backgroundColor: accent }}
        >
          {bubbleText}
        </div>
      )}

      <input
        id={id}
        title={title}
        aria-label={ariaLabel}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        className="w-full h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer focus-ring"
        style={{ accentColor: accent }}
      />

      {ticks && ticks.length > 0 && (
        <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1.5">
          {ticks.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
