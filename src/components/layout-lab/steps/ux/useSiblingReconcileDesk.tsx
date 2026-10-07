'use client';

import { useMemo, useState } from 'react';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { useUxVariant } from './useUxVariant';
import { SiblingReconcilePanel, type SiblingView } from './SiblingReconcilePanel';
import { RECONCILE_STEPS, SIBLING_CHECK_UX, reconcileDirection, reconcileSiblings } from './siblingReconcile';
import type { StepPanel } from '../StepFrame';
import type { LabStepArtifact } from '../../labPipelineStore';
import type { LabEntity } from '../../useLabCatalogData';
import type { StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';
import type { LabTheme } from '../../theme';

export interface SiblingReconcileDesk {
  /** `[Sibling agreement]` while the desk is showing, else empty. */
  panels: StepPanel[];
  /** A direction the operator seeded into the Produce panel, if any. */
  seed?: string;
  /** Remount key for the Produce panel, bumped on every seed. 0 until the first seed. */
  seedKey: number;
}

/**
 * PROTOTYPE wiring for `?ux=sibling-check` (see `SiblingReconcilePanel`). Off (no flag, another
 * step, or no catalog) it returns no panel and no seed, so `ArchetypeStep` renders exactly as
 * before and nothing is computed. On, it reads only what the step already holds: the entity's
 * artifacts from the lab store, the `siblings` record the prompt builder is given, and the
 * catalog pipeline's step list. It makes no request.
 */
export function useSiblingReconcileDesk({ t, catalogId, entity, step, spec, data, artifacts, siblings, View }: {
  t: LabTheme;
  catalogId?: string;
  entity: LabEntity;
  step: string;
  spec: StepSpec;
  data: Record<string, unknown>;
  artifacts: Record<string, LabStepArtifact> | undefined;
  siblings: Record<string, Record<string, unknown>>;
  View: SiblingView;
}): SiblingReconcileDesk {
  const on = useUxVariant(SIBLING_CHECK_UX) && RECONCILE_STEPS.has(step) && !!catalogId;
  const [seed, setSeed] = useState<{ text: string; key: number } | null>(null);
  const keyField = 'field' in spec.view ? spec.view.field : undefined;
  const pipeline = on && catalogId ? getCatalogPipeline(catalogId) : null;

  const r = useMemo(
    () => (on && catalogId
      ? reconcileSiblings({ catalogId, step, keyField, data, artifacts, siblings, order: pipeline?.steps.map((s) => s.label) ?? [] })
      : null),
    [on, catalogId, step, keyField, data, artifacts, siblings, pipeline],
  );
  const views = useMemo(
    () => Object.fromEntries((pipeline?.steps ?? []).map((s) => [s.label, s.view])) as Record<string, ViewDescriptor>,
    [pipeline],
  );

  if (!r) return { panels: [], seedKey: seed?.key ?? 0, ...(seed ? { seed: seed.text } : {}) };

  const direction = reconcileDirection(step, entity.name, r);
  const onSeed = () => setSeed((s) => ({ text: direction, key: (s?.key ?? 0) + 1 }));
  return {
    panels: [{
      label: 'Sibling agreement',
      node: <SiblingReconcilePanel t={t} step={step} r={r} keyField={keyField} views={views} artifacts={artifacts}
        View={View} seeded={!!direction && seed?.text === direction} onSeed={onSeed} />,
    }],
    seed: seed?.text,
    seedKey: seed?.key ?? 0,
  };
}
