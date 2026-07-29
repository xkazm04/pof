'use client';

import { useMemo } from 'react';
import { useEntitySteps, type LabStepArtifact } from '../../labPipelineStore';
import { buildLabCheckerContext, serverVerdictOverlay } from '../../labCheckerContext';
import { useStepJudgeVerdicts } from '../../hooks/useStepJudgeVerdicts';
import { bridgeJudgeVerdict } from '@/lib/catalog/acceptance/judgeBridge';
import { getStepFact } from '@/lib/status/statusModel';
import { useCatalogStore } from '@/stores/catalogStore';
import type { AcceptanceResult, CheckerContext } from '@/lib/catalog/acceptance/types';
import type { Acceptance } from '../StepFrame';

/**
 * The ONE on-screen acceptance derivation for every step UI in the lab — generic
 * (`ArchetypeStep`) and bespoke (Items) alike.
 *
 * Before this hook the three step families graded through three different contexts:
 *  - `ArchetypeStep` built the unified {@link buildLabCheckerContext} and layered the
 *    server drain overlay + judge bridge on top;
 *  - `StaticStepFrame` hand-rolled a `CheckerContext` with `has: () => false` — the exact
 *    anti-pattern `labCheckerContext.ts` documents (it asserts "no entity anywhere exists",
 *    dragging every satisfied cross-catalog link to `deferred`) — and saw neither overlay;
 *  - `ItemArt`'s three generative steps called `accept(data)` with NO context at all.
 * So the reference pipeline could show a verdict the server had already superseded.
 *
 * This collapses all three onto the same inputs and the same overlay order:
 *   checker(ctx) → server drain overlay → judge bridge.
 * Callers may still post-process (the generic renderer appends its plain-language fix copy).
 *
 * Returns `Acceptance` (the StepFrame banner shape) — structurally the checker's
 * `AcceptanceResult` plus the optional copy fields.
 */
export function useStepAcceptance({ catalogId, entityId, step, art, accept }: {
  /** Catalog the step belongs to (`'items'` for the bespoke reference pipeline). */
  catalogId: string;
  entityId: string;
  step: string;
  /** The persisted artifact — supplies both the graded `data` and the server verdict. */
  art: LabStepArtifact | undefined;
  /** The step's own checker (`StepSpec.accept` / `ItemStepSpec.accept`). */
  accept: (data: Record<string, unknown>, ctx: CheckerContext) => Acceptance | AcceptanceResult;
}): Acceptance {
  const entitySteps = useEntitySteps(entityId);
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const verdicts = useStepJudgeVerdicts(catalogId || undefined, entityId, step);

  const ctx = useMemo<CheckerContext>(
    () => buildLabCheckerContext(catalogId, entitySteps, entitiesByCatalog),
    [catalogId, entitySteps, entitiesByCatalog],
  );

  return useMemo(() => {
    const raw = accept(art?.data ?? {}, ctx) as AcceptanceResult;
    const overlaid = serverVerdictOverlay(raw, art);
    return bridgeJudgeVerdict(overlaid, verdicts, catalogId ? getStepFact(catalogId, step)?.judge : undefined) as Acceptance;
  }, [accept, art, ctx, verdicts, catalogId, step]);
}
