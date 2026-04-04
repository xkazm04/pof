'use client';

import { Clapperboard, TreePine, Download, Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SceneComposerPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const SCENE_TREE = [
  { name: 'World', depth: 0, type: 'Root', children: 4 },
  { name: 'Characters', depth: 1, type: 'Folder', children: 3 },
  { name: 'Environment', depth: 1, type: 'Folder', children: 8 },
  { name: 'Lighting', depth: 1, type: 'Folder', children: 2 },
  { name: 'PostProcess', depth: 1, type: 'Folder', children: 1 },
] as const;

const EXPORT_FORMATS = [
  { name: 'FBX', ext: '.fbx', description: 'Universal 3D interchange', color: ACCENT_ORANGE },
  { name: 'glTF', ext: '.gltf/.glb', description: 'Web-ready PBR format', color: ACCENT_CYAN },
  { name: 'USD', ext: '.usd/.usda', description: 'Universal Scene Description', color: ACCENT_VIOLET },
  { name: 'OBJ', ext: '.obj', description: 'Simple geometry export', color: ACCENT_EMERALD },
] as const;

const COMPOSITION_LAYERS = [
  { name: 'Base Geometry', order: 0, visible: true, locked: false },
  { name: 'Vegetation', order: 1, visible: true, locked: false },
  { name: 'Props & Dressing', order: 2, visible: true, locked: false },
  { name: 'Lighting Rigs', order: 3, visible: true, locked: true },
  { name: 'VFX Volumes', order: 4, visible: false, locked: false },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function ComposerMicro() {
  const total = SCENE_TREE.reduce((s, n) => s + n.children, 0);
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Clapperboard className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{total} nodes</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ComposerCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Scene Tree</span>
        <span className="font-mono text-text">{EXPORT_FORMATS.length} formats</span>
      </div>
      {SCENE_TREE.map((node) => (
        <div key={node.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT }} />
          <span className="text-text flex-1" style={{ paddingLeft: node.depth * 8 }}>{node.name}</span>
          <span className="text-text-muted text-2xs">{node.children}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ComposerFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Scene composer with hierarchical scene tree, composition layers, and multi-format export configuration.
      </SurfaceCard>

      {/* Scene Tree */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={TreePine} label="Scene Tree" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {SCENE_TREE.map((node, i) => (
            <motion.div
              key={node.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between text-xs"
              style={{ paddingLeft: node.depth * 16 }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xs" style={{ color: ACCENT }}>{node.depth === 0 ? '◆' : '├─'}</span>
                <span className="font-mono text-text font-medium">{node.name}</span>
                <span className="text-2xs text-text-muted">{node.type}</span>
              </div>
              <span className="text-text-muted text-2xs">{node.children} children</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Composition Layers */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Layers} label="Composition Layers" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {COMPOSITION_LAYERS.map((layer, i) => (
            <motion.div
              key={layer.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-center font-mono text-2xs text-text-muted">{layer.order}</span>
                <span className={`text-text ${!layer.visible ? 'opacity-40' : ''}`}>{layer.name}</span>
              </div>
              <div className="flex gap-2 text-2xs text-text-muted">
                <span>{layer.visible ? '👁' : '—'}</span>
                <span>{layer.locked ? '🔒' : '🔓'}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Export Formats */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Download} label="Export Formats" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {EXPORT_FORMATS.map((fmt, i) => (
            <motion.div
              key={fmt.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{fmt.name}</span>
                  <span
                    className="text-2xs px-1 py-0.5 rounded font-mono"
                    style={{ backgroundColor: `${fmt.color}${OPACITY_15}`, color: fmt.color }}
                  >
                    {fmt.ext}
                  </span>
                </div>
                <div className="text-2xs text-text-muted">{fmt.description}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SceneComposerPanel({ featureMap, defs }: SceneComposerPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Scene Composer" icon={<Clapperboard className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ComposerMicro />}
          {density === 'compact' && <ComposerCompact />}
          {density === 'full' && <ComposerFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
