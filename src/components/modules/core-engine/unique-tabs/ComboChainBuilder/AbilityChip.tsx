'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import type { ComboAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';

export function AbilityChip({ ability, onAdd }: { ability: ComboAbility; onAdd: (id: string) => void }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.button
      whileHover={prefersReduced ? undefined : { scale: 1.05 }}
      whileTap={prefersReduced ? undefined : { scale: 0.95 }}
      onClick={() => onAdd(ability.id)}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-[0.15em] border cursor-pointer transition-colors"
      style={{
        backgroundColor: `${ability.color}${OPACITY_15}`,
        borderColor: `${ability.color}${OPACITY_30}`,
        color: ability.color,
      }}
    >
      <Plus className="w-3 h-3" />
      {ability.name}
      {ability.damage > 0 && <span className="opacity-60">{ability.damage}</span>}
    </motion.button>
  );
}
