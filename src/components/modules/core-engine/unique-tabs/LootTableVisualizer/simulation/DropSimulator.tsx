'use client';

import { useState, useCallback, useMemo } from 'react';
import { Dices, Users } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_8, OPACITY_30, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, withOpacity, OPACITY_12 } from '@/lib/chart-colors';
import { TabButtonGroup } from '../../_shared';
import { RARITY_TIERS, TOTAL_WEIGHT, DEFAULT_ENEMY_LOOT_BINDINGS } from '../data';
import type { EnemyLootBinding } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';
import { ScalableSelector } from '@/components/shared/ScalableSelector';

interface SelectableBinding extends EnemyLootBinding {
  id: string;
  tier: string;
  [key: string]: unknown;
}

function deriveTier(dropChance: number): string {
  if (dropChance >= 1.0) return 'Boss';
  if (dropChance >= 0.50) return 'Elite';
  if (dropChance > 0.30) return 'Standard';
  return 'Minion';
}

const SELECTABLE_BINDINGS: SelectableBinding[] = DEFAULT_ENEMY_LOOT_BINDINGS.map(b => ({
  ...b,
  id: b.archetypeId,
  tier: deriveTier(b.dropChance),
}));

export function DropSimulator() {
  const [rollCount, setRollCount] = useState<number | null>(null);
  const [rollResults, setRollResults] = useState<Record<string, number>>({});
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);

  const selectedBinding = useMemo(
    () => selectedEnemyId ? DEFAULT_ENEMY_LOOT_BINDINGS.find(b => b.archetypeId === selectedEnemyId) : null,
    [selectedEnemyId],
  );

  const rollDrops = useCallback((n: number) => {
    setRollCount(n);
    const tally: Record<string, number> = {};
    for (const t of RARITY_TIERS) tally[t.name] = 0;

    if (selectedBinding) {
      // Per-enemy simulation using their rarity weights
      const totalWeight = selectedBinding.rarityWeights.reduce((s, w) => s + w, 0);
      for (let i = 0; i < n; i++) {
        if (Math.random() > selectedBinding.dropChance) continue; // no drop
        let roll = Math.random() * totalWeight;
        for (let ri = 0; ri < RARITY_TIERS.length; ri++) {
          roll -= selectedBinding.rarityWeights[ri];
          if (roll <= 0) { tally[RARITY_TIERS[ri].name]++; break; }
        }
      }
    } else {
      // Default: simple weighted roll
      for (let i = 0; i < n; i++) {
        let roll = Math.random() * TOTAL_WEIGHT;
        for (const tier of RARITY_TIERS) {
          roll -= tier.weight;
          if (roll <= 0) { tally[tier.name]++; break; }
        }
      }
    }
    setRollResults(tally);
  }, [selectedBinding]);

  const getDeviation = (tierName: string, weight: number) => {
    if (rollCount === null) return null;
    const actual = rollResults[tierName] ?? 0;
    const expected = rollCount * (weight / TOTAL_WEIGHT);
    const delta = actual - expected;
    const rounded = Math.round(delta);
    if (rounded === 0) return { label: 'as expected', color: STATUS_SUCCESS };
    const absDelta = Math.abs(rounded);
    const stdDev = Math.sqrt(rollCount * (weight / TOTAL_WEIGHT) * (1 - weight / TOTAL_WEIGHT));
    const color = Math.abs(delta) > 2 * stdDev ? STATUS_ERROR
      : Math.abs(delta) > stdDev ? STATUS_WARNING
      : STATUS_SUCCESS;
    return {
      label: rounded > 0 ? `+${absDelta} above` : `−${absDelta} below`,
      color,
    };
  };

  const renderEnemyItem = useCallback((item: SelectableBinding, selected: boolean) => (
    <div className="px-2 py-1.5 rounded text-left transition-all"
      style={{
        backgroundColor: selected ? withOpacity(item.color, OPACITY_12) : 'transparent',
        outline: selected ? `1px solid ${item.color}` : 'none',
      }}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded flex items-center justify-center text-2xs font-bold"
          style={{ backgroundColor: withOpacity(item.color, OPACITY_12), color: item.color }}>
          {item.icon}
        </div>
        <span className="text-xs font-mono font-bold" style={{ color: item.color }}>{item.archetypeName}</span>
      </div>
      <div className="flex gap-2 mt-0.5 text-2xs font-mono text-text-muted">
        <span>Drop: {(item.dropChance * 100).toFixed(0)}%</span>
        <span>Gold: {item.bonusGold}</span>
      </div>
    </div>
  ), []);

  const totalDropped = Object.values(rollResults).reduce((s, v) => s + v, 0);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <SectionHeader icon={Dices} label="Drop Simulator" color={ACCENT_CYAN} />
        <button
          onClick={() => setSelectorOpen(true)}
          className="ml-auto flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer"
          style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_30), color: ACCENT_CYAN }}
        >
          <Users className="w-3 h-3" />
          {selectedBinding ? selectedBinding.archetypeName : 'All Enemies'}
        </button>
      </div>

      {selectedBinding && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1 rounded text-2xs font-mono"
          style={{ backgroundColor: withOpacity(selectedBinding.color, OPACITY_8), border: `1px solid ${withOpacity(selectedBinding.color, OPACITY_30)}` }}>
          <span style={{ color: selectedBinding.color }} className="font-bold">{selectedBinding.archetypeName}</span>
          <span className="text-text-muted">&mdash; {(selectedBinding.dropChance * 100).toFixed(0)}% drop chance, {selectedBinding.bonusGold}g bonus</span>
          <button onClick={() => setSelectedEnemyId(null)} className="ml-auto text-text-muted hover:text-text cursor-pointer">&times;</button>
        </div>
      )}

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
        <div>
          <div className="flex flex-wrap gap-2 mb-2" aria-live="polite">
            {RARITY_TIERS.map((tier) => {
              const dev = getDeviation(tier.name, tier.weight);
              return (
                <div
                  key={tier.name}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                  style={{ borderColor: withOpacity(tier.color, OPACITY_30), backgroundColor: withOpacity(tier.color, OPACITY_8) }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                  <span className="text-xs text-text">{tier.name}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: tier.color }}>
                    {rollResults[tier.name] ?? 0}
                  </span>
                  {dev && (
                    <span className="text-2xs font-mono" style={{ color: dev.color }}>
                      {dev.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-2xs text-text-muted">
            <span>/ {rollCount} kills</span>
            {selectedBinding && <span>&middot; {totalDropped} drops ({((totalDropped / rollCount) * 100).toFixed(1)}% drop rate)</span>}
          </div>
        </div>
      ) : (
        <p className="text-2xs text-text-muted italic">Click a button to simulate drops.</p>
      )}

      {/* Enemy Picker Selector */}
      <ScalableSelector<SelectableBinding>
        items={SELECTABLE_BINDINGS}
        groupBy="tier"
        renderItem={renderEnemyItem}
        onSelect={(items) => setSelectedEnemyId(items.length > 0 ? items[0].id : null)}
        selected={selectedEnemyId ? [selectedEnemyId] : []}
        searchKey="archetypeName"
        placeholder="Search enemies..."
        mode="single"
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        title="Select Enemy for Simulation"
        accent={ACCENT_CYAN}
      />
    </BlueprintPanel>
  );
}
