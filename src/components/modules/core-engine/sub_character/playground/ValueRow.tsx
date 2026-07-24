'use client';

import { motion } from 'framer-motion';
import { NeonBar } from '../../unique-tabs/_design';

/* ── Value Display Row ────────────────────────────────────────────────────── */

export function ValueRow({ label, value, unit, color, min, max }: {
  label: string; value: number; unit: string; color: string; min: number; max: number;
}) {
  // Clamped: NeonBar caps the top end but a negative width is invalid CSS, so a
  // value below `min` (or a degenerate min===max range) would break the bar.
  const span = max - min;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(100, ((value - min) / span) * 100));
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 text-xs font-mono"
    >
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate">
        {label}
      </span>
      <div className="flex-1">
        <NeonBar pct={pct} color={color} height={5} glow />
      </div>
      <span className="font-bold min-w-[52px] text-right tabular-nums" style={{ color }}>
        {value}{unit}
      </span>
    </motion.div>
  );
}
