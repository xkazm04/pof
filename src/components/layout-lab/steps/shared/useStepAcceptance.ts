'use client';

import { useMemo } from 'react';
import { useEntitySteps, type LabStepArtifact } from '../../labPipelineStore';
import { buildLabCheckerContext } from '../../labCheckerContext';
import { useStepJudgeVerdicts } from '../../hooks/useStepJudgeVerdicts';
import { resolveStepAcceptance } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { explainAcceptance } from '@/lib/catalog/acceptance/explainAcceptance';
import { useCatalogStore } from '@/stores/catalogStore';
import type { AcceptanceResult, Checker, CheckerContext } from '@/lib/catalog/acceptance/types';
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
    const data = art?.data ?? {};
    const raw = accept(data, ctx) as AcceptanceResult;
    const args = { catalogId, step, local: raw, persisted: art, verdicts, data, updatedAt: art?.at };
    // The ONE shared truth — the exact function the rail/matrix/coaches/rollup and the
    // headless `/status` path call, so the banner can never disagree with them.
    // `data` + the artifact's write time bind each verdict to the content it judged, so a
    // re-produce clears a stale condemnation instead of being condemned forever.
    const merged = resolveStepAcceptance(args) as Acceptance;
    // `explain` reconstructs the SAME chain on demand for the provenance strip's "Why this
    // grade?" disclosure. A thunk, not a value: it re-runs the checker (and every `allOf`
    // member), which must be a reader's cost, never a per-render one.
    return { ...merged, explain: () => explainAcceptance({ ...args, checker: accept as Checker, ctx }) };
  }, [accept, art, ctx, verdicts, catalogId, step]);
}
