'use client';

import { Filter, Skull } from 'lucide-react';
import { BlueprintPanel } from './_shared/design';
import { RarityBadge } from './_shared/rarityBadge';
import { ACCENT, RARITY_TIERS, rarityColorFor } from './_shared/data';
import { useLootTuningStore } from './_shared/lootTuningStore';
import { findBinding, tierGroups } from './_shared/bindingTuner';

import { withOpacity, OPACITY_10, OPACITY_15, OPACITY_12, OPACITY_50, OPACITY_25 } from '@/lib/chart-colors';

const RARITY_OPTIONS = ['All', ...RARITY_TIERS.map(t => t.name)] as const;
type RarityFilter = (typeof RARITY_OPTIONS)[number];

interface LootFiltersProps {
  rarityFilter: RarityFilter;
  setRarityFilter: (f: RarityFilter) => void;
  activeRarityColor: string;
  /** Called after an enemy is picked, so the host can bring the Core-tab tuner into view. */
  onEnemyPicked?: (id: string) => void;
}

export function LootFilters({ rarityFilter, setRarityFilter, activeRarityColor, onEnemyPicked }: LootFiltersProps) {
  const baseline = useLootTuningStore((s) => s.baseline);
  const selectedId = useLootTuningStore((s) => s.selectedId);
  const dispatch = useLootTuningStore((s) => s.dispatch);
  const activeEnemy = findBinding(baseline, selectedId);
  const enemyColor = activeEnemy?.color ?? ACCENT;
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <BlueprintPanel className="p-3 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3.5 h-3.5" style={{ color: activeRarityColor }} />
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: activeRarityColor }}>
            Rarity Filter
          </span>
          {rarityFilter !== 'All' && (
            <RarityBadge rarity={rarityFilter} className="ml-auto" />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RARITY_OPTIONS.map((opt) => {
            const isActive = rarityFilter === opt;
            const optColor = opt === 'All' ? ACCENT : rarityColorFor(opt);
            return (
              <button key={opt} onClick={() => setRarityFilter(opt)}
                className="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors border cursor-pointer"
                style={{
                  borderColor: isActive ? optColor : withOpacity(optColor, OPACITY_15),
                  backgroundColor: isActive ? withOpacity(optColor, OPACITY_12) : 'transparent',
                  color: isActive ? optColor : withOpacity(optColor, OPACITY_50),
                }}>
                {opt}
              </button>
            );
          })}
        </div>
      </BlueprintPanel>

      <BlueprintPanel className="p-3 sm:w-56">
        <div className="flex items-center gap-2 mb-2">
          <Skull className="w-3.5 h-3.5" style={{ color: enemyColor }} />
          <span className="text-xs font-mono uppercase tracking-wider"
            style={{ color: enemyColor }}>
            Enemy Source
          </span>
        </div>
        <select
          aria-label="Enemy Source"
          value={selectedId ?? 'none'}
          onChange={(e) => {
            const id = e.target.value === 'none' ? null : e.target.value;
            dispatch({ type: 'select', id });
            if (id) onEnemyPicked?.(id);
          }}
          className="w-full px-2 py-1.5 rounded text-xs font-mono bg-white/5 border border-white/10 text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-white/25"
          style={{
            borderColor: activeEnemy ? withOpacity(enemyColor, OPACITY_25) : undefined,
          }}
        >
          <option value="none">Pick an enemy to tune</option>
          {tierGroups(baseline).map(({ tier, bindings }) => (
            <optgroup key={tier} label={tier}>
              {bindings.map((b) => (
                <option key={b.archetypeId} value={b.archetypeId}>{b.archetypeName}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {activeEnemy && (
          <div className="mt-1.5 text-2xs font-mono px-1.5 py-0.5 rounded inline-block"
            style={{
              backgroundColor: withOpacity(enemyColor, OPACITY_10),
              color: enemyColor,
            }}>
            Tuning {activeEnemy.lootTableName} (Core tab)
          </div>
        )}
      </BlueprintPanel>
    </div>
  );
}
