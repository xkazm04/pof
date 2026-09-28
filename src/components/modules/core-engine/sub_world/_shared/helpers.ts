'use client';

import {
  ENEMY_DENSITY_CONFIG, ZONE_POIS, ZONE_DANGER_SCORES,
  LEVEL_RANGE_BARS, ENV_HAZARDS, STATIC_WORLD,
} from './data';
import type { StatComparison } from '@/types/unique-tab-improvements';

/* ── Zone Comparison Helpers ────────────────────────────────────────────── */

export const COMPARE_ZONE_NAMES = ENEMY_DENSITY_CONFIG.rows;

export function getZoneStats(zoneName: string) {
  // Read the world model by zone id (not by heatmap row); unmeasured zones compare as 0.
  const zoneId = STATIC_WORLD.zones.find(z => z.name === zoneName)?.id ?? '';
  const enemyCount = STATIC_WORLD.enemiesByZoneId[zoneId] ?? 0;
  const zpoi = ZONE_POIS.find(z => z.zone === zoneName);
  const poiCount = zpoi ? zpoi.pois.reduce((a, p) => a + p.count, 0) : 0;
  const discoveryPct = zpoi?.discoveryPct ?? 0;
  const dangerScore = ZONE_DANGER_SCORES.find(z => z.zone === zoneName)?.score ?? 0;
  const levelBar = LEVEL_RANGE_BARS.find(z => z.zone === zoneName);
  const hazards = ENV_HAZARDS.filter(h => h.zone === zoneName);
  return {
    enemyCount,
    poiCount,
    discoveryPct,
    dangerScore,
    levelMin: levelBar?.min ?? 0,
    levelMax: levelBar?.max ?? 0,
    bossPhases: STATIC_WORLD.bossPhasesByZoneId[zoneId] ?? 0,
    hazardCount: hazards.length,
    totalHazardDps: hazards.reduce((s, h) => s + h.damagePerSec, 0),
  };
}

export function buildZoneComparisons(nameA: string, nameB: string): StatComparison[] {
  const a = getZoneStats(nameA);
  const b = getZoneStats(nameB);
  return [
    { stat: 'Enemy Count', valueA: a.enemyCount, valueB: b.enemyCount, higherIsBetter: false },
    { stat: 'POI Count', valueA: a.poiCount, valueB: b.poiCount, higherIsBetter: true },
    { stat: 'Discovery', valueA: a.discoveryPct, valueB: b.discoveryPct, unit: '%', higherIsBetter: true },
    { stat: 'Danger Score', valueA: a.dangerScore, valueB: b.dangerScore, higherIsBetter: false },
    { stat: 'Level Min', valueA: a.levelMin, valueB: b.levelMin },
    { stat: 'Level Max', valueA: a.levelMax, valueB: b.levelMax },
    { stat: 'Boss Phases', valueA: a.bossPhases, valueB: b.bossPhases },
    { stat: 'Hazard Count', valueA: a.hazardCount, valueB: b.hazardCount, higherIsBetter: false },
    { stat: 'Hazard DPS', valueA: a.totalHazardDps, valueB: b.totalHazardDps, unit: 'dps', higherIsBetter: false },
  ];
}
