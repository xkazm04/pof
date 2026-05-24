'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { ACCENT_GREEN, ACCENT_RED, OVERLAY_WHITE, OPACITY_25, OPACITY_30, OPACITY_50, GLOW_MD, withOpacity,
  OPACITY_8,
} from '@/lib/chart-colors';
import type { ComboAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';
import { TIMELINE_PX_PER_SEC } from './helpers';

/* ── Timeline block ─────────────────────────────────────────────────── */

export function TimelineBlock({
  ability, index, total, onRemove,
}: {
  ability: ComboAbility; index: number; total: number; onRemove: (i: number) => void;
}) {
  const w = ability.animDuration * TIMELINE_PX_PER_SEC;
  const dmgStart = ability.damageWindow[0] * TIMELINE_PX_PER_SEC;
  const dmgWidth = (ability.damageWindow[1] - ability.damageWindow[0]) * TIMELINE_PX_PER_SEC;
  const recoveryStart = ability.damageWindow[1] * TIMELINE_PX_PER_SEC;
  const recoveryWidth = ability.recovery * TIMELINE_PX_PER_SEC;
  const comboMult = index === 0 ? 1.0 : ability.comboMultiplier;
  const effectiveDmg = Math.round(ability.damage * comboMult);

  return (
    <motion.div
      className="relative flex-shrink-0 group"
      style={{ width: w, minWidth: 80 }}
      initial={{ opacity: 0, scale: 0.9, x: -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -10 }}
      transition={{ delay: index * 0.06 }}
    >
      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ backgroundColor: ACCENT_RED, color: OVERLAY_WHITE }}
      >
        <X className="w-2.5 h-2.5" />
      </button>

      {/* Block body */}
      <div
        className="h-14 rounded-lg border relative overflow-hidden"
        style={{
          backgroundColor: `${withOpacity(ability.color, OPACITY_8)}`,
          borderColor: withOpacity(ability.color, OPACITY_25),
        }}
      >
        {/* Startup phase (before damage window) */}
        <div
          className="absolute top-0 left-0 h-full opacity-20"
          style={{ width: dmgStart, backgroundColor: ability.color }}
        />
        {/* Damage window */}
        <div
          className="absolute top-0 h-full"
          style={{
            left: dmgStart, width: dmgWidth,
            backgroundColor: withOpacity(ability.color, OPACITY_30),
            boxShadow: `inset ${GLOW_MD} ${withOpacity(ability.color, OPACITY_25)}`,
          }}
        />
        {/* Recovery phase */}
        <div
          className="absolute top-0 h-full opacity-10"
          style={{ left: recoveryStart, width: recoveryWidth, backgroundColor: ability.color }}
        />
        {/* Labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-1">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] truncate max-w-full" style={{ color: ability.color }}>
            {ability.name}
          </span>
          {ability.damage > 0 && (
            <span className="text-[9px] font-mono text-text-muted">
              {effectiveDmg} dmg{comboMult > 1 && <span style={{ color: ACCENT_GREEN }}> x{comboMult}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Duration label */}
      <div className="text-center mt-0.5">
        <span className="text-[9px] font-mono text-text-muted">{ability.animDuration}s</span>
      </div>

      {/* Combo window arrow (except last) */}
      {index < total - 1 && (
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10">
          <motion.div
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: withOpacity(ability.color, OPACITY_50) }} />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Time ruler ─────────────────────────────────────────────────────── */

export function TimeRuler({ totalDuration }: { totalDuration: number }) {
  const ticks = useMemo(() => {
    const arr: number[] = [];
    const step = totalDuration <= 2 ? 0.25 : totalDuration <= 5 ? 0.5 : 1.0;
    for (let t = 0; t <= totalDuration + 0.01; t += step) {
      arr.push(Math.round(t * 100) / 100);
    }
    return arr;
  }, [totalDuration]);

  const totalPx = totalDuration * TIMELINE_PX_PER_SEC;

  return (
    <div className="relative mb-1" style={{ width: totalPx, minWidth: '100%' }}>
      <div className="h-[1px] bg-border/40 w-full" />
      {ticks.map(t => {
        const x = (t / totalDuration) * 100;
        return (
          <span
            key={t}
            className="absolute -top-3 text-[9px] font-mono text-text-muted -translate-x-1/2"
            style={{ left: `${Math.min(x, 100)}%` }}
          >
            {t.toFixed(1)}s
          </span>
        );
      })}
    </div>
  );
}
