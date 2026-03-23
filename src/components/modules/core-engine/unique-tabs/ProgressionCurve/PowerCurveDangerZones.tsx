'use client';

import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { NormalizedLineChart } from '../_shared';
import { DANGER_ZONE_LEVELS, PLAYER_POWER, ENEMY_DIFFICULTY } from './data';

const ZONE_THRESHOLDS = [
  { label: 'Easy', color: STATUS_SUCCESS, range: 'Player > Enemy +30%' },
  { label: 'Balanced', color: STATUS_WARNING, range: 'Within 30%' },
  { label: 'Hard', color: STATUS_ERROR, range: 'Enemy > Player +30%' },
];

export function PowerCurveDangerZones() {
  const powerMax = Math.max(...PLAYER_POWER, ...ENEMY_DIFFICULTY);

  return (
    <BlueprintPanel color={STATUS_ERROR} className="p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={AlertTriangle} label="Power Curve Danger Zones" color={STATUS_ERROR} />
        <div className="flex items-center gap-3">
          {ZONE_THRESHOLDS.map(z => (
            <div key={z.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: z.color, opacity: 0.6 }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{z.label}</span>
            </div>
          ))}
        </div>
      </div>

      <NormalizedLineChart
        gridColor="rgba(255,255,255,0.05)"
        xLabels={DANGER_ZONE_LEVELS.filter((_, i) => i % 2 === 0).map(lv => `Lv ${lv}`)}
        overlay={
          <div className="absolute top-2 right-4 flex items-center gap-4 text-[10px] font-mono z-10">
            <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> Player</span>
            <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded border-t border-dashed" style={{ borderColor: STATUS_ERROR, backgroundColor: STATUS_ERROR }} /> Enemy</span>
          </div>
        }
      >
        {DANGER_ZONE_LEVELS.map((_, i) => {
          if (i >= DANGER_ZONE_LEVELS.length - 1) return null;
          const x1 = (i / (DANGER_ZONE_LEVELS.length - 1)) * 100;
          const x2 = ((i + 1) / (DANGER_ZONE_LEVELS.length - 1)) * 100;
          const ratio = PLAYER_POWER[i] / ENEMY_DIFFICULTY[i];
          const zoneColor = ratio > 1.3 ? STATUS_SUCCESS : ratio > 0.77 ? STATUS_WARNING : STATUS_ERROR;
          return (
            <rect key={i} x={x1} y={0} width={x2 - x1} height={100} fill={zoneColor} opacity={0.08} />
          );
        })}

        <motion.polyline
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
          points={PLAYER_POWER.map((p, i) => `${(i / (PLAYER_POWER.length - 1)) * 100},${100 - (p / powerMax) * 100}`).join(' ')}
          fill="none" stroke={STATUS_SUCCESS} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 3px ${STATUS_SUCCESS})` }}
        />

        <motion.polyline
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }}
          points={ENEMY_DIFFICULTY.map((p, i) => `${(i / (ENEMY_DIFFICULTY.length - 1)) * 100},${100 - (p / powerMax) * 100}`).join(' ')}
          fill="none" stroke={STATUS_ERROR} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
          strokeDasharray="6 3"
          style={{ filter: `drop-shadow(0 0 3px ${STATUS_ERROR})` }}
        />

        {PLAYER_POWER.map((p, i) => (
          <circle key={`pp-${i}`} cx={`${(i / (PLAYER_POWER.length - 1)) * 100}`} cy={`${100 - (p / powerMax) * 100}`} r="3" fill={STATUS_SUCCESS} vectorEffect="non-scaling-stroke">
            <title>Lv {i * 5}: Player Power {p}</title>
          </circle>
        ))}
        {ENEMY_DIFFICULTY.map((p, i) => (
          <circle key={`ed-${i}`} cx={`${(i / (ENEMY_DIFFICULTY.length - 1)) * 100}`} cy={`${100 - (p / powerMax) * 100}`} r="3" fill={STATUS_ERROR} vectorEffect="non-scaling-stroke">
            <title>Lv {i * 5}: Enemy Difficulty {p}</title>
          </circle>
        ))}
      </NormalizedLineChart>
    </BlueprintPanel>
  );
}
