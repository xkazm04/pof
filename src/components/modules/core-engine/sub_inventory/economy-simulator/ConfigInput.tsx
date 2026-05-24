'use client';

/* ── Config Input ─────────────────────────────────────────────────────── */

const INPUT_CLS =
  'w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50';

export function ConfigInput({ label, value, onChange, min, max, step, wide }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; wide?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">
        {label}
      </span>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className={wide ? 'w-20 ' + INPUT_CLS.replace('w-16 ', '') : INPUT_CLS}
      />
    </div>
  );
}
