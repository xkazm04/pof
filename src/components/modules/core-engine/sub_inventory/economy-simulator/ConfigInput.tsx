'use client';

import { useId } from 'react';

/* ── Config Input ─────────────────────────────────────────────────────── */

const INPUT_CLS =
  'w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset';

/**
 * Parse a typed value into the field's range. Above max clamps to max (the sim runs
 * synchronously on the main thread, so an unbounded count freezes the tab); empty,
 * zero or negative falls back to min. A positive value below min is kept so a
 * multi-digit entry can still be typed digit by digit.
 */
function toBounded(raw: string, min: number, max: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return min;
  return Math.min(n, max);
}

export function ConfigInput({ label, value, onChange, min, max, step, wide }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; wide?: boolean;
}) {
  // The visible caption is the field's programmatic label — screen readers
  // otherwise announce these as unnamed spinbuttons.
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5"
      >
        {label}
      </label>
      <input
        id={id}
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(toBounded(e.target.value, min, max))}
        className={wide ? 'w-20 ' + INPUT_CLS.replace('w-16 ', '') : INPUT_CLS}
      />
    </div>
  );
}
