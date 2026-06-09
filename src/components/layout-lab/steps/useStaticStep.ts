'use client';

import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';

/**
 * Shared plumbing for the non-generative ("static") Items steps — the counterpart
 * to `useGenerativeStep` in ItemArt.tsx. It subscribes to the persisted step
 * artifact and returns a single `runProduce` callback that writes the step's spec
 * output (`ITEM_STEP_SPECS[step].produce(entity)`).
 *
 * Every static step dispatches the *same* produce from both its Acceptance-banner
 * `onFix` and its CliProduce `onComplete`, so the call
 * `produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))` used to be
 * copy-pasted across ~20 call sites. Collapsing it here makes the dispatch
 * contract a single source of truth: a change to it edits one place, not ten
 * components.
 */
export function useStaticStep(entity: LabEntity, step: string): {
  art: LabStepArtifact | undefined;
  runProduce: () => void;
} {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const runProduce = () => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity));
  return { art, runProduce };
}
