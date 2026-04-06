'use client';

import { Timer } from 'lucide-react';
import { OVERLAY_WHITE, OPACITY_3, OPACITY_4, OPACITY_6, OPACITY_20, withOpacity } from '@/lib/chart-colors';
import { SectionHeader } from '../_design';
import { ACCENT, DAMAGE_TYPE_COLORS } from './constants';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

/* ── Timeline visualization ──────────────────────────────────────────── */

export function ComboTimeline({ ability }: { ability: ForgedAbility }) {
  const { comboEntry } = ability;
  const totalDuration = comboEntry.animDuration;
  const [startPct, endPct] = [
    (comboEntry.damageWindow[0] / totalDuration) * 100,
    (comboEntry.damageWindow[1] / totalDuration) * 100,
  ];
  const recoveryStart = endPct;
  const recoveryEnd =
    ((comboEntry.damageWindow[1] + comboEntry.recovery) / totalDuration) * 100;

  const dmgColor = DAMAGE_TYPE_COLORS[ability.stats.damageType] ?? DAMAGE_TYPE_COLORS.Physical;

  return (
    <div className="space-y-2">
      <SectionHeader icon={Timer} label="Combo Timeline" color={ACCENT} />

      <div
        className="relative h-10 rounded-lg overflow-hidden"
        style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_3) }}
      >
        {/* Startup phase */}
        <div
          className="absolute inset-y-0 rounded-l-lg"
          style={{ left: 0, width: `${startPct}%`, background: withOpacity(OVERLAY_WHITE, OPACITY_6) }}
        />
        {/* Damage window */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            background: withOpacity(dmgColor, OPACITY_20),
            borderLeft: `2px solid ${dmgColor}`,
            borderRight: `2px solid ${dmgColor}`,
          }}
        />
        {/* Recovery */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${recoveryStart}%`,
            width: `${Math.min(recoveryEnd, 100) - recoveryStart}%`,
            background: withOpacity(OVERLAY_WHITE, OPACITY_4),
          }}
        />

        {/* Labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-mono uppercase tracking-[0.15em] text-zinc-500">
          Startup
        </span>
        <span
          className="absolute top-1/2 -translate-y-1/2 text-xs font-mono font-semibold uppercase tracking-[0.15em]"
          style={{ left: `${startPct + 1}%`, color: dmgColor }}
        >
          Damage
        </span>
        <span
          className="absolute top-1/2 -translate-y-1/2 text-xs font-mono uppercase tracking-[0.15em] text-zinc-500"
          style={{ left: `${recoveryStart + 1}%` }}
        >
          Recovery
        </span>
      </div>

      <div className="flex justify-between text-xs font-mono text-zinc-600 tabular-nums">
        <span>0s</span>
        <span>{comboEntry.damageWindow[0].toFixed(2)}s</span>
        <span>{comboEntry.damageWindow[1].toFixed(2)}s</span>
        <span>{totalDuration.toFixed(2)}s</span>
      </div>
    </div>
  );
}
