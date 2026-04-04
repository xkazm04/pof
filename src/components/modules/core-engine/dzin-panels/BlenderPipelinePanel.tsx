'use client';

import { Hexagon, Play, FileCode, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface BlenderPipelinePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const BLENDER_SCRIPTS = [
  { name: 'export_fbx_batch.py', type: 'Export', status: 'active' as const, lastRun: '2026-03-31', duration: '12s' },
  { name: 'auto_lod_gen.py', type: 'LOD', status: 'active' as const, lastRun: '2026-03-31', duration: '45s' },
  { name: 'nla_export.py', type: 'Animation', status: 'active' as const, lastRun: '2026-03-30', duration: '8s' },
  { name: 'material_bake.py', type: 'Material', status: 'idle' as const, lastRun: '2026-03-28', duration: '2m 10s' },
  { name: 'collision_gen.py', type: 'Physics', status: 'idle' as const, lastRun: '2026-03-27', duration: '18s' },
] as const;

const PIPELINE_STEPS = [
  { name: 'Import Source', description: 'Load .blend files from source directory' },
  { name: 'Transform', description: 'Apply scale, rotation, axis conversion' },
  { name: 'LOD Generation', description: 'Auto-generate LOD meshes via decimation' },
  { name: 'FBX Export', description: 'Export to FBX with UE5 settings' },
  { name: 'Auto Import', description: 'Hot-reload into UE5 Content Browser' },
] as const;

const CONNECTION_STATUS = {
  blenderVersion: '4.2.1',
  mcpPort: 9876,
  connected: true,
  lastSync: '2026-03-31 14:22',
} as const;

function scriptStatusColor(status: string): string {
  return status === 'active' ? STATUS_SUCCESS : STATUS_WARNING;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function BlenderMicro() {
  const active = BLENDER_SCRIPTS.filter((s) => s.status === 'active').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Hexagon className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{active}/{BLENDER_SCRIPTS.length} active</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function BlenderCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Blender Scripts</span>
        <span className="font-mono" style={{ color: STATUS_SUCCESS }}>Connected</span>
      </div>
      {BLENDER_SCRIPTS.slice(0, 4).map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: scriptStatusColor(s.status) }} />
          <span className="text-text flex-1 truncate">{s.name}</span>
          <span className="text-text-muted text-2xs">{s.type}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function BlenderFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Blender integration pipeline with MCP connection, script management, and automated export-to-UE5 workflow.
      </SurfaceCard>

      {/* Connection Status */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={RefreshCw} label="Connection Status" color={ACCENT} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="text-text-muted">Blender Version</span>
          <span className="font-mono text-text">{CONNECTION_STATUS.blenderVersion}</span>
          <span className="text-text-muted">MCP Port</span>
          <span className="font-mono text-text">{CONNECTION_STATUS.mcpPort}</span>
          <span className="text-text-muted">Status</span>
          <span className="font-mono" style={{ color: STATUS_SUCCESS }}>Connected</span>
          <span className="text-text-muted">Last Sync</span>
          <span className="font-mono text-text">{CONNECTION_STATUS.lastSync}</span>
        </div>
      </SurfaceCard>

      {/* Scripts */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FileCode} label="Pipeline Scripts" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {BLENDER_SCRIPTS.map((script, i) => (
            <motion.div
              key={script.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text font-medium">{script.name}</span>
                  <span
                    className="text-2xs px-1.5 py-0.5 rounded capitalize"
                    style={{ backgroundColor: `${scriptStatusColor(script.status)}${OPACITY_15}`, color: scriptStatusColor(script.status) }}
                  >
                    {script.status}
                  </span>
                </div>
                <span className="text-text-muted text-2xs">{script.duration}</span>
              </div>
              <div className="text-text-muted text-2xs pl-0">
                {script.type} · Last: {script.lastRun}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Pipeline Steps */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Play} label="Pipeline Flow" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {PIPELINE_STEPS.map((step, i) => (
            <motion.div
              key={step.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-start gap-2 text-xs"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-bold mt-0.5"
                style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
              >
                {i + 1}
              </span>
              <div>
                <span className="font-medium text-text">{step.name}</span>
                <div className="text-2xs text-text-muted">{step.description}</div>
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
export function BlenderPipelinePanel({ featureMap, defs }: BlenderPipelinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Blender Pipeline" icon={<Hexagon className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BlenderMicro />}
          {density === 'compact' && <BlenderCompact />}
          {density === 'full' && <BlenderFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
