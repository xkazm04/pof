'use client';

import type { Heart } from 'lucide-react';

/** Compact stat slider input with icon, label, value readout, and optional hint */
export function StatInput({ label, value, onChange, min, max, step, icon: Icon, color, unit, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  icon?: typeof Heart;
  color: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 group">
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
      <span className="text-2xs text-text-muted w-full sm:w-16 truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-current cursor-pointer"
        style={{ color }}
      />
      <div className="w-14 text-right flex-shrink-0">
        <span className="text-2xs font-mono" style={{ color }}>
          {step && step < 1 ? value.toFixed(2) : value}{unit ?? ''}
        </span>
        {hint && <div className="text-2xs font-mono text-text-muted opacity-60 leading-tight">{hint}</div>}
      </div>
    </div>
  );
}
