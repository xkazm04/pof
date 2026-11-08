'use client';

import { StyledSlider } from '@/components/ui/StyledSlider';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { rgbaToHex, hexToRGBA } from './helpers';
import type { RGBA } from './types';

// ── Sub-components ─────────────────────────────────────────────────────────

export function ColorPickerField({ label, value, onChange }: {
  label: string;
  value: RGBA;
  onChange: (c: RGBA) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={rgbaToHex(value)}
        // <input type="color"> carries no alpha: keep the colour's own A (an imported 0.5 stays 0.5).
        onChange={(e) => onChange({ ...hexToRGBA(e.target.value), a: value.a })}
        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent shrink-0"
      />
      <span className="text-2xs text-text-muted flex-1 truncate">{label}</span>
      <span className="text-2xs font-mono text-text-muted shrink-0">{rgbaToHex(value).toUpperCase()}</span>
    </div>
  );
}

export function SliderField({ label, value, min, max, step, unit, onChange, color, decimals }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  color?: string;
  /** Decimal places of the readout; set it to the row's export precision so the label and the .h agree. */
  decimals?: number;
}) {
  const shown = decimals !== undefined
    ? value.toFixed(decimals)
    : Number.isInteger(step) || step >= 1 ? value : value.toFixed(1);
  const displayValue = `${shown}${unit}`;
  return (
    <StyledSlider
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      accentColor={color || ACCENT_CYAN}
      label={label}
      displayValue={displayValue}
    />
  );
}
