'use client';

import { Zap, Shield, Crosshair } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface PhysicsSystemPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const COLLISION_PROFILES = [
  { name: 'Pawn', channel: 'ECC_Pawn', blockAll: false, responses: { WorldStatic: 'Block', Pawn: 'Overlap', Projectile: 'Block' } },
  { name: 'Projectile', channel: 'ECC_GameTraceChannel1', blockAll: false, responses: { WorldStatic: 'Block', Pawn: 'Overlap', Projectile: 'Ignore' } },
  { name: 'Trigger', channel: 'ECC_GameTraceChannel2', blockAll: false, responses: { WorldStatic: 'Ignore', Pawn: 'Overlap', Projectile: 'Ignore' } },
  { name: 'Destructible', channel: 'ECC_Destructible', blockAll: true, responses: { WorldStatic: 'Block', Pawn: 'Block', Projectile: 'Block' } },
] as const;

const PROJECTILES = [
  { name: 'Fireball', speed: 2400, gravity: 0.3, lifetime: 4.0, collisionRadius: 24 },
  { name: 'Arrow', speed: 4800, gravity: 1.0, lifetime: 3.0, collisionRadius: 8 },
  { name: 'ArcaneOrb', speed: 1200, gravity: 0, lifetime: 6.0, collisionRadius: 32 },
  { name: 'ChainLightning', speed: 8000, gravity: 0, lifetime: 0.5, collisionRadius: 16 },
] as const;

function responseColor(resp: string): string {
  if (resp === 'Block') return STATUS_ERROR;
  if (resp === 'Overlap') return STATUS_WARNING;
  return 'var(--text-muted)';
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function PhysicsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Zap className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{COLLISION_PROFILES.length} profiles</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PhysicsCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Collision Profiles</span>
        <span className="font-mono text-text">{PROJECTILES.length} projectiles</span>
      </div>
      {COLLISION_PROFILES.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <Shield className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text flex-1 truncate">{p.name}</span>
          <span className="font-mono text-text-muted text-2xs">{p.channel}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function PhysicsFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Physics collision profiles and projectile system configuration for UE5 trace channels.
      </SurfaceCard>

      {/* Collision Profiles */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Shield} label="Collision Profiles" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {COLLISION_PROFILES.map((profile, i) => (
            <motion.div
              key={profile.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-text font-medium">{profile.name}</span>
                <span className="text-text-muted font-mono text-2xs">{profile.channel}</span>
              </div>
              <div className="flex gap-2">
                {Object.entries(profile.responses).map(([ch, resp]) => (
                  <span
                    key={ch}
                    className="px-1.5 py-0.5 rounded text-2xs"
                    style={{ backgroundColor: `${responseColor(resp)}${OPACITY_15}`, color: responseColor(resp) }}
                  >
                    {ch}: {resp}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Projectile System */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Crosshair} label="Projectile Config" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {PROJECTILES.map((proj, i) => (
            <motion.div
              key={proj.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="text-xs font-medium text-text mb-1">{proj.name}</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-2xs text-text-muted">
                  <span>Speed</span><span className="font-mono text-text">{proj.speed}</span>
                  <span>Gravity</span><span className="font-mono text-text">{proj.gravity}</span>
                  <span>Lifetime</span><span className="font-mono text-text">{proj.lifetime}s</span>
                  <span>Radius</span><span className="font-mono text-text">{proj.collisionRadius}cm</span>
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
export function PhysicsSystemPanel({ featureMap, defs }: PhysicsSystemPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Physics System" icon={<Zap className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PhysicsMicro />}
          {density === 'compact' && <PhysicsCompact />}
          {density === 'full' && <PhysicsFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
