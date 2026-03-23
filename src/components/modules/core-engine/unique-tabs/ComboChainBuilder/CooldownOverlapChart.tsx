'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { ACCENT_ORANGE, OPACITY_20 } from '@/lib/chart-colors';
import type { ComboAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';
import { BlueprintPanel, SectionHeader } from './design';

export function CooldownOverlapChart({ chain, totalDuration }: { chain: ComboAbility[]; totalDuration: number }) {
  const cdEntries = useMemo(() => {
    const entries: { ability: ComboAbility; startTime: number }[] = [];
    let t = 0;
    for (const ab of chain) {
      if (ab.cooldown > 0) {
        entries.push({ ability: ab, startTime: t });
      }
      t += ab.animDuration;
    }
    return entries;
  }, [chain]);

  if (cdEntries.length === 0) return null;

  const maxTime = Math.max(totalDuration, ...cdEntries.map(e => e.startTime + e.ability.cooldown));
  const w = 400;
  const laneH = 24;
  const labelW = 80;
  const barW = w - labelW;
  const totalH = cdEntries.length * (laneH + 4) + 20;

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-4">
      <div className="absolute left-0 top-0 w-32 h-32 blur-3xl rounded-full pointer-events-none"
        style={{ backgroundColor: `${ACCENT_ORANGE}08` }} />
      <SectionHeader icon={RotateCcw} label="Cooldown Windows" color={ACCENT_ORANGE} />
      <div className="mt-3 overflow-x-auto custom-scrollbar">
        <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`}>
          {/* Combo duration indicator */}
          <rect
            x={labelW} y={0}
            width={(totalDuration / maxTime) * barW}
            height={totalH}
            fill="rgba(255,255,255,0.03)"
            rx={4}
          />
          <text x={labelW + 4} y={12} className="text-[9px] font-mono" fill="var(--text-muted)" opacity={0.5}>
            combo duration
          </text>

          {cdEntries.map((entry, i) => {
            const y = 18 + i * (laneH + 4);
            const startX = labelW + (entry.startTime / maxTime) * barW;
            const cdW = (entry.ability.cooldown / maxTime) * barW;
            return (
              <g key={`${entry.ability.id}-${i}`}>
                {/* Label */}
                <text
                  x={labelW - 4} y={y + laneH / 2 + 4}
                  textAnchor="end"
                  className="text-[10px] font-mono font-bold"
                  fill={entry.ability.color}
                >
                  {entry.ability.name}
                </text>
                {/* CD bar */}
                <motion.rect
                  x={startX} y={y}
                  width={cdW} height={laneH}
                  rx={4}
                  fill={`${entry.ability.color}${OPACITY_20}`}
                  stroke={`${entry.ability.color}60`}
                  strokeWidth={1}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  style={{ transformOrigin: `${startX}px ${y}px` }}
                />
                {/* CD text */}
                <text
                  x={startX + cdW / 2} y={y + laneH / 2 + 3.5}
                  textAnchor="middle"
                  className="text-[9px] font-mono"
                  fill={entry.ability.color}
                >
                  {entry.ability.cooldown}s CD
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </BlueprintPanel>
  );
}
