'use client';

import { Package, History, Settings, Monitor } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface BuildPipelinePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const BUILD_HISTORY = [
  { id: 'B-047', config: 'Development', platform: 'Win64', status: 'success' as const, duration: '4m 22s', size: '1.2 GB', date: '2026-03-31' },
  { id: 'B-046', config: 'Shipping', platform: 'Win64', status: 'success' as const, duration: '12m 08s', size: '890 MB', date: '2026-03-30' },
  { id: 'B-045', config: 'Development', platform: 'Linux', status: 'failed' as const, duration: '6m 44s', size: '—', date: '2026-03-30' },
  { id: 'B-044', config: 'Test', platform: 'Win64', status: 'success' as const, duration: '8m 15s', size: '1.1 GB', date: '2026-03-29' },
  { id: 'B-043', config: 'Development', platform: 'PS5', status: 'success' as const, duration: '18m 32s', size: '2.1 GB', date: '2026-03-28' },
] as const;

const COOK_SETTINGS = {
  iterativeCooking: true,
  shaderCompilation: 'Distributed' as const,
  textureCompression: 'ASTC' as const,
  pakFileAlignment: 65536,
  compressionFormat: 'Oodle' as const,
  bEncryptPak: false,
  bShareMaterialCode: true,
} as const;

const PLATFORM_PROFILES = [
  { name: 'Win64', sdk: 'MSVC 14.44', status: 'active' as const, lastBuild: 'B-047' },
  { name: 'Linux', sdk: 'clang-18', status: 'broken' as const, lastBuild: 'B-045' },
  { name: 'PS5', sdk: 'Prospero 9.0', status: 'active' as const, lastBuild: 'B-043' },
  { name: 'XSX', sdk: 'GDK 2024.06', status: 'inactive' as const, lastBuild: '—' },
] as const;

function buildStatusColor(status: string): string {
  if (status === 'success') return STATUS_SUCCESS;
  if (status === 'failed') return STATUS_ERROR;
  return STATUS_WARNING;
}

function platformStatusColor(status: string): string {
  if (status === 'active') return STATUS_SUCCESS;
  if (status === 'broken') return STATUS_ERROR;
  return 'var(--text-muted)';
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function BuildMicro() {
  const successCount = BUILD_HISTORY.filter((b) => b.status === 'success').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Package className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{successCount}/{BUILD_HISTORY.length} pass</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function BuildCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Build History</span>
        <span className="font-mono text-text">{PLATFORM_PROFILES.length} platforms</span>
      </div>
      {BUILD_HISTORY.slice(0, 4).map((b) => (
        <div key={b.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: buildStatusColor(b.status) }}
          />
          <span className="text-text flex-1 truncate">{b.id} · {b.config}</span>
          <span className="text-text-muted text-2xs">{b.platform}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function BuildFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Build pipeline dashboard: build history, cook settings, and platform profile management.
      </SurfaceCard>

      {/* Build History */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={History} label="Build History" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {BUILD_HISTORY.map((build, i) => (
            <motion.div
              key={build.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text font-medium">{build.id}</span>
                  <span
                    className="text-2xs px-1.5 py-0.5 rounded capitalize"
                    style={{ backgroundColor: `${buildStatusColor(build.status)}${OPACITY_15}`, color: buildStatusColor(build.status) }}
                  >
                    {build.status}
                  </span>
                </div>
                <span className="text-text-muted text-2xs">{build.date}</span>
              </div>
              <div className="flex gap-3 text-text-muted text-2xs">
                <span>{build.config}</span>
                <span>{build.platform}</span>
                <span>{build.duration}</span>
                <span>{build.size}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Cook Settings */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Settings} label="Cook Settings" color={ACCENT} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="text-text-muted">Iterative Cooking</span>
          <span className="font-mono" style={{ color: STATUS_SUCCESS }}>Enabled</span>
          <span className="text-text-muted">Shader Compilation</span>
          <span className="font-mono text-text">{COOK_SETTINGS.shaderCompilation}</span>
          <span className="text-text-muted">Texture Compression</span>
          <span className="font-mono text-text">{COOK_SETTINGS.textureCompression}</span>
          <span className="text-text-muted">Compression</span>
          <span className="font-mono text-text">{COOK_SETTINGS.compressionFormat}</span>
          <span className="text-text-muted">Pak Alignment</span>
          <span className="font-mono text-text">{COOK_SETTINGS.pakFileAlignment}</span>
          <span className="text-text-muted">Share Material Code</span>
          <span className="font-mono" style={{ color: STATUS_SUCCESS }}>Yes</span>
        </div>
      </SurfaceCard>

      {/* Platform Profiles */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Monitor} label="Platform Profiles" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {PLATFORM_PROFILES.map((plat, i) => (
            <motion.div
              key={plat.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{plat.name}</span>
                  <span
                    className="text-2xs px-1 py-0.5 rounded capitalize"
                    style={{ backgroundColor: `${platformStatusColor(plat.status)}${OPACITY_15}`, color: platformStatusColor(plat.status) }}
                  >
                    {plat.status}
                  </span>
                </div>
                <div className="text-2xs text-text-muted">
                  SDK: {plat.sdk} &middot; Last: {plat.lastBuild}
                </div>
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
export function BuildPipelinePanel({ featureMap, defs }: BuildPipelinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Build Pipeline" icon={<Package className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BuildMicro />}
          {density === 'compact' && <BuildCompact />}
          {density === 'full' && <BuildFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
