'use client';

import { useLabPipelineStore, type LabStepArtifact } from './labPipelineStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { resolveAccept } from './labAcceptance';
import type { AcceptanceResult, CheckerContext } from '@/lib/catalog/acceptance/types';

/**
 * ONE `CheckerContext` construction for the whole lab — the single answer to
 * "what does this step's Checker see?".
 *
 * Before this module three paths built their own context and disagreed:
 *  - the on-screen banner (`ArchetypeStep`) passed `siblings: {}` + a LIVE `has()`;
 *  - the write-through that PERSISTS the verdict (`Baseline/useBaseline`) passed real
 *    siblings + `has: () => false`;
 *  - the rail/matrix recompute (`deriveEntityArtifacts`) passed real siblings + `has: () => false`.
 * A sibling-aware checker could therefore show one verdict on screen and store another, and
 * every link-aware checker (fleet-wide since the `linksResolve` tranche — 65+ steps) persisted
 * a pessimistic `deferred` while the banner read `pass`.
 *
 * ── The unified semantics (and why) ────────────────────────────────────────────
 *  - `siblings` — EVERY persisted step of the same entity, keyed by step label, INCLUDING the
 *    step being graded. This mirrors the server (`headless.ts` → `serverCheckerContext`, which
 *    lists all of the entity's artifacts), so the lab and the headless path grade the same
 *    inputs. Omitting siblings (the old banner behaviour) is what made a derived checker
 *    (e.g. the Items Test Gate, which reads upstream acceptance) read differently on screen.
 *  - `has` — the LIVE catalog store (`entitiesByCatalog`), the lab's source of entity
 *    existence, mirroring the server's `seededEntities`. `() => false` is not a neutral
 *    default: it asserts "no entity anywhere exists", which drags every satisfied
 *    cross-catalog link to `deferred` on the persisted row while the banner passed.
 *
 * Pure builder + a snapshot helper for non-React callers (the write-through fires from a
 * store subscription, not a render).
 */
export function buildLabCheckerContext(
  catalogId: string,
  entitySteps: Record<string, LabStepArtifact> | undefined,
  entitiesByCatalog: Record<string, Record<string, unknown>>,
): CheckerContext {
  const siblings: Record<string, Record<string, unknown>> = {};
  for (const [step, art] of Object.entries(entitySteps ?? {})) siblings[step] = art.data;
  return {
    catalog: catalogId,
    siblings,
    has: (c, e) => !!entitiesByCatalog[c]?.[e],
  };
}

/** The same context, read from the live store snapshots — for callers outside render. */
export function labCheckerContext(catalogId: string, entityId: string): CheckerContext {
  return buildLabCheckerContext(
    catalogId,
    useLabPipelineStore.getState().byEntity[entityId],
    useCatalogStore.getState().entitiesByCatalog,
  );
}

/**
 * Grade a step's data exactly as the banner does — the write-through's single entry point,
 * so the status it PERSISTS can never diverge from the status on screen. `null` when the
 * (catalog, step) has no resolvable checker (the caller's own status then stands).
 *
 * ── This function is deliberately THROW-TRANSPARENT ────────────────────────────
 * Checkers are arbitrary functions over artifact `data` — untrusted input from produce
 * bodies, the MCP submit path and headless drains — so `accept(...)` CAN throw, and the
 * throw propagates to the caller on purpose. Two reasons it is not swallowed here:
 *  1. `null` already means "no checker resolvable", and every caller reads that as
 *     "use my own status" (the write-through falls back to `pass`). Collapsing a THROW
 *     into the same `null` would persist a fabricated `pass` for data no checker read.
 *  2. This must stay the ONE grading path the on-screen banner shares. A second, guarded
 *     copy would let the persisted status and the displayed status drift — exactly what
 *     this module exists to prevent.
 * So each caller decides what a throw MEANS for it. The write-through
 * (`Baseline/useBaseline.ts` → `syncStep`) catches it and records a `syncError` naming the
 * thrown reason, sending nothing.
 */
export function labGrade(
  catalogId: string,
  entityId: string,
  step: string,
  data: Record<string, unknown>,
): AcceptanceResult | null {
  const accept = resolveAccept(catalogId, step);
  return accept ? accept(data, labCheckerContext(catalogId, entityId)) : null;
}

/**
 * The server-drain overlay + its persisted-verdict shape now live with the ONE acceptance
 * truth (`@/lib/catalog/acceptance/resolveStepAcceptance`) so the server-importable path can
 * use them too. Re-exported here for the lab's existing call sites.
 */
export { serverVerdictOverlay, type PersistedVerdict } from '@/lib/catalog/acceptance/resolveStepAcceptance';
