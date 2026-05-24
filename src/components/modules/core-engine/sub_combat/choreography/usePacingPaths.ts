import { useMemo } from 'react';
import type { DamageEvent } from '@/lib/combat/choreography-sim';
import { LANE_PACING_H } from './types';

/**
 * Compute stacked player/enemy damage area-paths for the UnifiedTimeline pacing lane.
 * Extracted from UnifiedTimeline.tsx to keep that file under 200 LOC.
 */
export function usePacingPaths(damageEvents: DamageEvent[], duration: number, pxPerSec: number) {
  const pacingBuckets = useMemo(() => {
    const count = Math.ceil(duration);
    const b: { playerDmg: number; enemyDmg: number }[] = Array.from({ length: count }, () => ({ playerDmg: 0, enemyDmg: 0 }));
    for (const evt of damageEvents) {
      const idx = Math.min(Math.floor(evt.timeSec), count - 1);
      if (idx < 0) continue;
      if (evt.source === 'Player') b[idx].playerDmg += evt.damage;
      else b[idx].enemyDmg += evt.damage;
    }
    return b;
  }, [damageEvents, duration]);

  const maxDmg = useMemo(() => Math.max(1, ...pacingBuckets.map((b) => b.playerDmg + b.enemyDmg)), [pacingBuckets]);

  const paths = useMemo(() => {
    const count = pacingBuckets.length;
    if (count === 0) return { playerPath: '', enemyPath: '' };
    const points = pacingBuckets.map((b, i) => {
      const x = (i + 0.5) * pxPerSec;
      return { x, playerH: (b.playerDmg / maxDmg) * (LANE_PACING_H - 4), enemyH: (b.enemyDmg / maxDmg) * (LANE_PACING_H - 4) };
    });
    const baseY = LANE_PACING_H;
    let pTop = '';
    let pBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH } = points[i];
      pTop += (i === 0 ? 'M' : 'L') + `${x},${baseY - playerH}`;
      pBot = `L${x},${baseY}` + pBot;
    }
    const playerP = pTop + `L${points[points.length - 1].x},${baseY}L${points[0].x},${baseY}Z`;
    let eTop = '';
    let eBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH, enemyH } = points[i];
      eTop += (i === 0 ? 'M' : 'L') + `${x},${baseY - playerH - enemyH}`;
      eBot = `L${x},${baseY - playerH}` + eBot;
    }
    const enemyP = eTop + eBot.replace(/^L/, 'L') + `L${points[0].x},${baseY - points[0].playerH}Z`;
    return { playerPath: playerP, enemyPath: enemyP };
  }, [pacingBuckets, maxDmg, pxPerSec]);

  return paths;
}
