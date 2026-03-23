'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { ACCENT_EMERALD, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_VIOLET } from '@/lib/chart-colors';
import { TabButtonGroup, LiveMetricGauge } from '../_shared';
import { ECONOMY_SURPLUS } from './data';
import { BlueprintPanel, SectionHeader } from './design';

export function EconomyImpact() {
  const [economyProfile, setEconomyProfile] = useState<'casual' | 'hardcore'>('casual');

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Calculator} label="Loot Economy Impact" color={ACCENT_EMERALD} />
        <TabButtonGroup
          items={[
            { value: 'casual', label: 'Casual' },
            { value: 'hardcore', label: 'Hardcore' },
          ]}
          selected={economyProfile}
          onSelect={(v) => setEconomyProfile(v as 'casual' | 'hardcore')}
          accent={ACCENT_EMERALD}
          ariaLabel="Economy player profile"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Gold/Hour Injection</span>
          <span className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>
            {economyProfile === 'casual' ? '2,300' : '8,400'}
          </span>
          <span className="text-2xs text-text-muted">{economyProfile === 'casual' ? '30 min/day' : '4 hr/day'}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Inflation Risk</span>
          <div className="w-16 h-16">
            <LiveMetricGauge
              metric={{ label: 'Risk', current: economyProfile === 'casual' ? 35 : 65, target: 100, unit: '%' }}
              size={64}
              accent={economyProfile === 'casual' ? STATUS_SUCCESS : STATUS_WARNING}
            />
          </div>
        </div>
        <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Full Legendary Set</span>
          <span className="text-lg font-mono font-bold" style={{ color: ACCENT_VIOLET }}>
            {economyProfile === 'casual' ? '~42d' : '~6d'}
          </span>
          <span className="text-2xs text-text-muted">estimated playtime</span>
        </div>
      </div>
      {/* Surplus/deficit */}
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Item Surplus / Deficit</div>
      <div className="space-y-1">
        {ECONOMY_SURPLUS.map((item) => {
          const multiplied = economyProfile === 'hardcore' ? item.delta * 3 : item.delta;
          const isPositive = multiplied >= 0;
          return (
            <div key={item.type} className="flex items-center gap-2">
              <span className="text-2xs font-mono w-20 text-text-muted">{item.type}</span>
              <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/60" />
                {isPositive ? (
                  <div className="h-full rounded absolute left-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_SUCCESS }} />
                ) : (
                  <div className="h-full rounded absolute right-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_ERROR }} />
                )}
              </div>
              <span className="text-2xs font-mono w-8 text-right" style={{ color: isPositive ? STATUS_SUCCESS : STATUS_ERROR }}>
                {isPositive ? '+' : ''}{multiplied}
              </span>
            </div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
