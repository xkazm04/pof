'use client';

import { motion } from 'framer-motion';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowUpCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { SummaryCard } from './SummaryCard';
import { STATUS_COLORS, STATUS_LABELS, STATUS_KEYS, type StatusKey } from './constants';

type Totals = Record<StatusKey, number> & { total: number };

export function OverallSummary({
  totals,
  overallPct,
  onRefresh,
}: {
  totals: Totals;
  overallPct: number;
  onRefresh: () => void;
}) {
  return (
    <>
      {/* ── Overall progress cards ─────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Overall"
          value={`${overallPct}%`}
          sub={`${totals.implemented + totals.improved}/${totals.total}`}
          color={STATUS_SUCCESS}
        />
        {STATUS_KEYS.map((key) => (
          <SummaryCard
            key={key}
            icon={key === 'improved' ? ArrowUpCircle : key === 'implemented' ? CheckCircle2 : key === 'partial' ? AlertTriangle : key === 'missing' ? XCircle : HelpCircle}
            label={STATUS_LABELS[key]}
            value={`${totals[key]}`}
            sub={totals.total > 0 ? `${Math.round((totals[key] / totals.total) * 100)}%` : '0%'}
            color={STATUS_COLORS[key]}
          />
        ))}
      </div>

      {/* ── Stacked completion bar ──────────────────────── */}
      <SurfaceCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Project Feature Status
          </span>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="h-3 bg-border rounded-full overflow-hidden flex">
          {STATUS_KEYS.map((key) => {
            const pct = totals.total > 0 ? (totals[key] / totals.total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <motion.div
                key={key}
                className="h-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                style={{ backgroundColor: STATUS_COLORS[key] }}
                title={`${STATUS_LABELS[key]}: ${totals[key]} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {STATUS_KEYS.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-2xs" style={{ color: STATUS_COLORS[key] }}>
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
              {STATUS_LABELS[key]} ({totals[key]})
            </span>
          ))}
        </div>
      </SurfaceCard>
    </>
  );
}
