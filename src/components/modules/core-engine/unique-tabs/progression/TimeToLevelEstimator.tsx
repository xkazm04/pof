'use client';

import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, LiveMetricGauge } from '../_shared';
import { ACCENT } from './progression-data';
import type { GaugeMetric } from '@/types/unique-tab-improvements';

const TTL_GAUGES: GaugeMetric[] = [
  { label: 'XP/min', current: 342, target: 500, unit: '/min', trend: 'up' },
  { label: 'Next Level', current: 68, target: 100, unit: '%', trend: 'up' },
  { label: 'Session XP', current: 12450, target: 20000, unit: 'XP', trend: 'stable' },
];

const TTL_TIMELINES = [
  { label: 'Casual (30min/day)', daysToMax: 145, color: ACCENT_CYAN },
  { label: 'Hardcore (4hr/day)', daysToMax: 18, color: STATUS_ERROR },
];

export function TimeToLevelEstimator() {
  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden">
      <SectionLabel icon={Clock} label="Time-to-Level Estimator" color={ACCENT} />

      <div className="mt-2.5 flex items-center justify-center gap-4">
        {TTL_GAUGES.map(g => (
          <LiveMetricGauge key={g.label} metric={g} accent={ACCENT} size={90} />
        ))}
      </div>

      <div className="mt-3 pt-4 border-t border-border/40 space-y-3">
        <div className="text-2xs font-mono text-text-muted uppercase tracking-wider">Playstyle Comparison</div>
        {TTL_TIMELINES.map(t => (
          <div key={t.label} className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-text">{t.label}</span>
              <span className="font-bold" style={{ color: t.color }}>{t.daysToMax} days to max</span>
            </div>
            <div className="relative h-3 bg-surface-deep rounded-full overflow-hidden border border-border/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((145 / t.daysToMax) * (t.daysToMax / 145) * 100, 100)}%` }}
                transition={{ duration: 1 }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: t.color, opacity: 0.6 }}
              />
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
