'use client';

import type { ReactNode } from 'react';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  OPACITY_20, OPACITY_80,
  withOpacity,
} from '@/lib/chart-colors';
import { NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import {
  CLASS_TREE, type ClassNode,
  BLUEPRINT_PROPERTIES,
  SCALING_PROPS,
  HITBOX_ZONES,
  INPUT_BINDINGS,
  KEY_CONFLICTS,
  MOVEMENT_STATES,
  DODGE_TRAJECTORIES,
  ACCEL_CURVE_POINTS,
  COMPARISON_CHARACTERS,
  COMPARISON_STATS,
  computeBalanceScores,
  ACCENT,
} from '../data';

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function countNodes(node: ClassNode): number {
  let count = 1;
  if (node.children) for (const c of node.children) count += countNodes(c);
  return count;
}

function countLeafTypes(node: ClassNode): Set<string> {
  const types = new Set<string>();
  if (node.subtitle) types.add(node.subtitle);
  if (node.children) for (const c of node.children) {
    for (const t of countLeafTypes(c)) types.add(t);
  }
  return types;
}

/* ── Micro-components ────────────────────────────────────────────────────────── */

/** "{types} types / {classes} classes" */
function ClassHierarchyMetric() {
  const classes = countNodes(CLASS_TREE);
  const types = countLeafTypes(CLASS_TREE).size;
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span style={{ color: ACCENT }}>{types}<span className="text-text-muted ml-0.5">types</span></span>
      <span className="text-text-muted">/</span>
      <span style={{ color: ACCENT_CYAN }}>{classes}<span className="text-text-muted ml-0.5">classes</span></span>
    </div>
  );
}

/** Stacked mini bars for HP, Speed, Armor */
function PropertiesMetric() {
  const player = COMPARISON_CHARACTERS.find(c => c.id === 'player') ?? COMPARISON_CHARACTERS[0];
  const statLookup = (name: string) => {
    const idx = COMPARISON_STATS.findIndex(s => s.stat === name);
    return idx >= 0 ? { stat: COMPARISON_STATS[idx], val: player.values[idx] } : null;
  };
  const hp = statLookup('HP');
  const spd = statLookup('Speed');
  const arm = statLookup('Armor');
  const bars = [
    hp && { label: 'HP', stat: hp.stat, val: hp.val, color: STATUS_ERROR },
    spd && { label: 'Spd', stat: spd.stat, val: spd.val, color: ACCENT_CYAN },
    arm && { label: 'Arm', stat: arm.stat, val: arm.val, color: ACCENT_EMERALD },
  ].filter(Boolean) as { label: string; stat: typeof COMPARISON_STATS[0]; val: number; color: string }[];
  return (
    <div className="flex flex-col gap-1" style={{ width: 60 }}>
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-text-muted w-4 shrink-0">{b.label}</span>
          <NeonBar pct={(b.val / b.stat.maxVal) * 100} color={b.color} height={3} />
        </div>
      ))}
    </div>
  );
}

/** Sparkline SVG (60×20px) from scaling curve points */
function ScalingMetric() {
  const pts = SCALING_PROPS.map((sp, i) => ({
    x: (i / (SCALING_PROPS.length - 1)) * 56 + 2,
    y: 18 - ((sp.max - sp.min) / sp.max) * 16,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <svg width={60} height={20} className="block" aria-hidden="true">
      <path d={d} fill="none" stroke={ACCENT_ORANGE} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={ACCENT_ORANGE} />
      ))}
    </svg>
  );
}

/** "{zones} zones" with colored dots */
function HitboxMetric() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span style={{ color: ACCENT }}>{HITBOX_ZONES.length}<span className="text-text-muted ml-0.5">zones</span></span>
      <span className="flex gap-0.5" aria-hidden="true">
        {HITBOX_ZONES.map((z) => (
          <span key={z.type} className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: z.color }} title={z.type} />
        ))}
      </span>
    </div>
  );
}

/** "FOV | Arm | Lag" compact stats */
function CameraMetric() {
  const fov = BLUEPRINT_PROPERTIES.find((p) => p.name === 'FOV');
  const arm = BLUEPRINT_PROPERTIES.find((p) => p.name === 'ArmLength');
  const lag = BLUEPRINT_PROPERTIES.find((p) => p.name === 'LagSpeed');
  return (
    <div className="flex items-center gap-1 text-[9px] font-mono tabular-nums">
      <span style={{ color: ACCENT_ORANGE }}>{fov?.current ?? '—'}</span>
      <span className="text-text-muted">|</span>
      <span style={{ color: ACCENT_CYAN }}>{arm?.current ?? '—'}</span>
      <span className="text-text-muted">|</span>
      <span style={{ color: ACCENT_EMERALD }}>{lag?.current ?? '—'}</span>
    </div>
  );
}

