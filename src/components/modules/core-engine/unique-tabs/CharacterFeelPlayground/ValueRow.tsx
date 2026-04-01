'use client';

import { motion } from 'framer-motion';
import { NeonBar } from '../_design';

/* ── Value Display Row ────────────────────────────────────────────────────── */

export function ValueRow({ label, value, unit, color, min, max }: {
  label: string; value: number; unit: string; color: string; min: number; max: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
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
