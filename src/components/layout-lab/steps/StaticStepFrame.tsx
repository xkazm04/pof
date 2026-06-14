'use client';

import { useMemo } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { useStaticStep } from './useStaticStep';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';

/** What a static step needs to build its panels: the persisted artifact and the
 *  shared produce dispatch (used as both `onComplete` and the banner `onFix`). */
export interface StaticStepContext {
  art: LabStepArtifact | undefined;
  runProduce: () => void;
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
  const acceptance = useMemo(
    () => ITEM_STEP_SPECS[step].accept(art?.data ?? {}),
    [art?.data, step],
  );
  return (
    <StepFrame t={t} acceptance={acceptance} onFix={runProduce} panels={panels({ art, runProduce })} />
  );
}
