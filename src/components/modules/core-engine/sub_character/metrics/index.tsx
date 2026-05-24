'use client';

import type { ReactNode } from 'react';
import {
  ClassHierarchyMetric, PropertiesMetric, ScalingMetric,
  HitboxMetric, CameraMetric, BindingsMetric, KeyboardMetric,
} from './BlueprintMetrics';
import {
  StatesMetric, DodgeMetric, CurveEditorMetric,
  OptimizerMetric, ComparisonMetric, BalanceMetric,
} from './MovementMetrics';

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
