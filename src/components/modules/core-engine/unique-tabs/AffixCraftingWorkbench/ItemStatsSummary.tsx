'use client';

import { Coins, Lock, Unlock, CircleDollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_EMERALD, ACCENT_PURPLE,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { ACCENT } from './constants';
import { SYNERGY_COLORS, getItemLevelScaling } from './data';
import type { CraftedAffix, SynergyRule } from './data';
import type { CurrencyId } from './types';

interface ItemStatsSummaryProps {
  craftedAffixes: CraftedAffix[];
  maxAffixes: number;
  itemLevel: number;
  activeSynergies: SynergyRule[];
  wallet: Record<CurrencyId, number>;
  prefixLocked: boolean;
  suffixLocked: boolean;
  totalSpent: Record<CurrencyId, number>;
}

export function ItemStatsSummary({
  craftedAffixes, maxAffixes, itemLevel, activeSynergies,
  wallet, prefixLocked, suffixLocked, totalSpent,
}: ItemStatsSummaryProps) {
  const lockLabel = prefixLocked && suffixLocked ? 'Both'
    : prefixLocked ? 'Prefix' : suffixLocked ? 'Suffix' : 'None';
  const hasLocks = prefixLocked || suffixLocked;

  const rows: { label: string; value: string | number; color: string; icon?: React.ReactNode }[] = [
    {
      label: 'Affixes',
      value: `${craftedAffixes.length}/${maxAffixes}`,
      color: craftedAffixes.length >= maxAffixes ? STATUS_WARNING : ACCENT,
    },
    { label: 'Prefixes', value: craftedAffixes.filter(a => a.bIsPrefix).length, color: 'var(--text)' },
    { label: 'Suffixes', value: craftedAffixes.filter(a => !a.bIsPrefix).length, color: 'var(--text)' },
    { label: 'Level Scaling', value: `${getItemLevelScaling(itemLevel).toFixed(1)}x`, color: ACCENT },
    {
      label: 'Synergies',
      value: activeSynergies.length,
      color: activeSynergies.length > 0 ? SYNERGY_COLORS[activeSynergies[0].severity] : 'var(--text-muted)',
    },
  ];

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader label="Item Stats Summary" color={ACCENT} />
      <div className="mt-2 space-y-1.5">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.15em]">
            <span className="text-text-muted">{label}</span>
            <span className="font-bold" style={{ color, textShadow: `0 0 12px ${color}40` }}>{value}</span>
          </div>
        ))}

        <div className="border-t my-1 pt-1" style={{ borderColor: `${ACCENT}18` }} />

        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.15em]">
          <span className="text-text-muted flex items-center gap-1">
            <Coins className="w-3 h-3" /> Forging Pot.
          </span>
          <span className="font-bold"
            style={{
              color: wallet.forging <= 10 ? STATUS_ERROR : wallet.forging <= 30 ? STATUS_WARNING : ACCENT_EMERALD,
              textShadow: `0 0 12px ${ACCENT_EMERALD}40`,
            }}>
            {wallet.forging}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.15em]">
          <span className="text-text-muted flex items-center gap-1">
            {hasLocks ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} Locks
          </span>
          <span className="font-bold"
            style={{ color: hasLocks ? ACCENT_PURPLE : 'var(--text-muted)', textShadow: hasLocks ? `0 0 12px ${ACCENT_PURPLE}40` : 'none' }}>
            {lockLabel}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.15em]">
          <span className="text-text-muted flex items-center gap-1">
            <CircleDollarSign className="w-3 h-3" /> Total Spent
          </span>
          <span className="font-bold text-text">{Object.values(totalSpent).reduce((s, v) => s + v, 0)}</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
