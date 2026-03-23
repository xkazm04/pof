'use client';

import { useState, useCallback } from 'react';
import { Dices } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_8, OPACITY_30 } from '@/lib/chart-colors';
import { TabButtonGroup } from '../_shared';
import { RARITY_TIERS, TOTAL_WEIGHT } from './data';
import { BlueprintPanel, SectionHeader } from './design';

export function DropSimulator() {
  const [rollCount, setRollCount] = useState<number | null>(null);
  const [rollResults, setRollResults] = useState<Record<string, number>>({});

  const rollDrops = useCallback((n: number) => {
    setRollCount(n);
    const tally: Record<string, number> = {};
    for (const t of RARITY_TIERS) tally[t.name] = 0;
    for (let i = 0; i < n; i++) {
      let roll = Math.random() * TOTAL_WEIGHT;
      for (const tier of RARITY_TIERS) {
        roll -= tier.weight;
        if (roll <= 0) { tally[tier.name]++; break; }
      }
    }
    setRollResults(tally);
  }, []);

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={Dices} label="Drop Simulator" color={ACCENT_CYAN} />
      <div className="mb-3">
        <TabButtonGroup
          items={[
            { value: '10', label: 'Roll 10' },
            { value: '100', label: 'Roll 100' },
            { value: '1000', label: 'Roll 1000' },
          ]}
          selected={rollCount !== null ? String(rollCount) : null}
          onSelect={(v) => rollDrops(Number(v))}
          accent={ACCENT_CYAN}
          ariaLabel="Drop simulator sample size"
        />
      </div>
      {rollCount !== null ? (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {RARITY_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
              style={{ borderColor: `${tier.color}${OPACITY_30}`, backgroundColor: `${tier.color}${OPACITY_8}` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
              <span className="text-xs text-text">{tier.name}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: tier.color }}>
                {rollResults[tier.name] ?? 0}
              </span>
            </div>
          ))}
          <span className="text-2xs text-text-muted self-center">/ {rollCount} drops</span>
        </div>
      ) : (
        <p className="text-2xs text-text-muted italic">Click a button to simulate drops.</p>
      )}
    </BlueprintPanel>
  );
}
