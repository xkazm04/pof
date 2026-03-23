'use client';

import { motion } from 'framer-motion';
import { NeonBar } from './design';

export function DPSBreakdownChart({ breakdowns }: {
  breakdowns: Record<string, { abilityName: string; avgDamage: number; color: string }[]>;
}) {
  const entries = Object.entries(breakdowns);
  if (entries.length === 0) return null;

  const [label, items] = entries[0];
  const maxDPS = Math.max(...items.map(i => i.avgDamage), 1);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">
        {label} — Effective DPS/ability
      </div>
      {items.map(item => {
        const pct = (item.avgDamage / maxDPS) * 100;
        return (
          <div key={item.abilityName} className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted w-24 truncate text-right flex-shrink-0">
              {item.abilityName}
            </span>
            <div className="flex-1">
              <NeonBar pct={pct} color={item.color} height={8} glow />
            </div>
            <span className="text-xs font-mono font-bold text-text w-10 text-right">
              {item.avgDamage.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
