'use client';

import { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_INFO, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel } from '../../unique-tabs/_design';
import { BREAKPOINT_ILVLS } from './constants';
import { AFFIX_POOL, RARITIES, getItemLevelScaling } from './data';
import { BreakpointLegend } from './BreakpointLegend';
import { BreakpointFilters } from './BreakpointFilters';
import { BreakpointRow } from './BreakpointRow';
import type { Rarity } from './data';
import type { PoolCategory } from './types';

interface BreakpointTableProps {
  bpCategoryFilter: PoolCategory;
  setBpCategoryFilter: (f: PoolCategory) => void;
  bpRarityFilter: Rarity | 'all';
  setBpRarityFilter: (r: Rarity | 'all') => void;
  bpSearch: string;
  setBpSearch: (s: string) => void;
}

export function BreakpointTable({
  bpCategoryFilter, setBpCategoryFilter,
  bpRarityFilter, setBpRarityFilter,
  bpSearch, setBpSearch,
}: BreakpointTableProps) {
  const breakpointData = useMemo(() => {
    let filtered = AFFIX_POOL;
    if (bpCategoryFilter !== 'all') filtered = filtered.filter(a => a.category === bpCategoryFilter);
    if (bpRarityFilter !== 'all') {
      const rarityIdx = RARITIES.indexOf(bpRarityFilter);
      filtered = filtered.filter(a => RARITIES.indexOf(a.minRarity) <= rarityIdx);
    }
    if (bpSearch.trim()) {
      const q = bpSearch.toLowerCase();
      filtered = filtered.filter(a => a.displayName.toLowerCase().includes(q) || a.stat.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q));
    }
    return filtered.map(affix => {
      const tiers = BREAKPOINT_ILVLS.map(ilvl => {
        const scale = getItemLevelScaling(ilvl);
        return { ilvl, min: +(affix.minValue * scale).toFixed(1), max: +(affix.maxValue * scale).toFixed(1), scale };
      });
      const ratio = tiers[tiers.length - 1].max / tiers[0].max;
      const scalingFlag = ratio > 8 ? 'aggressive' as const : ratio < 3 ? 'flat' as const : null;
      return { affix, tiers, scalingFlag, ratio };
    });
  }, [bpCategoryFilter, bpRarityFilter, bpSearch]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <BreakpointFilters
        bpCategoryFilter={bpCategoryFilter}
        setBpCategoryFilter={setBpCategoryFilter}
        bpRarityFilter={bpRarityFilter}
        setBpRarityFilter={setBpRarityFilter}
        bpSearch={bpSearch}
        setBpSearch={setBpSearch}
        resultCount={breakpointData.length}
      />

      {/* Table */}
      <BlueprintPanel color={STATUS_INFO} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: `1px solid ${withOpacity(STATUS_INFO, OPACITY_15)}` }}>
                <th className="text-left px-3 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em] sticky left-0 bg-surface-deep z-10">Affix</th>
                <th className="text-left px-2 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em]">Type</th>
                <th className="text-left px-2 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em]">Stat</th>
                <th className="text-left px-2 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em]">Min Rarity</th>
                {BREAKPOINT_ILVLS.map(ilvl => (
                  <th key={ilvl} className="text-center px-2 py-2.5 font-bold uppercase tracking-[0.15em]" style={{ color: STATUS_INFO }}>
                    iLvl {ilvl}
                    <div className="text-[9px] font-normal opacity-60">{getItemLevelScaling(ilvl).toFixed(1)}x</div>
                  </th>
                ))}
                <th className="text-center px-2 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em]">Scale</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-bold uppercase tracking-[0.15em]">
                  <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> Loot Filter</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {breakpointData.map(({ affix, tiers, scalingFlag, ratio }, ri) => (
                <BreakpointRow
                  key={affix.id}
                  affix={affix}
                  tiers={tiers}
                  scalingFlag={scalingFlag}
                  ratio={ratio}
                  index={ri}
                />
              ))}
              {breakpointData.length === 0 && (
                <tr><td colSpan={9 + BREAKPOINT_ILVLS.length} className="px-4 py-8 text-center text-text-muted">No affixes match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </BlueprintPanel>

      <BreakpointLegend />
    </motion.div>
  );
}
