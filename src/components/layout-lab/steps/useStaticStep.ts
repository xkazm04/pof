'use client';

import { useMemo } from 'react';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import { useStepProduceDoor, type ProduceDispatch } from './shared/useStepProduceDoor';
import { itemsBespokeArchetype, itemsBespokeStepSpec } from '../itemsBespokeSpecs';
import { isCliEligible, useLiveProduceMode } from '../labProduceMode';
import { useCanonStore } from '../canonStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';

/**
 * Shared plumbing for the non-generative ("static") Items steps — the counterpart
 * to the shared `useGenerativeStep` (steps/shared/). It subscribes to the persisted step
 * artifact and returns a single `runProduce` callback, used by both the Acceptance-banner
 * `onFix` and the CliProduce `onComplete`, so the dispatch contract has one source.
 *
 * `runProduce` is the SHARED produce door (`useStepProduceDoor`), the same one `ArchetypeStep`
 * uses: a TEXT step (`rules`, see `itemsBespokeSpecs.ts`) goes to a live CLI session when live
 * mode is on; otherwise the step's `ITEM_STEP_SPECS` stub is written with the typed direction
 * stamped on it and — every bespoke body being data-blind — the TEMPLATE stamp for any item but
 * the exemplar, which the guarded bespoke checker holds at `pending` instead of `pass`.
 */
export function useStaticStep(entity: LabEntity, step: string): {
  art: LabStepArtifact | undefined;
  runProduce: ProduceDispatch;
  /** A live CLI session can author this step (only the text archetypes can). */
  liveEligible: boolean;
  /** …and live mode is on, so the next click spends model budget. Display only. */
  live: boolean;
  /** The shared produce prompt (`buildStepProducePrompt`) — what a live dispatch really sends. */
  stepPrompt: (direction: string) => string;
} {
  const art = useLabStep(entity.id, step);
  const spec = useMemo(
    () => ({ archetype: itemsBespokeArchetype(step) ?? ('custom' as const), produce: ITEM_STEP_SPECS[step].produce }),
    [step],
  );
  const runProduce = useStepProduceDoor({ catalogId: 'items', spec, entity, step });
  const liveEligible = isCliEligible(spec.archetype);
  const [liveMode] = useLiveProduceMode();
  const live = liveEligible && liveMode;
  // Built at call time from the live stores (the panel previews it on demand; the server rebuilds
  // the same string from the same builder for a live dispatch, so the preview is the dispatch).
  const stepPrompt = (direction: string) => {
    const adapter = itemsBespokeStepSpec(step);
    if (!adapter) return direction;
    const artifacts = useLabPipelineStore.getState().byEntity[entity.id] ?? {};
    return buildStepProducePrompt(adapter, entity, direction, {
      catalogId: 'items',
      rules: useCanonStore.getState().rules,
      siblings: Object.fromEntries(Object.entries(artifacts).map(([label, a]) => [label, a.data])),
      linkedEntities: Object.values(useCatalogStore.getState().entitiesByCatalog).flatMap((c) => Object.values(c)),
      callback: live,
    });
  };
  return { art, runProduce, liveEligible, live, stepPrompt };
}
