'use client';

import { Filter, Skull } from 'lucide-react';
import { BlueprintPanel } from './design';
import { ACCENT, RARITY_TIERS } from './data';
import { ARCHETYPES } from '../EnemyBestiary/data';

import { withOpacity, OPACITY_10, OPACITY_15, OPACITY_12, OPACITY_50, OPACITY_25 } from '@/lib/chart-colors';
const enemyMap = new Map(ARCHETYPES.map(a => [a.id, a]));

const RARITY_OPTIONS = ['All', ...RARITY_TIERS.map(t => t.name)] as const;
type RarityFilter = (typeof RARITY_OPTIONS)[number];

interface LootFiltersProps {
  rarityFilter: RarityFilter;
  setRarityFilter: (f: RarityFilter) => void;
  enemyFilter: string;
  setEnemyFilter: (f: string) => void;
  activeRarityColor: string;
}

export function LootFilters({ rarityFilter, setRarityFilter, enemyFilter, setEnemyFilter, activeRarityColor }: LootFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <BlueprintPanel className="p-3 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3.5 h-3.5" style={{ color: activeRarityColor }} />
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: activeRarityColor }}>
            Rarity Filter
          </span>
          {rarityFilter !== 'All' && (
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: withOpacity(activeRarityColor, OPACITY_10), color: activeRarityColor }}>
              {rarityFilter}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RARITY_OPTIONS.map((opt) => {
            const isActive = rarityFilter === opt;
            const optColor = opt === 'All' ? ACCENT : (RARITY_TIERS.find(t => t.name === opt)?.color ?? ACCENT);
            return (
              <button key={opt} onClick={() => setRarityFilter(opt)}
                className="px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors border cursor-pointer"
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
          <Skull className="w-3.5 h-3.5" style={{ color: enemyFilter !== 'all' ? (enemyMap.get(enemyFilter)?.color ?? ACCENT) : ACCENT }} />
          <span className="text-xs font-mono uppercase tracking-wider"
            style={{ color: enemyFilter !== 'all' ? (enemyMap.get(enemyFilter)?.color ?? ACCENT) : ACCENT }}>
            Enemy Source
          </span>
        </div>
        <select
          value={enemyFilter}
          onChange={(e) => setEnemyFilter(e.target.value)}
          className="w-full px-2 py-1.5 rounded text-[11px] font-mono bg-white/5 border border-white/10 text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-white/25"
          style={{
            borderColor: enemyFilter !== 'all' ? withOpacity(enemyMap.get(enemyFilter)?.color ?? ACCENT, OPACITY_25) : undefined,
          }}
        >
          <option value="all">All Enemies</option>
          {ARCHETYPES.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        {enemyFilter !== 'all' && (
          <div className="mt-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded inline-block"
            style={{
              backgroundColor: withOpacity(enemyMap.get(enemyFilter)?.color ?? ACCENT, OPACITY_10),
              color: enemyMap.get(enemyFilter)?.color ?? ACCENT,
            }}>
            Highlighting drops for {enemyMap.get(enemyFilter)?.label ?? enemyFilter}
          </div>
        )}
      </BlueprintPanel>
    </div>
  );
}
