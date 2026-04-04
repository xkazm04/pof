'use client';

import { Radio, Plug, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface UE5RemotePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.setup;

const ENDPOINTS = [
  { name: 'Remote Control API', host: 'localhost:30010', status: 'connected' as const, latency: '2ms' },
  { name: 'Live Coding Server', host: 'localhost:1111', status: 'connected' as const, latency: '5ms' },
  { name: 'PoF Bridge', host: 'localhost:8899', status: 'connected' as const, latency: '1ms' },
  { name: 'Pixel Streaming', host: 'localhost:8888', status: 'disconnected' as const, latency: '—' },
] as const;

const LIVE_CODING_LOG = [
  { time: '14:32:01', message: 'Patch applied: APoFCharacter.cpp (2 functions)', status: 'ok' as const },
  { time: '14:31:45', message: 'Compiling 3 modified files...', status: 'ok' as const },
  { time: '14:30:22', message: 'Hot-reload triggered by file watch', status: 'ok' as const },
  { time: '14:28:10', message: 'Failed to patch: linker symbol mismatch', status: 'error' as const },
  { time: '14:27:55', message: 'Compiling 1 modified file...', status: 'ok' as const },
] as const;

function connectionColor(status: string): string {
  if (status === 'connected') return STATUS_SUCCESS;
  if (status === 'disconnected') return STATUS_ERROR;
  return STATUS_WARNING;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function RemoteMicro() {
  const connected = ENDPOINTS.filter((e) => e.status === 'connected').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Radio className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{connected}/{ENDPOINTS.length} up</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function RemoteCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>UE5 Remote</span>
        <span className="font-mono text-text">{ENDPOINTS.filter((e) => e.status === 'connected').length} connected</span>
      </div>
      {ENDPOINTS.map((ep) => (
        <div key={ep.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: connectionColor(ep.status) }}
          />
          <span className="text-text-muted flex-1 truncate">{ep.name}</span>
          <span className="font-mono text-2xs text-text">{ep.latency}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function RemoteFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        UE5 remote controller — endpoint health, live coding patches, and connection diagnostics.
      </SurfaceCard>

      {/* Endpoints */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Plug} label="Endpoints" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {ENDPOINTS.map((ep, i) => (
            <motion.div
              key={ep.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-text">{ep.name}</span>
                  <span
                    className="text-2xs px-1 py-0.5 rounded capitalize"
                    style={{ backgroundColor: `${connectionColor(ep.status)}${OPACITY_15}`, color: connectionColor(ep.status) }}
                  >
                    {ep.status}
                  </span>
                </div>
                <div className="text-2xs text-text-muted">{ep.host} · {ep.latency}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Live Coding Log */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={RotateCcw} label="Live Coding Log" color={ACCENT} />
        <div className="space-y-1 mt-2">
          {LIVE_CODING_LOG.map((entry, i) => (
            <motion.div
              key={`${entry.time}-${i}`}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-start gap-2 text-xs"
            >
              <span className="font-mono text-text-muted text-2xs flex-shrink-0 mt-0.5">{entry.time}</span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: entry.status === 'ok' ? STATUS_SUCCESS : STATUS_ERROR }}
              />
              <span className="text-text-muted flex-1">{entry.message}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function UE5RemotePanel({ featureMap, defs }: UE5RemotePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="UE5 Remote" icon={<Radio className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <RemoteMicro />}
          {density === 'compact' && <RemoteCompact />}
          {density === 'full' && <RemoteFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
