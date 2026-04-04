'use client';

import { Wand2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AssetForgePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const GENERATION_QUEUE = [
  { id: 'GEN-091', prompt: 'Medieval iron sword with rune engravings', model: 'Mesh-XL', status: 'complete' as const, duration: '2m 14s', date: '2026-03-31' },
  { id: 'GEN-090', prompt: 'Stone dungeon wall tileable texture', model: 'Tex-Diffusion', status: 'complete' as const, duration: '1m 08s', date: '2026-03-31' },
  { id: 'GEN-089', prompt: 'Glowing magic orb particle sprite sheet', model: 'Tex-Diffusion', status: 'running' as const, duration: '0m 42s', date: '2026-03-31' },
  { id: 'GEN-088', prompt: 'Skeletal rig for humanoid enemy', model: 'Rig-Auto', status: 'queued' as const, duration: '—', date: '2026-03-31' },
  { id: 'GEN-087', prompt: 'Worn leather armor PBR material', model: 'Mat-PBR', status: 'failed' as const, duration: '3m 22s', date: '2026-03-30' },
] as const;

const MODEL_PROFILES = [
  { name: 'Mesh-XL', type: '3D Generation', avgTime: '2m 30s', quota: '50/day' },
  { name: 'Tex-Diffusion', type: 'Texture Gen', avgTime: '1m 15s', quota: '200/day' },
  { name: 'Rig-Auto', type: 'Auto Rigging', avgTime: '4m 00s', quota: '25/day' },
  { name: 'Mat-PBR', type: 'Material Gen', avgTime: '1m 45s', quota: '100/day' },
] as const;

function queueStatusColor(status: string): string {
  if (status === 'complete') return STATUS_SUCCESS;
  if (status === 'running') return ACCENT;
  if (status === 'failed') return STATUS_ERROR;
  return STATUS_WARNING;
}

function queueStatusIcon(status: string) {
  if (status === 'complete') return CheckCircle2;
  if (status === 'failed') return AlertTriangle;
  return Clock;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function ForgeMicro() {
  const running = GENERATION_QUEUE.filter((g) => g.status === 'running').length;
  const queued = GENERATION_QUEUE.filter((g) => g.status === 'queued').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Wand2 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{running} running · {queued} queued</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ForgeCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Generation Queue</span>
        <span className="font-mono text-text">{MODEL_PROFILES.length} models</span>
      </div>
      {GENERATION_QUEUE.slice(0, 4).map((g) => (
        <div key={g.id} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: queueStatusColor(g.status) }} />
          <span className="text-text flex-1 truncate">{g.id} · {g.model}</span>
          <span className="text-text-muted text-2xs capitalize">{g.status}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ForgeFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        AI asset generation queue with prompt-to-asset pipeline, model profiles, and generation history tracking.
      </SurfaceCard>

      {/* Generation Queue */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Wand2} label="Generation Queue" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {GENERATION_QUEUE.map((gen, i) => {
            const StatusIcon = queueStatusIcon(gen.status);
            return (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="text-xs"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-3 h-3" style={{ color: queueStatusColor(gen.status) }} />
                    <span className="font-mono text-text font-medium">{gen.id}</span>
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded capitalize"
                      style={{ backgroundColor: `${queueStatusColor(gen.status)}${OPACITY_15}`, color: queueStatusColor(gen.status) }}
                    >
                      {gen.status}
                    </span>
                  </div>
                  <span className="text-text-muted text-2xs">{gen.duration}</span>
                </div>
                <div className="text-text-muted text-2xs truncate pl-5">{gen.prompt}</div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Model Profiles */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Clock} label="Model Profiles" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {MODEL_PROFILES.map((model, i) => (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{model.name}</span>
                  <span className="text-2xs text-text-muted">{model.type}</span>
                </div>
                <div className="text-2xs text-text-muted">
                  Avg: {model.avgTime} &middot; Quota: {model.quota}
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
export function AssetForgePanel({ featureMap, defs }: AssetForgePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Asset Forge" icon={<Wand2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ForgeMicro />}
          {density === 'compact' && <ForgeCompact />}
          {density === 'full' && <ForgeFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
