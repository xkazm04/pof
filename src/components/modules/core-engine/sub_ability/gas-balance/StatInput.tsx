'use client';

import type { Heart } from 'lucide-react';
import { TEXT_SCALE } from '@/lib/typography-scale';

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
  // `min`/`max` are the curated everyday range — but a value that arrived
  // from outside this component (an imported scenario, validated only
  // against data.ts's much wider STAT_BOUNDS) can legitimately sit outside
  // it. A native <input type="range"> silently clamps its displayed value to
  // [min, max], so without this the slider would render pinned at an
  // endpoint and the next touch would commit that clamped value, discarding
  // the imported one. Widening only when the current value demands it keeps
  // the slider's normal granularity for every in-range edit.
  const effMin = Math.min(min, value);
  const effMax = Math.max(max, value);

  return (
    <div className="flex items-center gap-1.5 group">
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
      <span className="text-2xs text-text-muted w-full sm:w-16 truncate">{label}</span>
      <input
        type="range"
        min={effMin}
        max={effMax}
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
        {hint && <div className={`${TEXT_SCALE.body} font-mono text-text-muted leading-tight`}>{hint}</div>}
      </div>
    </div>
  );
}
