'use client';

import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import { withProduceDirection } from '@/lib/catalog/produceDirection';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';

/**
 * Shared plumbing for the non-generative ("static") Items steps — the counterpart
 * to the shared `useGenerativeStep` (steps/shared/). It subscribes to the persisted step
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
  runProduce: (ctx?: { direction: string; prompt: string }) => void;
} {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  // The operator's typed direction (from `CliProduce.onComplete`) is forwarded to the step's
  // produce body AND stamped on the artifact, exactly as the generic ArchetypeStep does — so
  // the bespoke Items steps record what drove them too. Called with no ctx (the Acceptance
  // banner's onFix) it behaves exactly as before.
  const runProduce = (ctx?: { direction: string; prompt: string }) =>
    produce(entity.id, step, withProduceDirection(ITEM_STEP_SPECS[step].produce(entity, ctx?.direction), ctx));
  return { art, runProduce };
}
