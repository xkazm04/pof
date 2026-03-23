'use client';

import { X } from 'lucide-react';
import { ACCENT_CYAN } from '@/lib/chart-colors';

export function TuningSlider({ label, value, defaultValue = 1.0, onChange, color }: {
  label: string;
  value: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const c = color || ACCENT_CYAN;
  const delta = value - defaultValue;
  const hasDelta = Math.abs(delta) >= 0.01;
  const defaultPct = ((defaultValue - 0.5) / 1.5) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-20 truncate shrink-0">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none bg-border cursor-pointer relative z-10
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
          style={{ accentColor: c }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-2.5 rounded-full pointer-events-none z-0"
          style={{ left: `${defaultPct}%`, backgroundColor: c, opacity: 0.3 }}
        />
      </div>
      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: c }}>
        {value.toFixed(2)}
      </span>
      {hasDelta && (
        <span
          className="text-[10px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
          style={{ color: c, backgroundColor: `${c}15` }}
        >
          {delta > 0 ? '+' : ''}{delta.toFixed(2)}
        </span>
      )}
      {hasDelta && (
        <button
          onClick={() => onChange(defaultValue)}
          className="shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors"
          title={`Reset to ${defaultValue.toFixed(2)}`}
        >
          <X className="w-2.5 h-2.5 text-text-muted hover:text-text" />
        </button>
      )}
    </div>
  );
}

export function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-1.5 rounded-md bg-black/30 border border-border/30 text-center">
      <div className="text-xs font-mono font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{label}</div>
    </div>
  );
}
