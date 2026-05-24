'use client';

import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import {
  CLASS_TREE,
  BLUEPRINT_PROPERTIES,
  SCALING_PROPS,
  HITBOX_ZONES,
  INPUT_BINDINGS,
  KEY_CONFLICTS,
  COMPARISON_CHARACTERS,
  COMPARISON_STATS,
  ACCENT,
} from '../_shared/data';
import { countNodes, countLeafTypes } from './metric-helpers';

/** "{types} types / {classes} classes" */
export function ClassHierarchyMetric() {
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
export function PropertiesMetric() {
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
export function ScalingMetric() {
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
export function HitboxMetric() {
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
export function CameraMetric() {
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
export function BindingsMetric() {
  const enhanced = INPUT_BINDINGS.filter((b) => b.action.startsWith('IA_')).length;
  const total = INPUT_BINDINGS.length;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono" style={{ color: ACCENT }}>
        {enhanced}<span className="text-text-muted">/{total}</span>
      </span>
      <div className="w-8">
        <NeonBar pct={(enhanced / total) * 100} color={STATUS_SUCCESS} height={3} />
      </div>
    </div>
  );
}

/** "{conflicts}" count — green if 0, red if >0 */
export function KeyboardMetric() {
  const count = KEY_CONFLICTS.size;
  const color = count === 0 ? STATUS_SUCCESS : STATUS_ERROR;
  return (
    <span className="text-[10px] font-mono font-bold" style={{ color }}>
      {count}<span className="text-text-muted font-normal ml-0.5">{count === 1 ? 'conflict' : 'conflicts'}</span>
    </span>
  );
}
