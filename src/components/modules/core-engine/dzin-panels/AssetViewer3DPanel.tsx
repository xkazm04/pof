'use client';

import { Box, RotateCcw, Eye, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AssetViewer3DPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const VIEWPORT_MODES = [
  { name: 'Lit', description: 'Full PBR lighting with shadows', color: ACCENT_ORANGE },
  { name: 'Unlit', description: 'Base color only, no lighting', color: ACCENT_CYAN },
  { name: 'Wireframe', description: 'Triangle mesh wireframe overlay', color: ACCENT_EMERALD },
  { name: 'Normals', description: 'Normal map direction visualization', color: ACCENT_VIOLET },
] as const;

const SCENE_OBJECTS = [
  { name: 'SK_Hero_Base', type: 'SkeletalMesh', tris: '24,531', lods: 4, visible: true },
  { name: 'SM_Sword_01', type: 'StaticMesh', tris: '3,218', lods: 3, visible: true },
  { name: 'SM_Shield_Round', type: 'StaticMesh', tris: '1,842', lods: 2, visible: true },
  { name: 'SM_Ground_Plane', type: 'StaticMesh', tris: '2', lods: 1, visible: true },
  { name: 'BP_DirectionalLight', type: 'Light', tris: '—', lods: 0, visible: true },
] as const;

const CAMERA_PRESETS = ['Front', 'Back', 'Left', 'Right', 'Top', 'Perspective'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function ViewerMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Box className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{SCENE_OBJECTS.length} objects</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ViewerCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Scene Objects</span>
        <span className="font-mono text-text">{VIEWPORT_MODES.length} modes</span>
      </div>
      {SCENE_OBJECTS.slice(0, 4).map((obj) => (
        <div key={obj.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT }} />
          <span className="text-text flex-1 truncate">{obj.name}</span>
          <span className="text-text-muted text-2xs">{obj.tris} tris</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ViewerFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        3D scene viewer with viewport modes, camera presets, scene hierarchy, and mesh statistics.
      </SurfaceCard>

      {/* Viewport Modes */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Eye} label="Viewport Modes" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {VIEWPORT_MODES.map((mode, i) => (
            <motion.div
              key={mode.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <span className="text-xs font-mono font-bold" style={{ color: mode.color }}>{mode.name}</span>
                <div className="text-2xs text-text-muted mt-0.5">{mode.description}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Scene Hierarchy */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Box} label="Scene Hierarchy" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SCENE_OBJECTS.map((obj, i) => (
            <motion.div
              key={obj.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-text font-medium">{obj.name}</span>
                <span className="text-2xs text-text-muted">{obj.type}</span>
              </div>
              <div className="flex gap-3 text-text-muted text-2xs">
                <span>{obj.tris} tris</span>
                {obj.lods > 0 && <span>{obj.lods} LODs</span>}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Camera Presets */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={RotateCcw} label="Camera Presets" color={ACCENT} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CAMERA_PRESETS.map((preset) => (
            <span
              key={preset}
              className="text-2xs px-2 py-0.5 rounded-full border border-border/40 text-text-muted"
            >
              {preset}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
          <span className="text-text-muted">FOV</span>
          <span className="font-mono text-text">90°</span>
          <span className="text-text-muted">Near Clip</span>
          <span className="font-mono text-text">10.0</span>
          <span className="text-text-muted">Far Clip</span>
          <span className="font-mono text-text">100,000</span>
        </div>
      </SurfaceCard>

      {/* Lighting */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Sun} label="Lighting" color={ACCENT} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="text-text-muted">Directional Light</span>
          <span className="font-mono text-text">5,500K · 10 lux</span>
          <span className="text-text-muted">Sky Light</span>
          <span className="font-mono text-text">HDRI Cubemap</span>
          <span className="text-text-muted">Environment</span>
          <span className="font-mono text-text">Gradient Sky</span>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AssetViewer3DPanel({ featureMap, defs }: AssetViewer3DPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="3D Viewer" icon={<Box className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ViewerMicro />}
          {density === 'compact' && <ViewerCompact />}
          {density === 'full' && <ViewerFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
