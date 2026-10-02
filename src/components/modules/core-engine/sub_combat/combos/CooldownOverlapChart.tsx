'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { ACCENT_ORANGE, OVERLAY_WHITE, OPACITY_20, STATUS_WARNING,
  withOpacity, OPACITY_3, OPACITY_5, OPACITY_37,
} from '@/lib/chart-colors';
import { motionSafe } from '@/lib/motion';
import { BlueprintPanel, SectionHeader } from './design';
import type { ComboSchedule } from './schedule';
import { ResponsiveSvgContainer } from '../damage-pipeline/ResponsiveSvgContainer';

/** Cooldown bars at each cast's scheduled start; the ability that binds the loop is outlined. */
export function CooldownOverlapChart({ schedule, binding }: { schedule: ComboSchedule; binding: string | null }) {
  const prefersReduced = useReducedMotion();
  const { totalDuration } = schedule;
  const cdEntries = useMemo(
    () => schedule.casts
      .filter(c => c.ability.cooldown > 0)
      .map(c => ({ ability: c.ability, startTime: c.start })),
    [schedule],
  );

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
        style={{ backgroundColor: `${withOpacity(ACCENT_ORANGE, OPACITY_5)}` }} />
      <SectionHeader icon={RotateCcw} label="Cooldown Windows" color={ACCENT_ORANGE} />
      <div className="mt-3">
        <ResponsiveSvgContainer intrinsicWidth={w}>
        <svg width="100%" height={totalH} viewBox={`0 0 ${w} ${totalH}`}>
          {/* Combo duration indicator */}
          <rect
            x={labelW} y={0}
            width={(totalDuration / maxTime) * barW}
            height={totalH}
            fill={withOpacity(OVERLAY_WHITE, OPACITY_3)}
            rx={4}
          />
          <text x={labelW + 4} y={12} className="text-[9px] font-mono" fill="var(--text-muted)" opacity={0.5}>
            combo duration
          </text>

          {cdEntries.map((entry, i) => {
            const y = 18 + i * (laneH + 4);
            const startX = labelW + (entry.startTime / maxTime) * barW;
            const cdW = (entry.ability.cooldown / maxTime) * barW;
            const binds = entry.ability.id === binding;
            return (
              <g key={`${entry.ability.id}-${i}`}>
                {/* Label */}
                <text
                  x={labelW - 4} y={y + laneH / 2 + 4}
                  textAnchor="end"
                  className="text-xs font-mono font-bold"
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
                  stroke={binds ? STATUS_WARNING : withOpacity(entry.ability.color, OPACITY_37)}
                  strokeWidth={binds ? 2 : 1}
                  strokeDasharray={binds ? '4 2' : undefined}
                  initial={prefersReduced ? { scaleX: 1 } : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={motionSafe({ delay: i * 0.1, duration: 0.4 }, prefersReduced)}
                  style={{ transformOrigin: `${startX}px ${y}px` }}
                />
                {/* CD text */}
                <text
                  x={startX + cdW / 2} y={y + laneH / 2 + 3.5}
                  textAnchor="middle"
                  className="text-[9px] font-mono"
                  fill={entry.ability.color}
                >
                  {entry.ability.cooldown}s CD{binds ? ' · binds loop' : ''}
                </text>
              </g>
            );
          })}
        </svg>
        </ResponsiveSvgContainer>
      </div>
    </BlueprintPanel>
  );
}
