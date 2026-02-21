'use client';

import { useMemo, useState, useCallback } from 'react';
import { Activity, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_VIOLET, ACCENT_CYAN,
  OPACITY_8, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

const ACCENT = ACCENT_VIOLET;

/* ── State machine nodes ───────────────────────────────────────────────────── */

interface StateNode {
  name: string;
  featureName: string;
  ref: string;
  transitions: { to: string; label: string }[];
}

const STATE_NODES: StateNode[] = [
  {
    name: 'Locomotion',
    featureName: 'Locomotion Blend Space',
    ref: 'BS_Locomotion1D',
    transitions: [
      { to: 'Attacking', label: 'Input.Attack' },
      { to: 'Dodging', label: 'Input.Dodge' },
    ],
  },
  {
    name: 'Attacking',
    featureName: 'Attack montages',
    ref: 'AM_Melee_Combo',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
      { to: 'HitReact', label: 'State.Hit' },
    ],
  },
  {
    name: 'Dodging',
    featureName: 'Root motion toggle',
    ref: 'AM_Dodge',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
    ],
  },
  {
    name: 'HitReact',
    featureName: 'Animation state machine',
    ref: 'AM_HitReact',
    transitions: [
      { to: 'Locomotion', label: 'Recover' },
      { to: 'Death', label: 'HP <= 0' },
    ],
  },
  {
    name: 'Death',
    featureName: 'Animation state machine',
    ref: 'AM_Death',
    transitions: [],
  },
];

/* ── Montage notify windows ────────────────────────────────────────────────── */

interface NotifyWindow {
  name: string;
  color: string;
  start: number;
  width: number;
}

interface ComboSection {
  label: string;
  duration: string;
  windows: NotifyWindow[];
}

const COMBO_SECTIONS: ComboSection[] = [
  {
    label: 'Montage 1',
    duration: '0.45s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.55, width: 0.3 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.2, width: 0.25 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.2, width: 0.15 },
    ],
  },
  {
    label: 'Montage 2',
    duration: '0.50s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.5, width: 0.35 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.18, width: 0.28 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.18, width: 0.15 },
    ],
  },
  {
    label: 'Montage 3',
    duration: '0.60s',
    windows: [
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.15, width: 0.35 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.15, width: 0.2 },
    ],
  },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

const ASSET_FEATURES = [
  'UARPGAnimInstance',
  'Locomotion Blend Space',
  'Attack montages',
  'Anim Notify classes',
  'Motion Warping',
  'Mixamo import & retarget pipeline',
  'Asset automation commandlet',
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface AnimationStateGraphProps {
  moduleId: SubModuleId;
}

export function AnimationStateGraph({ moduleId }: AnimationStateGraphProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
    }
    return { total, implemented };
  }, [defs, featureMap]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* State machine */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-violet-500/10 transition-colors duration-700" />

        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2 relative z-10">
          <Activity className="w-4 h-4 text-violet-400" /> AnimBP State Machine
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5 relative z-10">
          {STATE_NODES.map((node, i) => {
            const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            return (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                className="rounded-xl border p-3.5 relative overflow-hidden group/node"
                style={{
                  borderColor: `${ACCENT}30`,
                  backgroundColor: `${ACCENT}${OPACITY_8}`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-violet-500/5 to-transparent opacity-0 group-hover/node:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                  <span className="text-sm font-bold text-text">{node.name}</span>
                </div>
                <span className="text-xs font-mono text-text-muted bg-surface-deep px-2 py-1 rounded inline-block relative z-10 border border-border/40">
                  {node.ref}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Transition labels */}
        <div className="space-y-1.5 relative z-10 bg-surface-deep/30 p-3 rounded-xl border border-border/40">
          <div className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-2">Transitions Matrix</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {STATE_NODES.flatMap((node) =>
              node.transitions.map((t, i) => (
                <motion.div
                  key={`${node.name}->${t.to}`}
                  initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 text-xs bg-surface/50 px-2 py-1.5 rounded"
                >
                  <span className="font-mono font-medium text-text px-1" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>{node.name}</span>
                  <span className="text-text-muted opacity-50">&rarr;</span>
                  <span className="font-mono font-medium text-text px-1 bg-surface-hover rounded">{t.to}</span>
                  <span className="text-text-muted ml-auto italic opacity-80 text-[10px]">{t.label}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Montage timeline */}
      <SurfaceCard level={2} className="p-4 overflow-hidden relative group">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-text/50" /> Combo Montage Timeline Data
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          {COMBO_SECTIONS.map((section, i) => (
            <div key={section.label} className="flex items-center gap-2 flex-1">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.2 }}
                className="flex-1"
              >
                <div
                  className="rounded-xl border px-3 py-2 mb-2 relative overflow-hidden"
                  style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex justify-between items-center relative z-10">
                    <div className="text-sm font-bold text-text">{section.label}</div>
                    <div className="text-xs font-mono font-semibold" style={{ color: ACCENT }}>{section.duration}</div>
                  </div>
                </div>

                {/* Notify windows */}
                <div className="space-y-1.5">
                  {section.windows.map((w, wi) => (
                    <div key={w.name} className="relative h-4 rounded overflow-hidden bg-surface-deep shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${w.width * 100}%` }}
                        transition={{ delay: (i * 0.2) + (wi * 0.1) + 0.3, duration: 0.5, type: 'spring' }}
                        className="absolute top-0 h-full rounded shadow-sm"
                        style={{
                          left: `${w.start * 100}%`,
                          backgroundColor: `${w.color}50`,
                          borderLeft: `2px solid ${w.color}`,
                          boxShadow: `0 0 8px ${w.color}40`,
                        }}
                        title={w.name}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>

              {i < COMBO_SECTIONS.length - 1 && (
                <div className="hidden md:flex flex-col items-center flex-shrink-0 w-8">
                  <div className="w-full h-[2px] bg-border relative overflow-hidden rounded-full">
                    <motion.div
                      className="absolute inset-y-0 left-0 w-full bg-text-muted/50"
                      initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-5 text-xs font-medium text-text-muted flex-wrap border-t border-border/40 pt-3">
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${ACCENT_CYAN}80`, color: ACCENT_CYAN }} />
            ComboWindow
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_ERROR}80`, color: STATUS_ERROR }} />
            HitDetection
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_WARNING}80`, color: STATUS_WARNING }} />
            SpawnVFX
          </span>
        </div>
      </SurfaceCard>

      {/* Asset list */}
      <div className="space-y-2 pt-2">
        <div className="px-1"><SectionLabel label="Anim Architecture Modules" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ASSET_FEATURES.map((name, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FeatureCard name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pipeline footer */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
        <SectionLabel label="Retarget Pipeline" />
        <div className="mt-3 relative z-10">
          <PipelineFlow steps={['Mixamo FBX', 'Bone Prefix Strip', 'IK Retargeter', 'Root Motion Extract', 'Commandlet']} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}
