'use client';

import { NeonBar } from '../_design';

/* ── Stat bar ────────────────────────────────────────────────────────── */

export function StatBar({ label, value, max, color, unit }: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1">
        <NeonBar pct={pct} color={color} height={6} glow />
      </div>
      <span className="text-xs font-mono text-zinc-300 tabular-nums w-14 text-right">
        {value}{unit ?? ''}
      </span>
    </div>
  );
}
