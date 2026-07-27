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

/** The persisted (server-side) verdict for a step — the shape both the artifact cache and
 *  the hydrated `LabStepArtifact` expose. */
export interface PersistedVerdict {
  status?: string;
  tier?: string;
  reason?: string;
}

/**
 * Overlay the SERVER's verdict on a locally-recomputed one.
 *
 * The only case where the server knows more than the local checker is an L3/L4 gate: a pure
 * Checker can only ever say `deferred` for an unrun runtime/visual gate, while the drain
 * runner has actually run it. So a concrete server `pass`/`fail` wins over a local
 * `deferred` (carrying the server's tier + reason); anything else leaves the local verdict
 * untouched — the server never silently overrides a checker that could decide for itself.
 */
export function serverVerdictOverlay(local: AcceptanceResult, persisted?: PersistedVerdict): AcceptanceResult {
  if (local.status !== 'deferred') return local;
  const s = persisted?.status;
  if (s !== 'pass' && s !== 'fail') return local;
  // Drop the local (deferred) reason — the server's outcome supersedes it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured to OMIT the key
  const { reason: _localReason, ...rest } = local;
  return {
    ...rest,
    status: s,
    ...(persisted?.tier ? { tier: persisted.tier as AcceptanceResult['tier'] } : {}),
    ...(persisted?.reason ? { reason: persisted.reason } : {}),
  };
}
