'use client';

import { useState, type CSSProperties } from 'react';

interface NumberFieldProps {
  /** Committed numeric value. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /**
   * Value to commit when the field is left empty or non-numeric on blur.
   * Defaults to `min`. Pass the current `value` to revert to the previous
   * valid value instead of resetting to the minimum.
   */
  fallback?: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
  /** Inline style — e.g. a `--focus-accent` region color or text glow. */
  style?: CSSProperties;
  id?: string;
  disabled?: boolean;
}

/**
 * Numeric input that edits a raw string and only validates/clamps on blur
 * (or Enter) — never per keystroke. This lets the user clear the field or type
 * a partial number without it snapping back to a fallback or yielding NaN
 * mid-edit. On commit, the raw text is parsed, clamped to `[min, max]` (or reset
 * to `fallback`/`min` when empty/invalid), pushed up via `onChange`, and the
 * displayed text is normalized to the committed value.
 *
 * Exposes `aria-valuemin` / `aria-valuemax` / `aria-valuenow` (alongside the
 * native `min`/`max`) so assistive tech announces the valid range.
 */
export function NumberField({
  value,
  min,
  max,
  onChange,
  fallback,
  step = 1,
  ariaLabel,
  className = '',
  style,
  id,
  disabled,
}: NumberFieldProps) {
  const [raw, setRaw] = useState(() => String(value));
  // Track the last committed value so an external change (e.g. Reset) re-syncs
  // the raw text during render — no effect, no set-state-in-effect lint issue.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setRaw(String(value));
  }

  const commit = () => {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    const next =
      trimmed === '' || Number.isNaN(parsed)
        ? fallback ?? min
        : Math.max(min, Math.min(max, parsed));
    // Normalize the visible text to the committed value (drops invalid input).
    setRaw(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      role="spinbutton"
      min={min}
      max={max}
      step={step}
      value={raw}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={className}
      style={style}
    />
  );
}
