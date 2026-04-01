'use client';

import { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { FeatureCard, LiveMetricGauge } from '../_shared';
import {
  ACCENT, ASSET_FEATURES, BUDGET_GAUGES,
  NOTIFY_ISSUES, MONTAGE_COVERAGES,
} from './data';
import type { FeatureRow } from '@/types/feature-matrix';

interface BudgetTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

export function BudgetTab({ featureMap, defs }: BudgetTabProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  return (
    <>
      {/* Asset list */}
      <div className="space-y-3 pt-2">
        <div className="px-1">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Anim Architecture Modules
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ASSET_FEATURES.map((name, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FeatureCard name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BudgetTracker />
        <NotifyCoverage />
      </div>
    </>
  );
}

/* ── Budget Tracker ────────────────────────────────────────────────────────── */

function BudgetTracker() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Animation Budget Tracker" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Current animation system resource usage vs budget limits.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {BUDGET_GAUGES.map((metric) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <LiveMetricGauge metric={metric} accent={ACCENT} size={110} />
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}

/* ── Notify Coverage ───────────────────────────────────────────────────────── */

function NotifyCoverage() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Notify Coverage Analyzer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Gaps in animation notify coverage. Errors must be resolved; warnings are advisory.
      </p>
      <div className="space-y-4">
        {/* Issue list */}
        <div className="space-y-1.5">
          {NOTIFY_ISSUES.map((issue, i) => (
            <motion.div
              key={`${issue.montage}-${i}`}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                backgroundColor: issue.severity === 'error' ? `${STATUS_ERROR}10` : `${STATUS_WARNING}08`,
                border: `1px solid ${issue.severity === 'error' ? `${STATUS_ERROR}30` : `${STATUS_WARNING}20`}`,
              }}
            >
              {issue.severity === 'error'
                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
              }
              <span className="font-mono font-bold text-text">{issue.montage}:</span>
              <span className="text-text-muted">{issue.message}</span>
              <span
                className="ml-auto text-xs font-bold uppercase px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: issue.severity === 'error' ? `${STATUS_ERROR}20` : `${STATUS_WARNING}15`,
                  color: issue.severity === 'error' ? STATUS_ERROR : STATUS_WARNING,
                }}
              >
                {issue.severity}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Coverage bars */}
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
            Coverage per Montage
          </div>
          {MONTAGE_COVERAGES.map((mc) => {
            const barColor = mc.coverage >= 0.8 ? STATUS_SUCCESS : mc.coverage >= 0.5 ? STATUS_WARNING : STATUS_ERROR;
            return (
              <div key={mc.montage} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-muted w-28 truncate">{mc.montage}</span>
                <div className="flex-1">
                  <NeonBar pct={mc.coverage * 100} color={barColor} height={12} glow />
                </div>
                <span className="text-xs font-mono text-text-muted w-8 text-right">{Math.round(mc.coverage * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
