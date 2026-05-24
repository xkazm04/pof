'use client';

import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR, STATUS_WARNING,
  ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_25,
  withOpacity,
} from '@/lib/chart-colors';
import { ACCENT, CATEGORY_COLORS } from './constants';
import { RARITY_COLORS } from './data';
import type { AffixPoolEntry } from './data';

interface Tier {
  ilvl: number;
  min: number;
  max: number;
  scale: number;
}

interface BreakpointRowProps {
  affix: AffixPoolEntry;
  tiers: Tier[];
  scalingFlag: 'aggressive' | 'flat' | null;
  ratio: number;
  index: number;
}

export function BreakpointRow({ affix, tiers, scalingFlag, ratio, index }: BreakpointRowProps) {
  const catColor = CATEGORY_COLORS[affix.category] ?? ACCENT;
  const rarityColor = RARITY_COLORS[affix.minRarity];
  const filterName = affix.bIsPrefix ? `${affix.displayName} [Item]` : `[Item] ${affix.displayName}`;
  return (
    <motion.tr key={affix.id}
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-white/[0.02] transition-colors group"
      style={{ borderBottom: `1px solid ${withOpacity(ACCENT, OPACITY_8)}` }}>
      <td className="px-3 py-2 sticky left-0 bg-surface-deep z-10 group-hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
          <span className="font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(catColor, OPACITY_25)}` }}>{affix.displayName}</span>
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
              style={{ backgroundColor: `${catColor}${intensity > 0.7 ? OPACITY_20 : intensity > 0.3 ? OPACITY_10 : OPACITY_5}` }}>
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
            backgroundColor: scalingFlag === 'aggressive' ? `${STATUS_ERROR}${OPACITY_10}` : scalingFlag === 'flat' ? `${STATUS_WARNING}${OPACITY_10}` : `${ACCENT}${OPACITY_5}`,
          }}>
          {ratio.toFixed(1)}x
          {scalingFlag === 'aggressive' && <AlertTriangle className="w-3 h-3 inline ml-1" />}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 px-2 py-1 rounded"
          style={{ border: `1px solid ${withOpacity(rarityColor, OPACITY_20)}`, backgroundColor: withOpacity(rarityColor, OPACITY_5) }}>
          <span className="w-1 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: rarityColor }} />
          <span style={{ color: rarityColor }}>{filterName}</span>
          <span className="ml-auto text-text-muted opacity-50 text-[9px]">+{tiers[tiers.length - 1].min}-{tiers[tiers.length - 1].max} {affix.stat}</span>
        </div>
      </td>
    </motion.tr>
  );
}
