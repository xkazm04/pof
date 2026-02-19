'use client';

import { useMemo, useState, useCallback } from 'react';
import { Activity } from 'lucide-react';
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
    label: 'Attack1',
    duration: '0.45s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.55, width: 0.3 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.2, width: 0.25 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.2, width: 0.15 },
    ],
  },
  {
    label: 'Attack2',
    duration: '0.50s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.5, width: 0.35 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.18, width: 0.28 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.18, width: 0.15 },
    ],
  },
  {
    label: 'Attack3',
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
    <div className="space-y-3">
      {/* Header */}
      <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* State machine */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-3">
          AnimBP State Machine
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {STATE_NODES.map((node) => {
            const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            return (
              <div
                key={node.name}
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: `${ACCENT}40`,
                  backgroundColor: `${ACCENT}${OPACITY_8}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                  <span className="text-xs font-semibold text-text">{node.name}</span>
                </div>
                <span className="text-2xs font-mono text-text-muted">{node.ref}</span>
              </div>
            );
          })}
        </div>

        {/* Transition labels */}
        <div className="space-y-1">
          <div className="text-2xs text-text-muted font-medium mb-1">Transitions</div>
          {STATE_NODES.flatMap((node) =>
            node.transitions.map((t) => (
              <div key={`${node.name}->${t.to}`} className="flex items-center gap-1.5 text-2xs">
                <span className="font-mono text-text" style={{ color: ACCENT }}>{node.name}</span>
                <span className="text-text-muted">&rarr;</span>
                <span className="font-mono text-text">{t.to}</span>
                <span className="text-text-muted ml-1 italic">{t.label}</span>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>

      {/* Montage timeline */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-3">
          Combo Montage Timeline
        </div>
        <div className="flex gap-1">
          {COMBO_SECTIONS.map((section, i) => (
            <div key={section.label} className="flex items-center gap-1 flex-1">
              <div className="flex-1">
                <div
                  className="rounded-md border px-2 py-1.5 mb-1"
                  style={{ borderColor: `${ACCENT}30`, backgroundColor: `${ACCENT}${OPACITY_8}` }}
                >
                  <div className="text-xs font-semibold text-text">{section.label}</div>
                  <div className="text-2xs font-mono text-text-muted">{section.duration}</div>
                </div>

                {/* Notify windows */}
                <div className="space-y-0.5">
                  {section.windows.map((w) => (
                    <div key={w.name} className="relative h-3 rounded-sm overflow-hidden bg-surface-hover">
                      <div
                        className="absolute top-0 h-full rounded-sm"
                        style={{
                          left: `${w.start * 100}%`,
                          width: `${w.width * 100}%`,
                          backgroundColor: `${w.color}${OPACITY_30}`,
                          borderLeft: `2px solid ${w.color}`,
                        }}
                        title={w.name}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {i < COMBO_SECTIONS.length - 1 && (
                <span className="text-text-muted text-sm flex-shrink-0">&rarr;</span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-2xs text-text-muted flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_30}` }} />
            ComboWindow
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_30}` }} />
            HitDetection
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_30}` }} />
            SpawnVFX
          </span>
        </div>
      </SurfaceCard>

      {/* Asset list */}
      <div className="space-y-1.5">
        <div className="px-1"><SectionLabel label="Anim Assets" /></div>
        {ASSET_FEATURES.map((name) => (
          <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
        ))}
      </div>

      {/* Pipeline footer */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel label="Retarget Pipeline" />
        <div className="mt-2">
          <PipelineFlow steps={['Mixamo FBX', 'Bone Prefix Strip', 'IK Retargeter', 'Root Motion Extract', 'Commandlet']} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}
