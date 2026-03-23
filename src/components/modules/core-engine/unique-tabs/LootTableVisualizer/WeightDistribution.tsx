'use client';

import { RARITY_TIERS, TOTAL_WEIGHT } from './data';
import { BlueprintPanel, SectionHeader } from './design';

export function WeightDistribution() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
      <BlueprintPanel className="p-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Drop Weight Distribution
        </div>
        <div className="flex h-5 rounded overflow-hidden w-full">
          {RARITY_TIERS.map((tier) => (
            <div
              key={tier.name}
              title={`${tier.name}: ${tier.weight}% weight`}
              style={{ width: `${(tier.weight / TOTAL_WEIGHT) * 100}%`, backgroundColor: tier.color }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {RARITY_TIERS.map((tier) => (
            <span key={tier.name} className="flex items-center gap-1 text-2xs text-text-muted">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: tier.color }} />
              {tier.name}
            </span>
          ))}
        </div>
      </BlueprintPanel>

      <BlueprintPanel className="p-3 min-w-[140px]">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Rarity %
        </div>
        <div className="space-y-1">
          {RARITY_TIERS.map((tier) => (
            <div key={tier.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
              <span className="text-2xs text-text w-16">{tier.name}</span>
              <span className="text-2xs font-mono text-text-muted ml-auto">
                {((tier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </BlueprintPanel>
    </div>
  );
}
