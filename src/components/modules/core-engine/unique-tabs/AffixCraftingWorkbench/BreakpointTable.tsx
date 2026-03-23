'use client';

import { useMemo } from 'react';
import { Filter, Eye, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import { ACCENT, BREAKPOINT_ILVLS, CATEGORY_COLORS } from './constants';
import {
  AFFIX_POOL, RARITIES, RARITY_COLORS, getItemLevelScaling,
} from './data';
import { BreakpointLegend } from './BreakpointLegend';
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <Filter className="w-3 h-3" /> Filters:
        </div>
        <div className="flex gap-1">
          {(['all', 'offensive', 'defensive', 'utility'] as const).map(cat => (
            <button key={cat} onClick={() => setBpCategoryFilter(cat)}
              className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.15em] capitalize transition-all"
              style={{
                backgroundColor: bpCategoryFilter === cat ? `${cat === 'all' ? ACCENT : CATEGORY_COLORS[cat]}${OPACITY_20}` : 'transparent',
                color: bpCategoryFilter === cat ? (cat === 'all' ? ACCENT : CATEGORY_COLORS[cat]) : 'var(--text-muted)',
                border: `1px solid ${bpCategoryFilter === cat ? `${cat === 'all' ? ACCENT : CATEGORY_COLORS[cat]}50` : `${ACCENT}25`}`,
              }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setBpRarityFilter('all')}
            className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.15em] transition-all"
            style={{
              backgroundColor: bpRarityFilter === 'all' ? `${ACCENT}${OPACITY_20}` : 'transparent',
              color: bpRarityFilter === 'all' ? ACCENT : 'var(--text-muted)',
              border: `1px solid ${bpRarityFilter === 'all' ? `${ACCENT}50` : `${ACCENT}25`}`,
            }}>
            All
          </button>
          {RARITIES.map(r => (
            <button key={r} onClick={() => setBpRarityFilter(r)}
              className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.15em] transition-all"
              style={{
                backgroundColor: bpRarityFilter === r ? `${RARITY_COLORS[r]}${OPACITY_20}` : 'transparent',
                color: bpRarityFilter === r ? RARITY_COLORS[r] : 'var(--text-muted)',
                border: `1px solid ${bpRarityFilter === r ? `${RARITY_COLORS[r]}50` : `${ACCENT}25`}`,
              }}>
              {r}
            </button>
          ))}
        </div>
        <input type="text" value={bpSearch} onChange={(e) => setBpSearch(e.target.value)}
          placeholder="Search affixes..."
          className="px-2 py-1 rounded text-[10px] font-mono bg-surface-deep text-text placeholder:text-text-muted/50 w-40 focus:outline-none focus:ring-1"
          style={{ border: `1px solid ${ACCENT}25`, '--tw-ring-color': STATUS_INFO } as React.CSSProperties} />
        <span className="ml-auto text-[10px] font-mono text-text-muted">{breakpointData.length} affix{breakpointData.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Table */}
      <BlueprintPanel color={STATUS_INFO} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr style={{ borderBottom: `1px solid ${STATUS_INFO}25` }}>
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
              {breakpointData.map(({ affix, tiers, scalingFlag, ratio }, ri) => {
                const catColor = CATEGORY_COLORS[affix.category] ?? ACCENT;
                const rarityColor = RARITY_COLORS[affix.minRarity];
                const filterName = affix.bIsPrefix ? `${affix.displayName} [Item]` : `[Item] ${affix.displayName}`;
                return (
                  <motion.tr key={affix.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: ri * 0.02 }}
                    className="hover:bg-white/[0.02] transition-colors group"
                    style={{ borderBottom: `1px solid ${ACCENT}12` }}>
                    <td className="px-3 py-2 sticky left-0 bg-surface-deep z-10 group-hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                        <span className="font-bold text-text" style={{ textShadow: `0 0 12px ${catColor}40` }}>{affix.displayName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="px-1.5 py-0.5 rounded font-bold uppercase"
                        style={{ backgroundColor: affix.bIsPrefix ? `${ACCENT_CYAN}${OPACITY_10}` : `${ACCENT_EMERALD}${OPACITY_10}`, color: affix.bIsPrefix ? ACCENT_CYAN : ACCENT_EMERALD }}>
                        {affix.bIsPrefix ? 'Prefix' : 'Suffix'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-text-muted">{affix.stat}</td>
                    <td className="px-2 py-2">
                      <span className="font-bold" style={{ color: rarityColor }}>{affix.minRarity}</span>
                    </td>
                    {tiers.map(({ ilvl, min, max }) => {
                      const maxAtHighest = tiers[tiers.length - 1].max;
                      const intensity = maxAtHighest > 0 ? max / maxAtHighest : 0;
                      return (
                        <td key={ilvl} className="px-2 py-2 text-center">
                          <div className="inline-block px-2 py-0.5 rounded"
                            style={{ backgroundColor: `${catColor}${intensity > 0.7 ? OPACITY_20 : intensity > 0.3 ? OPACITY_10 : '05'}` }}>
                            <span className="text-text-muted">{min}</span>
                            <span className="text-text-muted opacity-40">-</span>
                            <span className="font-bold" style={{ color: catColor }}>{max}</span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <span className="font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: scalingFlag === 'aggressive' ? STATUS_ERROR : scalingFlag === 'flat' ? STATUS_WARNING : ACCENT,
                          backgroundColor: scalingFlag === 'aggressive' ? `${STATUS_ERROR}${OPACITY_10}` : scalingFlag === 'flat' ? `${STATUS_WARNING}${OPACITY_10}` : `${ACCENT}05`,
                        }}>
                        {ratio.toFixed(1)}x
                        {scalingFlag === 'aggressive' && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 px-2 py-1 rounded"
                        style={{ border: `1px solid ${rarityColor}30`, backgroundColor: `${rarityColor}08` }}>
                        <span className="w-1 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: rarityColor }} />
                        <span style={{ color: rarityColor }}>{filterName}</span>
                        <span className="ml-auto text-text-muted opacity-50 text-[9px]">+{tiers[tiers.length - 1].min}-{tiers[tiers.length - 1].max} {affix.stat}</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
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
