'use client';

import { Wifi, ArrowUpDown, Users, Radio } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface MultiplayerSystemPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const REPLICATED_PROPS = [
  { actor: 'ARPGCharacter', prop: 'Health', reliable: true, condition: 'COND_OwnerOnly', bandwidth: 'Low' },
  { actor: 'ARPGCharacter', prop: 'MovementState', reliable: false, condition: 'COND_SkipOwner', bandwidth: 'High' },
  { actor: 'AProjectile', prop: 'Velocity', reliable: false, condition: 'COND_None', bandwidth: 'High' },
  { actor: 'AInventoryComponent', prop: 'SlotArray', reliable: true, condition: 'COND_OwnerOnly', bandwidth: 'Medium' },
  { actor: 'AAbilitySystem', prop: 'ActiveTags', reliable: true, condition: 'COND_None', bandwidth: 'Medium' },
] as const;

const RPCS = [
  { name: 'ServerActivateAbility', type: 'Server' as const, reliable: true, callsPerSec: 12 },
  { name: 'ClientApplyDamage', type: 'Client' as const, reliable: true, callsPerSec: 8 },
  { name: 'MulticastVFX', type: 'Multicast' as const, reliable: false, callsPerSec: 24 },
  { name: 'ServerMoveInput', type: 'Server' as const, reliable: false, callsPerSec: 60 },
  { name: 'ClientSyncInventory', type: 'Client' as const, reliable: true, callsPerSec: 2 },
] as const;

function rpcTypeColor(type: string): string {
  if (type === 'Server') return STATUS_INFO;
  if (type === 'Client') return STATUS_SUCCESS;
  return STATUS_WARNING;
}

function bandwidthColor(bw: string): string {
  if (bw === 'Low') return STATUS_SUCCESS;
  if (bw === 'Medium') return STATUS_WARNING;
  return STATUS_ERROR;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function MultiplayerMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Wifi className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{RPCS.length} RPCs</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MultiplayerCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Replication</span>
        <span className="font-mono text-text">{REPLICATED_PROPS.length} props</span>
      </div>
      {RPCS.slice(0, 4).map((rpc) => (
        <div key={rpc.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: rpcTypeColor(rpc.type) }}
          />
          <span className="text-text-muted flex-1 truncate">{rpc.name}</span>
          <span
            className="text-2xs px-1 py-0.5 rounded capitalize"
            style={{ backgroundColor: `${rpcTypeColor(rpc.type)}${OPACITY_15}`, color: rpcTypeColor(rpc.type) }}
          >
            {rpc.type}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function MultiplayerFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        UE5 replication dashboard: replicated properties, RPC calls, bandwidth monitoring, and net relevancy.
      </SurfaceCard>

      {/* Replicated Properties */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={ArrowUpDown} label="Replicated Properties" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {REPLICATED_PROPS.map((prop, i) => (
            <motion.div
              key={`${prop.actor}-${prop.prop}`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <Radio className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
              <span className="text-text font-medium truncate">{prop.actor}::{prop.prop}</span>
              <span className="ml-auto flex gap-1.5">
                {prop.reliable && (
                  <span className="text-2xs px-1 py-0.5 rounded" style={{ backgroundColor: `${STATUS_INFO}${OPACITY_15}`, color: STATUS_INFO }}>
                    Reliable
                  </span>
                )}
                <span
                  className="text-2xs px-1 py-0.5 rounded"
                  style={{ backgroundColor: `${bandwidthColor(prop.bandwidth)}${OPACITY_15}`, color: bandwidthColor(prop.bandwidth) }}
                >
                  {prop.bandwidth}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* RPC Dashboard */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Users} label="RPC Dashboard" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {RPCS.map((rpc, i) => (
            <motion.div
              key={rpc.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-text font-medium">{rpc.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${rpcTypeColor(rpc.type)}${OPACITY_15}`, color: rpcTypeColor(rpc.type) }}
                  >
                    {rpc.type}
                  </span>
                  <span className="text-text-muted font-mono">{rpc.callsPerSec}/s</span>
                </div>
              </div>
              {/* Bandwidth bar */}
              <div className="mt-1 h-1 rounded-full bg-surface-deep overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: rpcTypeColor(rpc.type) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((rpc.callsPerSec / 60) * 100, 100)}%` }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.4 }}
                />
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
export function MultiplayerSystemPanel({ featureMap, defs }: MultiplayerSystemPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Multiplayer System" icon={<Wifi className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MultiplayerMicro />}
          {density === 'compact' && <MultiplayerCompact />}
          {density === 'full' && <MultiplayerFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
