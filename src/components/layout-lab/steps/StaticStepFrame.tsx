'use client';

import { useMemo } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { useStaticStep } from './useStaticStep';
import { ITEM_STEP_SPECS } from './itemsSteps';
import { useEntitySteps } from '../labPipelineStore';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

/** What a static step needs to build its panels: the persisted artifact and the
 *  shared produce dispatch (used as both `onComplete` and the banner `onFix`). */
export interface StaticStepContext {
  art: LabStepArtifact | undefined;
  /** Pass straight to `CliProduce.onComplete` — the typed direction reaches produce. */
  runProduce: (ctx?: { direction: string; prompt: string }) => void;
}

/**
 * Thin shared scaffold for every non-generative ("static") Items step.
 *
 * It lifts the byte-identical prologue that each step body used to copy-paste —
 * `const { art, runProduce } = useStaticStep(entity, step);` followed by
 * `<StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})} onFix={runProduce} panels={...} />`
 * — into one place. A step now supplies only its `panels`, derived from the
 * `{ art, runProduce }` context.
 *
 * The acceptance derivation is memoized on `[art?.data, step]`, so the
 * `ITEM_STEP_SPECS[step].accept(...)` call (and the `?? {}` allocation) no longer
 * runs on every render of the active step — stabilizing the `acceptance`
 * reference passed to StepFrame. Behavior is identical to the inline prologue:
 * same `accept` input (`art?.data ?? {}`), same `onFix` (`runProduce`).
 */
export function StaticStepFrame({ t, entity, step, panels }: {
  t: LabTheme;
  entity: LabEntity;
  step: string;
  /** Build the step's panels from the shared static-step context. */
  panels: (ctx: StaticStepContext) => StepPanel[];
}) {
  const { art, runProduce } = useStaticStep(entity, step);
  // Sibling-step artifacts feed the CheckerContext so derived gates (e.g. Test
  // Gate) can read upstream acceptance instead of trusting fabricated data.
  const entitySteps = useEntitySteps(entity.id);
  const acceptance = useMemo(() => {
    const siblings: Record<string, Record<string, unknown>> = {};
    for (const [s, a] of Object.entries(entitySteps ?? {})) siblings[s] = a.data;
    const ctx: CheckerContext = { catalog: 'items', siblings, has: () => false };
    return ITEM_STEP_SPECS[step].accept(art?.data ?? {}, ctx);
  }, [art?.data, step, entitySteps]);
  // onFix carries a corrective DIRECTION STRING, not a produce ctx — drop it rather than
  // letting it land in the ctx slot (it would stamp a prompt that was never built).
  return (
    <StepFrame t={t} acceptance={acceptance} onFix={() => runProduce()} catalogId="items" step={step} panels={panels({ art, runProduce })} />
  );
}
