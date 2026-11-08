'use client';

import { useMemo } from 'react';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN,
  OPACITY_20, OPACITY_80,
  withOpacity,
} from '@/lib/chart-colors';
import {
  MOVEMENT_STATES,
  DODGE_TRAJECTORIES,
  ACCEL_CURVE_POINTS,
  COMPARISON_CHARACTERS,
  computeBalanceScores,
  ACCENT,
} from '../_shared/data';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { findBasePreset } from '@/lib/character/inspector-fields';
import { resolveStack } from '@/lib/feel-adjustment-layers';

/** "{count} states" with mini colored dots */
export function StatesMetric() {
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
export function DodgeMetric() {
  // Dodge distance from the resolved feel stack (cm -> m), the value Apply writes to UE.
  const baseFeelPresetId = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const avgDist = useMemo(
    () => resolveStack(findBasePreset(baseFeelPresetId).profile, feelLayers).dodge.distance / 100,
    [baseFeelPresetId, feelLayers],
  );
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="font-bold" style={{ color: ACCENT_CYAN }}>
        {Number(avgDist.toFixed(2))}m
      </span>
      <span className="text-text-muted">
        {DODGE_TRAJECTORIES.length} paths
      </span>
    </div>
  );
}

/** Tiny sparkline of accel curve */
export function CurveEditorMetric() {
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

/** The persisted base feel preset (what AI Feel's Apply builds on) + its layer count. */
export function OptimizerMetric() {
  const baseFeelPresetId = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const layerCount = useCharacterBlueprintStore((s) => s.feelLayers.length);
  const preset = findBasePreset(baseFeelPresetId);
  return (
    <span className="text-[10px] font-mono text-text-muted">
      <span style={{ color: preset.color }}>{preset.name}</span>
      {layerCount > 0 && <span className="ml-1">+{layerCount} {layerCount === 1 ? 'layer' : 'layers'}</span>}
    </span>
  );
}

/** "{dupes} duplicates" — red if >0 */
export function ComparisonMetric() {
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
export function BalanceMetric() {
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
