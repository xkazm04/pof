'use client';

/* ── StatInput ─ Labelled range slider with divergence indicator ──── */

export function StatInput({ label, value, onChange, min, max, step, unit, color, diverged }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string; color: string; diverged?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate flex items-center gap-1">
        {diverged && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
            title="Modified from preset"
          />
        )}
        {label}
      </span>
      <input
        type="range" min={min} max={max} step={step ?? 0.01}
        value={value} onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-current cursor-pointer" style={{ color }}
      />
      <span className="text-xs font-mono w-14 text-right" style={{ color }}>
        {step && step >= 1 ? value.toFixed(0) : value.toFixed(step && step < 0.01 ? 3 : 2)}{unit ?? ''}
      </span>
    </div>
  );
}
