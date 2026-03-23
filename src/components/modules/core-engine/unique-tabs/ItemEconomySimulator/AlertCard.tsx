'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { OPACITY_10 } from '@/lib/chart-colors';
import { ALERT_COLORS } from './constants';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { EconomyAlert } from '@/lib/economy/item-economy-engine';

/* ── Alert Card ───────────────────────────────────────────────────────── */

export function AlertCard({ alert }: { alert: EconomyAlert }) {
  const color = ALERT_COLORS[alert.severity] ?? STATUS_WARNING;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 px-2.5 py-2 rounded-md text-xs"
      style={{
        backgroundColor: `${color}${OPACITY_10}`,
        border: `1px solid ${color}30`,
      }}
    >
      <AlertTriangle
        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
        style={{ color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold uppercase" style={{ color }}>
            {alert.severity}
          </span>
          <span className="font-mono text-text-muted">{alert.type}</span>
          {alert.level > 0 && (
            <span className="font-mono text-text-muted ml-auto">
              Lv{alert.level}
            </span>
          )}
        </div>
        <p className="text-text mt-0.5">{alert.message}</p>
      </div>
    </motion.div>
  );
}
