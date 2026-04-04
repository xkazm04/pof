'use client';

import { useState } from 'react';
import { LayoutGrid, Check, AlertTriangle, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
  PipelineFlow,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface FeatureMatrixPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const STATUS_SUMMARY = [
  { label: 'Implemented', count: 42, color: STATUS_SUCCESS, icon: Check },
  { label: 'Partial', count: 18, color: STATUS_WARNING, icon: AlertTriangle },
  { label: 'Missing', count: 12, color: STATUS_ERROR, icon: AlertTriangle },
  { label: 'Unknown', count: 8, color: 'var(--text-muted)', icon: HelpCircle },
] as const;

const MATRIX_FEATURES = [
  'Feature scanning', 'Status tracking', 'Quality scoring',
  'Dependency resolution', 'Batch review', 'Export reports',
  'Review history', 'Trend analysis',
];

const MATRIX_PIPELINE = ['Scan', 'Classify', 'Score', 'Track', 'Report'] as const;

const totalFeatures = STATUS_SUMMARY.reduce((s, st) => s + st.count, 0);
const completionPct = Math.round((STATUS_SUMMARY[0].count / totalFeatures) * 100);

/* ── Micro density ──────────────────────────────────────────────────────── */

function MatrixMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <LayoutGrid className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{completionPct}% done</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MatrixCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {STATUS_SUMMARY.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-text-muted flex-1">{s.label}</span>
          <span className="font-mono text-text font-medium">{s.count}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {totalFeatures} total features tracked
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function MatrixFull({ featureMap, defs }: FeatureMatrixPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Feature matrix tracking {totalFeatures} features across all modules with status classification,
        quality scoring, and review history.
      </SurfaceCard>

      {/* Status breakdown */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={LayoutGrid} label="Status Breakdown" color={ACCENT} />
        <div className="grid grid-cols-2 gap-3 mt-2">
          {STATUS_SUMMARY.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs p-2 rounded-lg border border-border/30 bg-surface-deep/30"
              >
                <Icon className="w-4 h-4" style={{ color: s.color }} />
                <div>
                  <div className="font-mono font-bold text-text" style={{ color: s.color }}>{s.count}</div>
                  <div className="text-text-muted">{s.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${completionPct}%`, backgroundColor: ACCENT_EMERALD }}
            />
          </div>
          <span className="text-xs font-mono text-text">{completionPct}%</span>
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {MATRIX_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Feature Tracking Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...MATRIX_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function FeatureMatrixPanel({ featureMap, defs }: FeatureMatrixPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Feature Matrix" icon={<LayoutGrid className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MatrixMicro />}
          {density === 'compact' && <MatrixCompact />}
          {density === 'full' && <MatrixFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
