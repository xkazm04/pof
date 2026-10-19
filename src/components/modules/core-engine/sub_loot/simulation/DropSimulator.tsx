'use client';

import { useState, useCallback, useMemo } from 'react';
import { Dices, Users } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_8, OPACITY_30, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, withOpacity, OPACITY_12 } from '@/lib/chart-colors';
import { TabButtonGroup } from '../../unique-tabs/_shared';
import { RARITY_TIERS, DEFAULT_ENEMY_LOOT_BINDINGS } from '../_shared/data';
import type { EnemyLootBinding } from '../_shared/data';
import { useLootTuningStore } from '../_shared/lootTuningStore';
import { runBatch, deviationFor } from './lootSimEngine';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
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

/** The global rarity table as a binding: every kill drops, tiers by RARITY_TIERS weight. */
const GLOBAL_BINDING = { dropChance: 1, rarityWeights: RARITY_TIERS.map(t => t.weight) };

export function DropSimulator() {
  const tunedBindings = useLootTuningStore((s) => s.bindings);
  const [rollCount, setRollCount] = useState<number | null>(null);
  const [rollResults, setRollResults] = useState<Record<string, number>>({});
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);

  const selectedBinding = useMemo(
    () => selectedEnemyId ? tunedBindings.find(b => b.archetypeId === selectedEnemyId) : null,
    [selectedEnemyId, tunedBindings],
  );

  const activeBinding = selectedBinding ?? GLOBAL_BINDING;

  const rollDrops = useCallback((n: number) => {
    setRollCount(n);
    const tally: Record<string, number> = {};
    for (const t of RARITY_TIERS) tally[t.name] = 0;

    const counts = runBatch(activeBinding, n, (Date.now() ^ (n * 0x9e3779b1)) >>> 0);
    RARITY_TIERS.forEach((t, i) => { tally[t.name] = counts[i] ?? 0; });
    setRollResults(tally);
  }, [activeBinding]);

  const getDeviation = (tierIdx: number) => {
    if (rollCount === null) return null;
    const counts = RARITY_TIERS.map(t => rollResults[t.name] ?? 0);
    const d = deviationFor(activeBinding, tierIdx, rollCount, counts);
    const color = d.severity === 'error' ? STATUS_ERROR : d.severity === 'warn' ? STATUS_WARNING : STATUS_SUCCESS;
    return { label: d.label, color };
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
            {RARITY_TIERS.map((tier, tierIdx) => {
              const dev = getDeviation(tierIdx);
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
