import { motion } from 'framer-motion';
import { TrendingUp, Star, AlertTriangle, Clock } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_STALE,
} from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { MetricCard } from './MetricCard';
import type { CellData, Totals } from './types';

interface SummaryPanelsProps {
  overallPct: number;
  totals: Totals;
  overallQuality: number | null;
  cells: CellData[];
  worstModules: CellData[];
  staleModules: CellData[];
  customStaleDays: number;
}

export function SummaryPanels({
  overallPct,
  totals,
  overallQuality,
  cells,
  worstModules,
  staleModules,
  customStaleDays,
}: SummaryPanelsProps) {
  return (
    <>
      {/* ── Top metrics row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Overall Progress"
          value={`${overallPct}%`}
          sub={`${totals.implemented} / ${totals.total} features`}
          accent={STATUS_SUCCESS}
        />
        <MetricCard
          icon={Star}
          label="Avg Quality"
          value={overallQuality !== null ? `${overallQuality} / 5` : '--'}
          sub={`${totals.reviewed} / ${cells.length} modules reviewed`}
          accent={STATUS_WARNING}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={`${worstModules.length}`}
          sub="modules below quality 3"
          accent={STATUS_ERROR}
        />
        <MetricCard
          icon={Clock}
          label="Stale Reviews"
          value={`${staleModules.length}`}
          sub={`not reviewed in ${customStaleDays}d`}
          accent={STATUS_STALE}
        />
      </div>

      {/* ── Project completion bar ──────────────────────────────────────── */}
      <SurfaceCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Project Completion
          </span>
          <span className="text-xs text-text-muted">
            {totals.implemented} implemented / {totals.partial} partial / {totals.missing} missing / {totals.unknown} unknown
          </span>
        </div>
        <div className="h-2.5 bg-border rounded-full overflow-hidden flex">
          {totals.implemented > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.implemented / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease }}
              style={{ backgroundColor: STATUS_SUCCESS }}
            />
          )}
          {totals.partial > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.partial / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease, delay: 0.1 }}
              style={{ backgroundColor: STATUS_WARNING }}
            />
          )}
          {totals.missing > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.missing / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease, delay: 0.2 }}
              style={{ backgroundColor: STATUS_ERROR }}
            />
          )}
        </div>
      </SurfaceCard>
    </>
  );
}
