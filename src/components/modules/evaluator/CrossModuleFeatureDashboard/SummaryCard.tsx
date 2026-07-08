'use client';

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { MOTION } from '@/lib/constants';

// ── Sub-component ──

export function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base }}
      className="bg-surface border border-border rounded-lg p-3"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-2xs text-text-muted mt-0.5">{sub}</div>
    </motion.div>
  );
}
