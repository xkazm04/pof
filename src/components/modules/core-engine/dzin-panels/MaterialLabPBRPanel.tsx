'use client';

import React from 'react';
import { Palette, Layers, Sliders } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_PINK, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface MaterialLabPBRPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const PBR_CHANNELS = [
  { name: 'Base Color', slot: 'RGB', resolution: '4K', color: ACCENT_ORANGE },
  { name: 'Normal', slot: 'RGB', resolution: '4K', color: ACCENT_VIOLET },
  { name: 'Metallic', slot: 'R', resolution: '2K', color: ACCENT_CYAN },
  { name: 'Roughness', slot: 'R', resolution: '2K', color: ACCENT_EMERALD },
  { name: 'AO', slot: 'R', resolution: '2K', color: ACCENT_PINK },
] as const;

const SHADER_MODELS = [
  { name: 'Default Lit', type: 'Standard PBR', features: 'Full PBR, subsurface, clear coat' },
  { name: 'Substrate', type: 'Unified Shading', features: 'Multi-layer slab, advanced blending' },
  { name: 'Unlit', type: 'Emissive Only', features: 'UI, hologram, skybox' },
  { name: 'Subsurface', type: 'SSS Profile', features: 'Skin, wax, foliage, translucency' },
] as const;

const MATERIAL_PARAMS = [
  { name: 'Tiling', value: '2.0 × 2.0', type: 'Vector2' },
  { name: 'Roughness Mult', value: '0.85', type: 'Scalar' },
  { name: 'Normal Intensity', value: '1.2', type: 'Scalar' },
  { name: 'Emissive Power', value: '0.0', type: 'Scalar' },
  { name: 'Detail Blend', value: '0.5', type: 'Scalar' },
  { name: 'Color Tint', value: 'Warm Stone', type: 'Color' },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function PBRMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Palette className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{PBR_CHANNELS.length} channels</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PBRCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>PBR Channels</span>
        <span className="font-mono text-text">{SHADER_MODELS.length} shaders</span>
      </div>
      {PBR_CHANNELS.map((ch) => (
        <div key={ch.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
          <span className="text-text flex-1">{ch.name}</span>
          <span className="text-text-muted font-mono">{ch.resolution}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function PBRFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        PBR material editor with texture channel management, shader model selection, and parameter tuning.
      </SurfaceCard>

      {/* PBR Channels */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Layers} label="PBR Channels" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {PBR_CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
              <span className="font-mono font-bold" style={{ color: ch.color }}>{ch.name}</span>
              <span className="text-text-muted ml-auto">{ch.slot} · {ch.resolution}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Shader Models */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Palette} label="Shader Models" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {SHADER_MODELS.map((shader, i) => (
            <motion.div
              key={shader.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{shader.name}</span>
                  <span
                    className="text-2xs px-1 py-0.5 rounded"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
                  >
                    {shader.type}
                  </span>
                </div>
                <div className="text-2xs text-text-muted">{shader.features}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Material Parameters */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Sliders} label="Material Parameters" color={ACCENT} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          {MATERIAL_PARAMS.map((param) => (
            <React.Fragment key={param.name}>
              <span className="text-text-muted">{param.name} <span className="text-2xs">({param.type})</span></span>
              <span className="font-mono text-text">{param.value}</span>
            </React.Fragment>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MaterialLabPBRPanel({ featureMap, defs }: MaterialLabPBRPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Material Lab PBR" icon={<Palette className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PBRMicro />}
          {density === 'compact' && <PBRCompact />}
          {density === 'full' && <PBRFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
