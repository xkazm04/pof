'use client';

import { ACCENT_EMERALD, STATUS_WARNING, ACCENT_VIOLET } from '@/lib/chart-colors';
import { RARITY_TIERS } from '../_shared/data';

interface EconomySummaryGridProps {
  economyProfile: 'casual' | 'hardcore';
}

export function EconomySummaryGrid({ economyProfile }: EconomySummaryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Gold/Hour</span>
        <span className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>
          {economyProfile === 'casual' ? '2,300' : '8,400'}
        </span>
        <span className="text-2xs text-text-muted">{economyProfile === 'casual' ? '30 min/day' : '4 hr/day'}</span>
      </div>
      <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Items/Hour</span>
        <span className="text-lg font-mono font-bold" style={{ color: ACCENT_EMERALD }}>
          {economyProfile === 'casual' ? '45' : '120'}
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
          {economyProfile === 'casual' ? '~42d' : '~6d'}
        </span>
        <span className="text-2xs text-text-muted">estimated playtime</span>
      </div>
    </div>
  );
}
