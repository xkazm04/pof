'use client';

import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR, OVERLAY_WHITE, withOpacity, OPACITY_5 } from '@/lib/chart-colors';
import { STATUS_TOKENS, type StatusLevel } from '@/lib/status-token';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { NormalizedLineChart } from '../../unique-tabs/_shared';
import { DANGER_ZONE_LEVELS, PLAYER_POWER, ENEMY_DIFFICULTY } from '../_shared/data';
import { safeDivide, normalizedIndex, hasPlottableSpread } from '../_shared/chartMath';
import { ChartEmptyState } from '../_shared/ChartEmptyState';

// Each difficulty zone maps onto the shared status ramp so the legend carries a
// distinct glyph + color (not hue alone) — colorblind-safe at a glance.
const ZONE_THRESHOLDS: { label: string; level: StatusLevel; range: string }[] = [
  { label: 'Easy', level: 'ok', range: 'Player > Enemy +30%' },
  { label: 'Balanced', level: 'warn', range: 'Within 30%' },
  { label: 'Hard', level: 'bad', range: 'Enemy > Player +30%' },
];

interface PowerCurveDangerZonesProps {
  /** Player power per sampled level (defaults to the shipped series). */
  playerPower?: number[];
  /** Enemy difficulty per sampled level (defaults to the shipped series). */
  enemyDifficulty?: number[];
}

export function PowerCurveDangerZones({
  playerPower = PLAYER_POWER,
  enemyDifficulty = ENEMY_DIFFICULTY,
}: PowerCurveDangerZonesProps) {
  const powerMax = Math.max(0, ...playerPower, ...enemyDifficulty);
  // Need ≥2 points per line (x normalizes by index span) and a positive max
  // (y normalizes by `powerMax`); otherwise the lines collapse to NaN.
  const plottable =
    playerPower.length >= 2 && enemyDifficulty.length >= 2 &&
    hasPlottableSpread([...playerPower, ...enemyDifficulty]);

  return (
    <BlueprintPanel color={STATUS_ERROR} className="p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={AlertTriangle} label="Power Curve Danger Zones" color={STATUS_ERROR} />
        <div className="flex items-center gap-3">
          {ZONE_THRESHOLDS.map(z => {
            const t = STATUS_TOKENS[z.level];
            const ZoneIcon = t.Icon;
            return (
              <div key={z.label} className="flex items-center gap-1.5" title={`${z.label}: ${z.range}`}>
                <ZoneIcon className="w-3 h-3 flex-shrink-0" style={{ color: t.color }} aria-hidden strokeWidth={2.5} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{z.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!plottable ? (
        <ChartEmptyState message="No power-curve data to plot" />
      ) : (
        <NormalizedLineChart
          gridColor={withOpacity(OVERLAY_WHITE, OPACITY_5)}
          xLabels={DANGER_ZONE_LEVELS.filter((_, i) => i % 2 === 0).map(lv => `Lv ${lv}`)}
          overlay={
            <div className="absolute top-2 right-4 flex items-center gap-4 text-xs font-mono z-10">
              <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> Player</span>
              <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded border-t border-dashed" style={{ borderColor: STATUS_ERROR, backgroundColor: STATUS_ERROR }} /> Enemy</span>
            </div>
          }
        >
          {playerPower.map((_, i) => {
            if (i >= playerPower.length - 1) return null;
            const x1 = normalizedIndex(i, playerPower.length) * 100;
            const x2 = normalizedIndex(i + 1, playerPower.length) * 100;
            const ratio = safeDivide(playerPower[i], enemyDifficulty[i]);
            const zoneColor = (ratio > 1.3 ? STATUS_TOKENS.ok : ratio > 0.77 ? STATUS_TOKENS.warn : STATUS_TOKENS.bad).color;
            return (
              <rect key={i} x={x1} y={0} width={x2 - x1} height={100} fill={zoneColor} opacity={0.08} />
            );
          })}

          <motion.polyline
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
            points={playerPower.map((p, i) => `${normalizedIndex(i, playerPower.length) * 100},${100 - safeDivide(p, powerMax) * 100}`).join(' ')}
            fill="none" stroke={STATUS_SUCCESS} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 3px ${STATUS_SUCCESS})` }}
          />

          <motion.polyline
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }}
            points={enemyDifficulty.map((p, i) => `${normalizedIndex(i, enemyDifficulty.length) * 100},${100 - safeDivide(p, powerMax) * 100}`).join(' ')}
            fill="none" stroke={STATUS_ERROR} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
            strokeDasharray="6 3"
            style={{ filter: `drop-shadow(0 0 3px ${STATUS_ERROR})` }}
          />

          {playerPower.map((p, i) => (
            <circle key={`pp-${i}`} cx={`${normalizedIndex(i, playerPower.length) * 100}`} cy={`${100 - safeDivide(p, powerMax) * 100}`} r="3" fill={STATUS_SUCCESS} vectorEffect="non-scaling-stroke">
              <title>Lv {i * 5}: Player Power {p}</title>
            </circle>
          ))}
          {enemyDifficulty.map((p, i) => (
            <circle key={`ed-${i}`} cx={`${normalizedIndex(i, enemyDifficulty.length) * 100}`} cy={`${100 - safeDivide(p, powerMax) * 100}`} r="3" fill={STATUS_ERROR} vectorEffect="non-scaling-stroke">
              <title>Lv {i * 5}: Enemy Difficulty {p}</title>
            </circle>
          ))}
        </NormalizedLineChart>
      )}
    </BlueprintPanel>
  );
}
