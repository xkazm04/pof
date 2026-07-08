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
        onChange={(e) => onChange(hexToRGBA(e.target.value))}
        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent shrink-0"
      />
      <span className="text-2xs text-text-muted flex-1 truncate">{label}</span>
      <span className="text-2xs font-mono text-text-muted shrink-0">{rgbaToHex(value).toUpperCase()}</span>
    </div>
  );
}

export function SliderField({ label, value, min, max, step, unit, onChange, color }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  color?: string;
}) {
  const displayValue = `${Number.isInteger(step) || step >= 1 ? value : value.toFixed(1)}${unit}`;
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
