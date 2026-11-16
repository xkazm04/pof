'use client';

import { WEAPONS } from '../_shared/data-metrics';
import { MATCHUP_TARGETS, rankForTarget } from '@/lib/combat/weapon-matchup';

/** First enemy archetype: the fixed target the tile quotes (the dummy has no HP, so no TTK). */
const KPI_TARGET = MATCHUP_TARGETS.find((t) => t.hp !== null) ?? MATCHUP_TARGETS[0];
const BEST = rankForTarget(WEAPONS, KPI_TARGET).rows[0];

/** Best weapon time-to-kill against the default matchup target (weapon-matchup law). */
export function KpisMetric() {
  if (!BEST || BEST.ttkSec === null) return null;
  return (
    <div
      className="flex items-baseline gap-1 text-xs font-mono"
      title={`${BEST.name} kills ${KPI_TARGET.name} (${KPI_TARGET.hp} HP, ${KPI_TARGET.armour} armour) in ${BEST.ttkSec.toFixed(1)} s`}
    >
      <span className="font-bold text-text">{BEST.ttkSec.toFixed(1)} s</span>
      <span className="text-text-muted">best TTK vs {KPI_TARGET.name}</span>
    </div>
  );
}
