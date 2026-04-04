'use client';

import { ScanSearch, AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel, PipelineFlow } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalDeepScanPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const PASS_RESULTS = [
  { pass: 'Structure', score: 82, findings: 3, severity: 'info' as const },
  { pass: 'Quality', score: 68, findings: 7, severity: 'warning' as const },
  { pass: 'Performance', score: 74, findings: 5, severity: 'warning' as const },
] as const;

const RECENT_FINDINGS = [
  { severity: 'critical' as const, module: 'arpg-world', msg: 'Missing UObject lifecycle guard in zone streaming' },
  { severity: 'warning' as const, module: 'arpg-loot', msg: 'Unoptimized TArray iteration in drop table resolution' },
  { severity: 'warning' as const, module: 'arpg-combat', msg: 'GAS attribute set missing replication callback' },
  { severity: 'info' as const, module: 'arpg-character', msg: 'Consider using FGameplayTag instead of FName' },
] as const;

const SCAN_PIPELINE = ['Collect', 'Pass 1: Structure', 'Pass 2: Quality', 'Pass 3: Perf', 'Report'] as const;

const SEVERITY_COLORS = { critical: STATUS_ERROR, warning: STATUS_WARNING, info: STATUS_SUCCESS } as const;
const SEVERITY_ICONS = { critical: AlertOctagon, warning: AlertTriangle, info: CheckCircle2 } as const;

const avgScore = Math.round(PASS_RESULTS.reduce((s, p) => s + p.score, 0) / PASS_RESULTS.length);

/* ── Micro density ──────────────────────────────────────────────────────── */

function DeepScanMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <ScanSearch className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{avgScore}%</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function DeepScanCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {PASS_RESULTS.map((p) => (
        <div key={p.pass} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.score >= 80 ? STATUS_SUCCESS : p.score >= 60 ? STATUS_WARNING : STATUS_ERROR }}
          />
          <span className="text-text-muted flex-1">{p.pass}</span>
          <span className="font-mono text-text font-medium">{p.score}%</span>
          <span className="font-mono text-text-muted">{p.findings}f</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function DeepScanFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Deep 3-pass evaluation results: structure analysis, code quality scoring, and
        performance profiling findings across all ARPG modules.
      </SurfaceCard>

      {/* Pass scores */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={ScanSearch} label="3-Pass Results" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {PASS_RESULTS.map((p, i) => {
            const color = p.score >= 80 ? STATUS_SUCCESS : p.score >= 60 ? STATUS_WARNING : STATUS_ERROR;
            return (
              <motion.div
                key={p.pass}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-text font-medium w-20">{p.pass}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }} animate={{ width: `${p.score}%` }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  />
                </div>
                <span className="font-mono font-bold text-text w-10 text-right">{p.score}%</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Recent findings */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={AlertTriangle} label="Recent Findings" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {RECENT_FINDINGS.map((f, i) => {
            const Icon = SEVERITY_ICONS[f.severity];
            const color = SEVERITY_COLORS[f.severity];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-lg border px-3 py-2"
                style={{ backgroundColor: color + OPACITY_8, borderColor: color + OPACITY_20 }}
              >
                <div className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                  <div>
                    <span className="text-xs font-mono text-text-muted">{f.module}</span>
                    <div className="text-xs text-text">{f.msg}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Scan Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...SCAN_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalDeepScanPanel({ featureMap, defs }: EvalDeepScanPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Deep Scan" icon={<ScanSearch className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <DeepScanMicro />}
          {density === 'compact' && <DeepScanCompact />}
          {density === 'full' && <DeepScanFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
