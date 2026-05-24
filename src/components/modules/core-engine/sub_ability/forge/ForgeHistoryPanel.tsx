'use client';

import { Sword } from 'lucide-react';
import { motion } from 'framer-motion';
import { OVERLAY_WHITE, OPACITY_2, OPACITY_8, OPACITY_20, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { ACCENT, DAMAGE_TYPE_COLORS } from './constants';

interface Props {
  history: ForgedAbility[];
  current: ForgedAbility | null;
  onSelect: (h: ForgedAbility) => void;
}

export function ForgeHistoryPanel({ history, current, onSelect }: Props) {
  if (history.length <= 1) return null;
  return (
    <BlueprintPanel color={ACCENT} className="p-3 space-y-2">
      <SectionHeader icon={Sword} label="Recent Forges" color={ACCENT} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {history.map((h, i) => (
          <motion.button
            key={`${h.className}-${i}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(h)}
            className="flex items-center gap-2 p-2 rounded-md text-left transition-colors hover:bg-zinc-800/50"
            style={{
              background: current === h ? withOpacity(ACCENT, OPACITY_8) : withOpacity(OVERLAY_WHITE, OPACITY_2),
              border: current === h ? `1px solid ${withOpacity(ACCENT, OPACITY_20)}` : '1px solid transparent',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: DAMAGE_TYPE_COLORS[h.stats.damageType] ?? DAMAGE_TYPE_COLORS.None,
              }}
            />
            <div className="min-w-0">
              <div className="text-xs text-zinc-300 truncate">{h.displayName}</div>
              <div className="text-[9px] font-mono text-zinc-600 truncate">{h.className}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </BlueprintPanel>
  );
}
