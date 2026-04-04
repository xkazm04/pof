'use client';

import { Brain, TreePine, Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AISandboxPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const BT_NODES = [
  { name: 'Root Selector', type: 'composite' as const, status: 'running' as const },
  { name: 'Combat Sequence', type: 'composite' as const, status: 'success' as const },
  { name: 'FindTarget', type: 'task' as const, status: 'success' as const },
  { name: 'MoveToTarget', type: 'task' as const, status: 'running' as const },
  { name: 'ExecuteAttack', type: 'task' as const, status: 'idle' as const },
  { name: 'Patrol Sequence', type: 'composite' as const, status: 'idle' as const },
  { name: 'IsHealthLow?', type: 'decorator' as const, status: 'failure' as const },
  { name: 'Flee', type: 'task' as const, status: 'idle' as const },
] as const;

const TEST_SUITES = [
  { name: 'Aggro Acquisition', scenarios: 8, passed: 7, failed: 1, running: 0 },
  { name: 'Patrol Behavior', scenarios: 5, passed: 5, failed: 0, running: 0 },
  { name: 'Flee Threshold', scenarios: 4, passed: 2, failed: 1, running: 1 },
  { name: 'Group Tactics', scenarios: 6, passed: 3, failed: 2, running: 1 },
] as const;

function nodeStatusColor(status: string): string {
  if (status === 'success') return STATUS_SUCCESS;
  if (status === 'running') return STATUS_INFO;
  if (status === 'failure') return STATUS_ERROR;
  return 'var(--text-muted)';
}

function nodeTypeIcon(type: string) {
  if (type === 'composite') return TreePine;
  if (type === 'decorator') return Clock;
  return Play;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function SandboxMicro() {
  const total = TEST_SUITES.reduce((s, t) => s + t.scenarios, 0);
  const passed = TEST_SUITES.reduce((s, t) => s + t.passed, 0);
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Brain className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{passed}/{total} pass</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SandboxCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>AI Test Suites</span>
        <span className="font-mono text-text">{TEST_SUITES.length} suites</span>
      </div>
      {TEST_SUITES.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.failed > 0 ? STATUS_ERROR : STATUS_SUCCESS }}
          />
          <span className="text-text-muted flex-1 truncate">{s.name}</span>
          <span className="font-mono text-text">{s.passed}/{s.scenarios}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function SandboxFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        AI behavior testing sandbox with behavior tree visualization and test suite execution.
      </SurfaceCard>

      {/* BT Visualizer */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={TreePine} label="Behavior Tree" color={ACCENT} />
        <div className="space-y-1 mt-2">
          {BT_NODES.map((node, i) => {
            const Icon = nodeTypeIcon(node.type);
            const indent = node.type === 'task' ? 'ml-4' : node.type === 'decorator' ? 'ml-2' : '';
            return (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-2 text-xs ${indent}`}
              >
                <Icon className="w-3 h-3 flex-shrink-0" style={{ color: nodeStatusColor(node.status) }} />
                <span className="text-text flex-1 truncate">{node.name}</span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded capitalize"
                  style={{ backgroundColor: `${nodeStatusColor(node.status)}${OPACITY_15}`, color: nodeStatusColor(node.status) }}
                >
                  {node.status}
                </span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Test Suites */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Brain} label="Test Suites" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {TEST_SUITES.map((suite, i) => (
            <motion.div
              key={suite.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-text font-medium">{suite.name}</span>
                <span className="text-text-muted">{suite.scenarios} scenarios</span>
              </div>
              <div className="flex gap-2">
                <span className="flex items-center gap-1" style={{ color: STATUS_SUCCESS }}>
                  <CheckCircle2 className="w-3 h-3" />{suite.passed}
                </span>
                {suite.failed > 0 && (
                  <span className="flex items-center gap-1" style={{ color: STATUS_ERROR }}>
                    <XCircle className="w-3 h-3" />{suite.failed}
                  </span>
                )}
                {suite.running > 0 && (
                  <span className="flex items-center gap-1" style={{ color: STATUS_WARNING }}>
                    <Clock className="w-3 h-3" />{suite.running}
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
export function AISandboxPanel({ featureMap, defs }: AISandboxPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="AI Sandbox" icon={<Brain className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <SandboxMicro />}
          {density === 'compact' && <SandboxCompact />}
          {density === 'full' && <SandboxFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
