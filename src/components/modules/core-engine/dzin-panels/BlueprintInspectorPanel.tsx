'use client';

import { FileCode, Box, GitBranch, Variable, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, OPACITY_15, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface BlueprintInspectorPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.setup;

const BLUEPRINTS = [
  { name: 'BP_HeroCharacter', parent: 'APoFCharacterBase', components: 5, variables: 12, events: 3 },
  { name: 'BP_EnemyBase', parent: 'APoFEnemyCharacter', components: 3, variables: 8, events: 2 },
  { name: 'BP_LootPickup', parent: 'APoFPickupActor', components: 2, variables: 4, events: 1 },
  { name: 'BP_GameMode', parent: 'APoFGameModeBase', components: 0, variables: 6, events: 4 },
] as const;

const ASSET_TREE = [
  { path: '/Game/Blueprints/Characters/', count: 8, size: '24 MB' },
  { path: '/Game/Blueprints/Items/', count: 14, size: '6 MB' },
  { path: '/Game/Blueprints/UI/', count: 11, size: '3 MB' },
  { path: '/Game/Blueprints/GameModes/', count: 3, size: '1 MB' },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function InspectorMicro() {
  const total = BLUEPRINTS.length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <FileCode className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{total} BPs</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function InspectorCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Blueprints</span>
        <span className="font-mono text-text">{BLUEPRINTS.length} parsed</span>
      </div>
      {BLUEPRINTS.map((bp) => (
        <div key={bp.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_SUCCESS }}
          />
          <span className="text-text-muted flex-1 truncate">{bp.name}</span>
          <span className="font-mono text-2xs text-text">{bp.components}C {bp.variables}V</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function InspectorFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Blueprint parsing and asset inspection — view inheritance, components, variables, and event graph entry points.
      </SurfaceCard>

      {/* Blueprint Cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={GitBranch} label="Parsed Blueprints" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {BLUEPRINTS.map((bp, i) => (
            <motion.div
              key={bp.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="text-xs font-medium text-text mb-1 truncate">{bp.name}</div>
                <div className="text-2xs text-text-muted mb-1.5">extends {bp.parent}</div>
                <div className="flex gap-2 text-2xs">
                  <span className="flex items-center gap-1" style={{ color: ACCENT_EMERALD }}>
                    <Box className="w-2.5 h-2.5" />{bp.components}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: ACCENT_CYAN }}>
                    <Variable className="w-2.5 h-2.5" />{bp.variables}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: ACCENT_VIOLET }}>
                    <Zap className="w-2.5 h-2.5" />{bp.events}
                  </span>
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Asset Tree */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FileCode} label="Asset Tree" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {ASSET_TREE.map((folder, i) => (
            <motion.div
              key={folder.path}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-text-muted flex-1 truncate font-mono text-2xs">{folder.path}</span>
              <span className="text-text font-mono text-2xs">{folder.count} files</span>
              <span
                className="text-2xs px-1 py-0.5 rounded"
                style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
              >
                {folder.size}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BlueprintInspectorPanel({ featureMap, defs }: BlueprintInspectorPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Blueprint Inspector" icon={<FileCode className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <InspectorMicro />}
          {density === 'compact' && <InspectorCompact />}
          {density === 'full' && <InspectorFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
