'use client';

import { motion } from 'framer-motion';
import {
  OVERLAY_WHITE,
  withOpacity, OPACITY_6, OPACITY_25,
} from '@/lib/chart-colors';
import type { SpellbookCooldownRow } from '../_shared/types';

/* ── Cooldown Wheel component ─────────────────────────────────────────── */

/** `1` -> `1s`, `0.5` -> `0.5s`: the authored catalog number, never re-rounded. */
export const formatCd = (cd: number) => `${cd}s`;

/**
 * One cooldown drawn against the longest cooldown in view (`maxCd`): a full ring is
 * the longest. There is no runtime `remaining` - this is a design tool, not a HUD.
 * `cd: null` (duration lives only in a GE blueprint) draws an empty dashed ring
 * labelled "CD in GE" instead of dividing by an unknown.
 */
export function CooldownWheel({ ability, maxCd, index }: {
  ability: Pick<SpellbookCooldownRow, 'name' | 'cd' | 'color'>;
  maxCd: number;
  index: number;
}) {
  const size = 56;
  const strokeW = 5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const known = ability.cd !== null;
  const pct = known && maxCd > 0 ? Math.min(Math.max(ability.cd! / maxCd, 0), 1) : 0;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring (dashed when the duration is unknown) */}
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={withOpacity(known ? OVERLAY_WHITE : ability.color, known ? OPACITY_6 : OPACITY_25)}
            strokeWidth={strokeW} strokeDasharray={known ? undefined : '3 4'}
          />
          {/* Cooldown arc: share of the longest cooldown in view */}
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={ability.color}
            strokeWidth={strokeW}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap={pct > 0 ? 'round' : 'butt'}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: pct > 0 ? `drop-shadow(0 0 4px ${ability.color})` : undefined }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xs font-mono font-bold" style={{ color: ability.color }}>
            {known ? formatCd(ability.cd!) : '?'}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-mono font-bold text-text truncate max-w-[70px]">{ability.name}</div>
        <div className="text-xs font-mono text-text-muted">{known ? 'CD' : 'CD in GE'}</div>
      </div>
    </motion.div>
  );
}
