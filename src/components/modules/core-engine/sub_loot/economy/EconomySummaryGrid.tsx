'use client';

import { useMemo } from 'react';
import { ACCENT_EMERALD, STATUS_WARNING, ACCENT_VIOLET } from '@/lib/chart-colors';
import { RARITY_TIERS } from '../_shared/data';
import { useLootTuningStore } from '../_shared/lootTuningStore';
import { deriveEconomy, ECONOMY_KILLS_PER_HOUR, ECONOMY_HOURS_PER_DAY } from '../simulation/lootSimEngine';

interface EconomySummaryGridProps {
  economyProfile: 'casual' | 'hardcore';
}

export function EconomySummaryGrid({ economyProfile }: EconomySummaryGridProps) {
  const bindings = useLootTuningStore((s) => s.bindings);
  const rarityGold = useLootTuningStore((s) => s.rarityGold);
  const eco = useMemo(
    () => deriveEconomy(bindings, rarityGold, ECONOMY_KILLS_PER_HOUR, economyProfile),
    [bindings, rarityGold, economyProfile],
  );
  const hours = ECONOMY_HOURS_PER_DAY[economyProfile];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Gold/Hour</span>
        <span className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>
          {Math.round(eco.goldPerHour).toLocaleString('en-US')}
        </span>
        <span className="text-2xs text-text-muted">{hours < 1 ? `${hours * 60} min/day` : `${hours} hr/day`}</span>
      </div>
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Items/Hour</span>
        <span className="text-lg font-mono font-bold" style={{ color: ACCENT_EMERALD }}>
          {Math.round(eco.itemsPerHour)}
        </span>
        <span className="text-2xs text-text-muted">avg drops</span>
      </div>
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Rarity Dist</span>
        <div className="flex h-4 w-full rounded overflow-hidden mt-1 mb-0.5">
          {RARITY_TIERS.map(t => (
            <div key={t.name} style={{ flex: t.weight, backgroundColor: t.color }} title={`${t.name}: ${t.weight}%`} />
          ))}
        </div>
        <span className="text-2xs text-text-muted">{RARITY_TIERS.length} tiers</span>
      </div>
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Legendary Set</span>
        <span className="text-lg font-mono font-bold" style={{ color: ACCENT_VIOLET }}>
          {eco.legendaryDays === null ? 'never' : `~${Math.max(1, Math.round(eco.legendaryDays))}d`}
        </span>
        <span className="text-2xs text-text-muted">estimated playtime</span>
      </div>
    </div>
  );
}
