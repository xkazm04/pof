'use client';

import { useMemo, useState, useCallback } from 'react';
import { Skull, Crosshair, Shield, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner } from './_shared';

const ACCENT = MODULE_COLORS.core;

/* ── Archetype definitions ─────────────────────────────────────────────── */

interface ArchetypeConfig {
  id: string;
  label: string;
  icon: typeof Skull;
  color: string;
  stats: { label: string; value: number }[];
  abilities: string[];
  btSummary: Record<string, string>;
  featureName: string;
}

const ARCHETYPES: ArchetypeConfig[] = [
  {
    id: 'grunt',
    label: 'Melee Grunt',
    icon: Skull,
    color: '#ef4444', // Red
    stats: [
      { label: 'HP', value: 80 },
      { label: 'Damage', value: 65 },
      { label: 'Speed', value: 70 },
      { label: 'Range', value: 20 },
    ],
    abilities: ['Slash Attack', 'Shield Bash', 'Charge'],
    btSummary: {
      Idle: 'Stand and look around',
      Patrol: 'Walk waypoint path',
      Chase: 'Sprint to player',
      Attack: 'Melee combo swing',
    },
    featureName: 'Enemy archetypes',
  },
  {
    id: 'caster',
    label: 'Ranged Caster',
    icon: Crosshair,
    color: '#a855f7', // Purple
    stats: [
      { label: 'HP', value: 45 },
      { label: 'Damage', value: 90 },
      { label: 'Speed', value: 40 },
      { label: 'Range', value: 95 },
    ],
    abilities: ['Fireball', 'Frost Nova', 'Teleport'],
    btSummary: {
      Idle: 'Scan for threats',
      Patrol: 'Float between positions',
      Chase: 'Maintain safe distance',
      Attack: 'Cast ranged projectile',
    },
    featureName: 'Enemy archetypes',
  },
  {
    id: 'brute',
    label: 'Brute',
    icon: Shield,
    color: '#f59e0b', // Amber
    stats: [
      { label: 'HP', value: 100 },
      { label: 'Damage', value: 85 },
      { label: 'Speed', value: 30 },
      { label: 'Range', value: 35 },
    ],
    abilities: ['Heavy Slam', 'Stomp AoE', 'Taunt'],
    btSummary: {
      Idle: 'Guard assigned area',
      Patrol: 'Slow stomp circuit',
      Chase: 'Charge with knockback',
      Attack: 'Ground slam AoE',
    },
    featureName: 'Enemy archetypes',
  },
];

/* ── AI pipeline nodes ─────────────────────────────────────────────────── */

const AI_PIPELINE = [
  { label: 'AIController', featureName: 'AARPGAIController' },
  { label: 'Perception', featureName: 'AI Perception' },
  { label: 'Behavior Tree', featureName: 'Behavior Tree' },
  { label: 'EQS', featureName: 'EQS queries' },
  { label: 'Actions', featureName: 'Enemy Gameplay Abilities' },
];

/* ── Component ─────────────────────────────────────────────────────────── */

interface EnemyBestiaryProps {
  moduleId: SubModuleId;
}

