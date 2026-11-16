'use client';

import { useId } from 'react';
import { ACCENT_CYAN } from '@/lib/chart-colors';

interface StyledSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  accentColor?: string;
  label?: string;
  displayValue?: string;
  /** Accessible name when the caller draws its own label instead of passing `label`. */
  ariaLabel?: string;
  /** data-testid for the underlying input */
  testId?: string;
}

/**
 * Shared range-input slider with consistent webkit-slider-thumb styling.
 * Encapsulates track height (h-1.5), thumb size (w-3 h-3), and accent color.
 */
export function StyledSlider({
  min,
  max,
  step,
  value,
  onChange,
  accentColor,
  label,
  displayValue,
  ariaLabel,
  testId,
}: StyledSliderProps) {
  const color = accentColor || ACCENT_CYAN;
  const labelId = useId();

  return (
    <div className="space-y-0.5">
      {(label || displayValue) && (
        <div className="flex items-center justify-between">
          {label && <span id={labelId} className="text-xs text-text-muted">{label}</span>}
          {displayValue && (
            <span className="text-xs font-mono font-bold" style={{ color }}>
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-valuetext={displayValue}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ accentColor: color }}
        data-testid={testId}
      />
    </div>
  );
}