/** Colored ratio bar — Enhanced Input actions vs legacy */
function BindingsMetric() {
  const enhanced = INPUT_BINDINGS.filter((b) => b.action.startsWith('IA_')).length;
  const total = INPUT_BINDINGS.length;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono" style={{ color: ACCENT }}>
        {enhanced}<span className="text-text-muted">/{total}</span>
      </span>
      <div style={{ width: 32 }}>
        <NeonBar pct={(enhanced / total) * 100} color={STATUS_SUCCESS} height={3} />
      </div>
    </div>
  );
}

/** "{conflicts}" count — green if 0, red if >0 */
function KeyboardMetric() {
  const count = KEY_CONFLICTS.size;
  const color = count === 0 ? STATUS_SUCCESS : STATUS_ERROR;
  return (
    <span className="text-[10px] font-mono font-bold" style={{ color }}>
      {count}<span className="text-text-muted font-normal ml-0.5">{count === 1 ? 'conflict' : 'conflicts'}</span>
    </span>
  );
}

/** "{count} states" with mini colored dots */
function StatesMetric() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span style={{ color: ACCENT }}>{MOVEMENT_STATES.length}<span className="text-text-muted ml-0.5">states</span></span>
      <span className="flex gap-0.5" aria-hidden="true">
        {MOVEMENT_STATES.map((s) => (
          <span key={s.label} className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: s.color }} title={s.label} />
        ))}
      </span>
    </div>
  );
}

/** "{count} paths · {distance}m" */
function DodgeMetric() {
  const avgDist = 4.5; // average dodge distance in meters (derived from gameplay tuning)
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="font-bold" style={{ color: ACCENT_CYAN }}>
        {avgDist}m
      </span>
      <span className="text-text-muted">
        {DODGE_TRAJECTORIES.length} paths
      </span>
    </div>
  );
}

/** Tiny sparkline of accel curve */
function CurveEditorMetric() {
  const maxY = Math.max(...ACCEL_CURVE_POINTS.map((p) => p.y)) || 1;
  const pts = ACCEL_CURVE_POINTS.map((p) => ({
    x: p.x * 56 + 2,
    y: 18 - (p.y / maxY) * 16,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <svg width={60} height={20} className="block" aria-hidden="true">
      <path d={d} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Preset name or "No preset" muted */
function OptimizerMetric() {
  return (
    <span className="text-[10px] font-mono italic text-text-muted">
      No preset
    </span>
  );
}

/** "{dupes} duplicates" — red if >0 */
function ComparisonMetric() {
  const names = COMPARISON_CHARACTERS.map((c) => c.name);
  const dupes = names.length - new Set(names).size;
  const color = dupes === 0 ? STATUS_SUCCESS : STATUS_ERROR;
  return (
    <span className="text-[10px] font-mono font-bold" style={{ color }}>
      {dupes}<span className="text-text-muted font-normal ml-0.5">{dupes === 1 ? 'duplicate' : 'duplicates'}</span>
    </span>
  );
}

/** Mini radar thumbnail (40×40px SVG) */
function BalanceMetric() {
  const results = computeBalanceScores(COMPARISON_CHARACTERS.slice(0, 4));
  const axes = 6;
  const cx = 20;
  const cy = 20;
  const r = 16;

  function polarToXY(i: number, val: number) {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val };
  }

  const gridPoints = Array.from({ length: axes }, (_, i) => polarToXY(i, 1));
  const gridD = gridPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width={40} height={40} className="block" aria-hidden="true">
      <path d={gridD} fill="none" stroke={withOpacity(ACCENT, OPACITY_20)} strokeWidth={0.5} />
      {results.slice(0, 2).map((res) => {
        const pts = res.normalizedStats.map((v, i) => polarToXY(i, Math.min(v, 1)));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
        return (
          <path key={res.name} d={d} fill={withOpacity(res.color, OPACITY_20)} stroke={withOpacity(res.color, OPACITY_80)} strokeWidth={0.75} />
        );
      })}
    </svg>
  );
}

/* ── Registry ────────────────────────────────────────────────────────────────── */

const METRIC_MAP: Record<string, () => ReactNode> = {
  'class-hierarchy': () => <ClassHierarchyMetric />,
  'properties': () => <PropertiesMetric />,
  'scaling': () => <ScalingMetric />,
  'hitbox': () => <HitboxMetric />,
  'camera': () => <CameraMetric />,
  'bindings': () => <BindingsMetric />,
  'keyboard': () => <KeyboardMetric />,
  'states': () => <StatesMetric />,
  'dodge-trajectories': () => <DodgeMetric />,
  'curve-editor': () => <CurveEditorMetric />,
  'optimizer': () => <OptimizerMetric />,
  'comparison': () => <ComparisonMetric />,
  'balance': () => <BalanceMetric />,
};

export function getCharacterMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
