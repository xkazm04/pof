'use client';

import { FlaskConical, Play, CheckCircle2, XCircle, Clock, FileJson } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface TestHarnessDzinPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.setup;

const TEST_SPECS = [
  { name: 'Spawn Hero Character', actions: 4, assertions: 6, status: 'passed' as const, duration: '1.2s' },
  { name: 'Equip Weapon Flow', actions: 7, assertions: 8, status: 'passed' as const, duration: '2.4s' },
  { name: 'Damage Calculation', actions: 3, assertions: 12, status: 'failed' as const, duration: '0.8s' },
  { name: 'Loot Drop Rates', actions: 5, assertions: 10, status: 'passed' as const, duration: '3.1s' },
  { name: 'Save/Load Roundtrip', actions: 6, assertions: 4, status: 'running' as const, duration: '—' },
] as const;

const SUITE_STATS = {
  total: 24,
  passed: 19,
  failed: 3,
  running: 2,
  avgDuration: '1.8s',
} as const;

function specStatusColor(status: string): string {
  if (status === 'passed') return STATUS_SUCCESS;
  if (status === 'failed') return STATUS_ERROR;
  if (status === 'running') return STATUS_WARNING;
  return 'var(--text-muted)';
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function HarnessMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <FlaskConical className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{SUITE_STATS.passed}/{SUITE_STATS.total} pass</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function HarnessCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Test Harness</span>
        <span className="font-mono text-text">{TEST_SPECS.length} specs</span>
      </div>
      {TEST_SPECS.map((spec) => (
        <div key={spec.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: specStatusColor(spec.status) }}
          />
          <span className="text-text-muted flex-1 truncate">{spec.name}</span>
          <span className="font-mono text-2xs text-text">{spec.duration}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function HarnessFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Test spec editor and suite runner — create scenarios with spawn/assert/capture actions, track pass/fail results.
      </SurfaceCard>

      {/* Suite Summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FlaskConical} label="Suite Summary" color={ACCENT} />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {[
            { label: 'Passed', value: SUITE_STATS.passed, color: STATUS_SUCCESS },
            { label: 'Failed', value: SUITE_STATS.failed, color: STATUS_ERROR },
            { label: 'Running', value: SUITE_STATS.running, color: STATUS_WARNING },
            { label: 'Avg Time', value: SUITE_STATS.avgDuration, color: ACCENT },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-2xs text-text-muted">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Test Specs */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FileJson} label="Test Specs" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {TEST_SPECS.map((spec, i) => (
            <motion.div
              key={spec.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-text font-medium">{spec.name}</span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded capitalize"
                  style={{ backgroundColor: `${specStatusColor(spec.status)}${OPACITY_15}`, color: specStatusColor(spec.status) }}
                >
                  {spec.status}
                </span>
              </div>
              <div className="flex gap-3 text-text-muted text-2xs">
                <span className="flex items-center gap-1"><Play className="w-2.5 h-2.5" />{spec.actions} actions</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{spec.assertions} asserts</span>
                {spec.status === 'failed' && (
                  <span className="flex items-center gap-1" style={{ color: STATUS_ERROR }}>
                    <XCircle className="w-2.5 h-2.5" />2 failed
                  </span>
                )}
                {spec.status === 'running' && (
                  <span className="flex items-center gap-1" style={{ color: STATUS_WARNING }}>
                    <Clock className="w-2.5 h-2.5" />in progress
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TestHarnessDzinPanel({ featureMap, defs }: TestHarnessDzinPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Test Harness" icon={<FlaskConical className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <HarnessMicro />}
          {density === 'compact' && <HarnessCompact />}
          {density === 'full' && <HarnessFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
