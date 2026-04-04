'use client';

import { GitBranch, Zap, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, ACCENT_VIOLET, OPACITY_15 } from '@/lib/chart-colors';

/* -- Props ----------------------------------------------------------------- */

export interface GasBlueprintPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants -------------------------------------------------------------- */

const ACCENT = MODULE_COLORS.core;

const GAS_NODES = [
  { name: 'GA_MeleeCombo', type: 'ability' as const, connections: 3, status: 'active' as const },
  { name: 'GA_DodgeRoll', type: 'ability' as const, connections: 2, status: 'active' as const },
  { name: 'GE_DamageBase', type: 'effect' as const, connections: 4, status: 'active' as const },
  { name: 'GE_BurnDoT', type: 'effect' as const, connections: 2, status: 'warning' as const },
  { name: 'Attr_Health', type: 'attribute' as const, connections: 5, status: 'active' as const },
  { name: 'Attr_Stamina', type: 'attribute' as const, connections: 3, status: 'active' as const },
  { name: 'GC_HitImpact', type: 'cue' as const, connections: 1, status: 'active' as const },
  { name: 'GC_LevelUp', type: 'cue' as const, connections: 1, status: 'idle' as const },
] as const;

const NODE_TYPE_COLORS: Record<string, string> = {
  ability: STATUS_INFO,
  effect: STATUS_WARNING,
  attribute: STATUS_SUCCESS,
  cue: ACCENT_VIOLET,
};

const SIM_STATE = {
  status: 'Ready' as const,
  lastResult: 'GA_MeleeCombo -> GE_DamageBase: 142 dmg',
  activePaths: 3,
  errors: 0,
} as const;

function nodeStatusColor(status: string): string {
  if (status === 'active') return STATUS_SUCCESS;
  if (status === 'warning') return STATUS_WARNING;
  return 'var(--text-muted)';
}

/* -- Micro density --------------------------------------------------------- */

function BlueprintMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <GitBranch className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{GAS_NODES.length} nodes</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function BlueprintCompact() {
  const typeCounts = GAS_NODES.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>GAS Nodes</span>
        <span className="font-mono text-text">{GAS_NODES.length} nodes</span>
      </div>
      {Object.entries(typeCounts).map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: NODE_TYPE_COLORS[type] || ACCENT }}
          />
          <span className="text-text-muted flex-1 truncate capitalize">{type}s</span>
          <span className="font-mono text-text">{count}</span>
        </div>
      ))}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function BlueprintFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        GAS blueprint editor with ability/effect/attribute/cue nodes, wiring graph, and simulation.
      </SurfaceCard>

      {/* Node Cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Zap} label="GAS Nodes" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {GAS_NODES.map((node, i) => {
            const typeColor = NODE_TYPE_COLORS[node.type] || ACCENT;
            return (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: nodeStatusColor(node.status) }}
                />
                <span className="text-text font-medium flex-1 truncate font-mono">{node.name}</span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded capitalize"
                  style={{ backgroundColor: `${typeColor}${OPACITY_15}`, color: typeColor }}
                >
                  {node.type}
                </span>
                <span className="text-text-muted font-mono">{node.connections} conn</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Wiring Overview */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={GitBranch} label="Wiring Graph" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {(['ability', 'effect', 'attribute', 'cue'] as const).map((type, i) => {
            const nodes = GAS_NODES.filter((n) => n.type === type);
            const totalConn = nodes.reduce((s, n) => s + n.connections, 0);
            const typeColor = NODE_TYPE_COLORS[type];
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text font-medium capitalize">{type}s</span>
                  <span className="text-text-muted font-mono">{nodes.length} nodes / {totalConn} wires</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: `${typeColor}${OPACITY_15}` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: typeColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(totalConn / 15) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Simulation Status */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Play} label="Simulation" color={ACCENT} />
        <div className="space-y-1.5 mt-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Status</span>
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`, color: STATUS_SUCCESS }}
            >
              {SIM_STATE.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Last Result</span>
            <span className="font-mono text-text truncate ml-2">{SIM_STATE.lastResult}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Active Paths</span>
            <span className="font-mono text-text">{SIM_STATE.activePaths}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Errors</span>
            <span className="font-mono text-text">{SIM_STATE.errors}</span>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GasBlueprintPanel({ featureMap, defs }: GasBlueprintPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="GAS Blueprint" icon={<GitBranch className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BlueprintMicro />}
          {density === 'compact' && <BlueprintCompact />}
          {density === 'full' && <BlueprintFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
