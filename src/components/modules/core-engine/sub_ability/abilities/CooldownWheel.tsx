'use client';

import { motion } from 'framer-motion';
import {
  ACCENT_GREEN, OVERLAY_WHITE,
  withOpacity, OPACITY_6,
} from '@/lib/chart-colors';

/* ── Cooldown Wheel component ─────────────────────────────────────────── */

export function CooldownWheel({ ability, index }: { ability: { name: string; cd: number; remaining: number; color: string }; index: number }) {
  const size = 56;
  const strokeW = 5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = ability.remaining / ability.cd;
  const ready = ability.remaining === 0;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth={strokeW} />
          {/* Cooldown arc */}
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={ready ? ACCENT_GREEN : ability.color}
            strokeWidth={strokeW}
            strokeDasharray={circ}
            strokeDashoffset={circ * pct}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 4px ${ready ? ACCENT_GREEN : ability.color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xs font-mono font-bold" style={{ color: ready ? ACCENT_GREEN : ability.color }}>
            {ready ? 'READY' : `${ability.remaining.toFixed(1)}s`}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-mono font-bold text-text truncate max-w-[70px]">{ability.name}</div>
        <div className="text-xs font-mono text-text-muted">{ability.cd}s CD</div>
      </div>
    </motion.div>
  );
}
