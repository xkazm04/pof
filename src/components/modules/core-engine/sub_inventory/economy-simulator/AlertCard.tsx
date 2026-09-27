'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import {
  OPACITY_10, OPACITY_20, withOpacity,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { EconomyVerdict, VerdictState } from '@/lib/economy/item-economy-verdicts';

/* ── Verdict state colors (unmeasured is neutral — never a pass green) ── */

export const VERDICT_COLORS: Record<VerdictState, string> = {
  pass: STATUS_SUCCESS,
  warn: STATUS_WARNING,
  critical: STATUS_ERROR,
  unmeasured: STATUS_NEUTRAL,
};

const ICONS = { pass: CheckCircle2, warn: AlertTriangle, critical: AlertTriangle, unmeasured: HelpCircle };

/** Value in the unit its detector is defined in; an em dash when unmeasured. */
export function formatVerdictValue(v: EconomyVerdict, value: number | null = v.value): string {
  if (value === null) return '—';
  switch (v.family) {
    case 'rarity-inflation': return `${value.toFixed(1)}x`;
    case 'upgrade-drought': return `${value.toFixed(2)}/lvl`;
    default: return `${(value * 100).toFixed(1)}%`;
  }
}

/* ── Verdict Card ─ value vs threshold, basis, player consequence ─────── */

export function AlertCard({ verdict }: { verdict: EconomyVerdict }) {
  const color = VERDICT_COLORS[verdict.state];
  const Icon = ICONS[verdict.state];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 px-2.5 py-2 rounded-md text-xs"
      data-verdict={verdict.family}
      data-state={verdict.state}
      style={{
        backgroundColor: `${color}${OPACITY_10}`,
        border: `1px solid ${withOpacity(color, OPACITY_20)}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-mono font-bold uppercase"
            style={{ color: verdict.state === 'unmeasured' ? 'var(--text-muted)' : color }}
          >
            {verdict.state}
          </span>
          <span className="font-bold text-text">{verdict.label}</span>
          <span className="font-mono text-text-muted ml-auto">
            {formatVerdictValue(verdict)} (threshold {formatVerdictValue(verdict, verdict.threshold)})
            {verdict.level !== null && ` · Lv${verdict.level}`}
          </span>
        </div>
        <p className="text-text">{verdict.consequence}</p>
        <p className="font-mono text-text-muted">Basis: {verdict.basis}</p>
      </div>
    </motion.div>
  );
}
