'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_37, withOpacity,
} from '@/lib/chart-colors';
import {
  type AbilityCategory, type AbilityMeta, type AbilitySortKey, type AbilitySortDir,
  ABILITY_CATEGORY_MAP, INPUT_BINDINGS, sortAbilities,
} from '../_shared/data';

const TIER_DOT_COUNT = 5;

interface Props {
  category: AbilityCategory;
  abilities: AbilityMeta[];
  sortKey: AbilitySortKey;
  sortDir: AbilitySortDir;
}

/** Collapsible section listing all abilities in one category, with tier/damage badges. */
export function AbilityCategoryGroup({ category, abilities, sortKey, sortDir }: Props) {
  const def = ABILITY_CATEGORY_MAP.get(category)!;
  const [collapsed, setCollapsed] = useState(false);
  const sorted = useMemo(() => sortAbilities(abilities, sortKey, sortDir), [abilities, sortKey, sortDir]);

  if (abilities.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 mb-1.5 pb-1 border-b w-full text-left cursor-pointer group transition-colors"
        style={{ borderColor: withOpacity(def.color, OPACITY_12) }}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="w-3 h-3" style={{ color: def.color }} />
        </motion.div>
        <span
          className="w-1 h-3 rounded-full"
          style={{ backgroundColor: def.color, boxShadow: `0 0 6px ${withOpacity(def.color, OPACITY_37)}` }}
        />
        <span
          className="text-xs font-mono font-bold uppercase tracking-[0.18em] group-hover:brightness-125 transition-all"
          style={{ color: def.color }}
        >
          {def.label}
        </span>
        <span className="text-[10px] font-mono text-text-muted ml-auto">{abilities.length} abilities</span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-px">
              {sorted.map((a) => (
                <AbilityRow key={a.id} ability={a} catColor={def.color} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AbilityRow({ ability, catColor }: { ability: AbilityMeta; catColor: string }) {
  const binding = INPUT_BINDINGS.find((b) => b.action === ability.action);
  const key = binding?.defaultKey ?? '—';

  return (
    <li
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono"
      style={{ backgroundColor: withOpacity(catColor, OPACITY_8) }}
    >
      <span
        className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded text-[10px] font-bold tabular-nums"
        style={{
          color: catColor,
          backgroundColor: withOpacity(catColor, OPACITY_12),
          border: `1px solid ${withOpacity(catColor, OPACITY_20)}`,
        }}
      >
        {key}
      </span>
      <span className="font-bold text-text flex-1 truncate">{ability.name}</span>
      <TierDots tier={ability.tier} color={catColor} />
      <span
        className="text-[10px] tabular-nums w-12 text-right"
        style={{ color: ability.baseDamage > 0 ? catColor : 'var(--text-muted)' }}
      >
        {ability.baseDamage > 0 ? `${ability.baseDamage} dmg` : '—'}
      </span>
    </li>
  );
}

function TierDots({ tier, color }: { tier: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Tier ${tier} of ${TIER_DOT_COUNT}`}>
      {Array.from({ length: TIER_DOT_COUNT }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < tier ? color : withOpacity(color, OPACITY_12) }}
        />
      ))}
    </span>
  );
}