export function EnemyBestiary({ moduleId }: EnemyBestiaryProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const toggleArchetype = useCallback((id: string) => {
    setExpandedArchetype((prev) => (prev === id ? null : id));
  }, []);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <TabHeader icon={Skull} title="Enemy Bestiary" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* Archetype cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {ARCHETYPES.map((archetype, i) => (
          <motion.div key={archetype.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <ArchetypeCard
              archetype={archetype}
              featureMap={featureMap}
              expanded={expandedArchetype === archetype.id}
              onToggle={toggleArchetype}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Infrastructure pipeline */}
        <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
          <SectionLabel icon={Zap} label="AI Infrastructure Pipeline" />
          <div className="mt-4 relative z-10">
            <PipelineFlow
              steps={AI_PIPELINE.map(n => ({ label: n.label, status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus }))}
              accent={MODULE_COLORS.core}
              showStatus
            />
          </div>
        </SurfaceCard>

        {/* Spawn config collapsible */}
        <SurfaceCard level={2} className="p-0 overflow-hidden relative group border-border/60 hover:border-text-muted/40 transition-colors h-fit">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
          <button
            onClick={() => setSpawnOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left relative z-10 focus:outline-none"
          >
            <motion.div animate={{ rotate: spawnOpen ? 90 : 0 }}>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
            </motion.div>
            <span className="text-sm font-bold text-text">Wave Spawner Configurator</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ml-auto border shadow-sm"
              style={{
                backgroundColor: STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].bg,
                color: STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].dot,
                borderColor: `${STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].dot}40`
              }}>
              {STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].label}
            </span>
          </button>
          <AnimatePresence>
            {spawnOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden relative z-10"
              >
                <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3 bg-surface/30">
                  <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface-deep p-3 rounded-lg border border-border/40">
                    Wave-based spawner drives enemy density. Each wave config specifies archetype pool, count range, spawn radius, and inter-spawn delay.
                  </p>
                  <div className="flex gap-3 mt-1">
                    {[{ label: 'Wave Inter', value: '60s' }, { label: 'Max Active', value: '12' }, { label: 'Spawn Radius', value: '800cm' }].map((item) => (
                      <div key={item.label} className="flex-1 flex flex-col items-center py-2 px-3 rounded-xl text-center border shadow-sm"
                        style={{ backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}30` }}>
                        <span className="text-sm font-mono font-bold text-text">{item.value}</span>
                        <span className="text-[10px] uppercase font-bold text-text-muted mt-1 tracking-wider">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ── Archetype card ── Trading Card Aesthetic ──────────────────────────── */

function ArchetypeCard({
  archetype,
  featureMap,
  expanded,
  onToggle,
}: {
  archetype: ArchetypeConfig;
  featureMap: Map<string, FeatureRow>;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const ArchIcon = archetype.icon;
  const row = featureMap.get(archetype.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ y: expanded ? 0 : -5, scale: expanded ? 1 : 1.02 }}
      className="h-full relative group"
      style={{ perspective: 1000 }}
    >
      <SurfaceCard
        level={3}
        className="overflow-hidden h-full flex flex-col relative transition-all duration-300 shadow-xl border-2"
        style={{
          borderColor: expanded ? `${archetype.color}80` : `${archetype.color}40`,
          boxShadow: expanded ? `0 0 30px -5px ${archetype.color}60, inset 0 0 30px -10px ${archetype.color}30` : `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${archetype.color}30`,
        }}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: `${archetype.color}15`, opacity: expanded ? 1 : 0.5 }} />

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{ backgroundImage: `radial-gradient(circle at center, ${archetype.color}20 1px, transparent 1px)`, backgroundSize: '12px 12px' }} />

        <button
          onClick={() => onToggle(archetype.id)}
          className="w-full text-left p-4 hover:bg-surface-hover/20 transition-colors relative z-10 focus:outline-none flex-1 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-inner overflow-hidden relative"
                style={{ backgroundColor: `${archetype.color}20`, borderColor: `${archetype.color}40` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,255,255,0.2)] to-transparent pointer-events-none" />
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                  <ArchIcon className="w-5 h-5" style={{ color: archetype.color, filter: `drop-shadow(0 0 4px ${archetype.color}80)` }} />
                </motion.div>
              </div>
              <div>
                <div className="text-sm font-bold text-text mb-0.5 tracking-wide leading-tight">{archetype.label}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-80" style={{ color: archetype.color }}>Class // {archetype.id}</div>
              </div>
            </div>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="p-1 rounded-md bg-surface/50 border border-border/50 shadow-sm">
              <ChevronDown className="w-4 h-4 text-text-muted" />
            </motion.div>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4 opacity-50" />

          {/* Stat bars */}
          <div className="space-y-2 mt-auto">
            {archetype.stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-14 flex-shrink-0 text-right">{stat.label}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden shadow-inner border border-border/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full shadow-[0_0_8px_currentColor] relative overflow-hidden"
                    style={{ backgroundColor: archetype.color, color: archetype.color }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.3)] to-transparent" />
                  </motion.div>
                </div>
                <span className="text-xs font-mono font-bold text-text w-8 text-right bg-surface/50 px-1.5 py-0.5 rounded border border-border/40 shadow-sm">{stat.value}</span>
              </div>
            ))}
          </div>
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="relative z-10"
            >
              <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)] pt-3 bg-surface/30 space-y-4 backdrop-blur-sm">
                {/* Abilities */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Signature Abilities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {archetype.abilities.map((ab) => (
                      <span
                        key={ab}
                        className="text-[10px] font-bold px-2 py-1 rounded-md border shadow-sm cursor-default bg-surface text-text"
                        style={{ borderColor: `${archetype.color}40`, boxShadow: `inset 0 0 10px ${archetype.color}10` }}
                      >
                        {ab}
                      </span>
                    ))}
                  </div>
                </div>

                {/* BT States */}
                <div className="bg-surface-deep p-3 rounded-xl border" style={{ borderColor: `${archetype.color}30` }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Behavior Tree Matrix</div>
                  <div className="space-y-1.5">
                    {Object.entries(archetype.btSummary).map(([state, desc]) => (
                      <div key={state} className="flex items-center gap-3 text-xs">
                        <span
                          className="font-mono font-bold flex-shrink-0 w-16 text-right"
                          style={{ color: archetype.color }}
                        >
                          {state}
                        </span>
                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${archetype.color}50` }} />
                        <span className="text-text-muted truncate font-medium" title={desc}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Footer */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Dev Status</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded uppercase font-bold border shadow-sm flex items-center gap-1.5 bg-surface"
                    style={{ color: sc.dot, borderColor: `${sc.dot}40` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                    {sc.label}
                  </span>
                </div>
                {row?.nextSteps && (
                  <p className="text-xs p-2 bg-surface border-l-2 rounded font-medium shadow-inner" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}10` }}>Next: {row.nextSteps}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>
    </motion.div>
  );
}
