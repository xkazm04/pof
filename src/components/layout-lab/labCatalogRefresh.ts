'use client';

import { refreshArtifacts } from './labArtifactCache';
import { useLabPipelineStore, type LabStepArtifact, type RefreshOutcome } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { Result } from '@/types/result';

/**
 * CATALOG-scoped "refresh from server" — the whole-board twin of the per-entity refresh.
 *
 * Round 11 shipped the entity refresh, but it reconciles ONE entity and is mounted only in
 * the entity composition view. The Matrix — the surface whose entire job is showing a whole
 * catalog at once — had no refresh path at all, so another session's commit, a headless
 * drain resolving L3/L4 gates, or the MCP submit path writing rows left the board stale
 * until a hard reload.
 *
 * ── What this is NOT ──────────────────────────────────────────────────────────
 * Not a poll and not a focus-refetch: lab modules are LRU-suspended and a background timer
 * fights `useSuspendableEffect`. Freshness is ASKED for. And not "server wins": this
 * composes the existing per-entity `refreshEntity`, so the non-destructive rules are
 * literally the same code — a step holding local work the server has not got is KEPT and
 * REPORTED, never silently overwritten. There is no second merge rule here.
 *
 * It also introduces no second FETCH: `refreshArtifacts(catalogId)` (entity-less,
 * force-refetch) already existed and returns the rows it stored, so the whole catalog is
 * reconciled against exactly the response the cache now holds — and every other surface
 * (Matrix, coach, rail) reads that same response.
 */

/** One entity's share of a catalog refresh. */
export interface EntityRefreshReport {
  entityId: string;
  entityName: string;
  outcome: RefreshOutcome;
}

/** What a catalog-wide refresh actually did — reported, never applied silently. */
export interface CatalogRefreshOutcome {
  /** Entities where something MOVED (adopted / removed / kept). Unchanged ones are counted, not listed. */
  entities: EntityRefreshReport[];
  /** Steps re-read from the server (every surface now renders these, reconciled or not). */
  rows: number;
  /** How many entities were RECONCILED — i.e. hold local state that could shadow the server. */
  reconciled: number;
  adopted: number;
  removed: number;
  kept: number;
  unchanged: number;
}

/**
 * Project server rows into the local artifact shape the store reconciles against. ONE
 * mapping, shared with the per-entity refresh in `Baseline/useBaseline.ts` — the server's
 * VERDICT (status/tier/reason) rides along, because an L3/L4 drain resolves server-side and
 * the pure local Checker can only ever call such a step `deferred`.
 */
export function toLabArtifacts(rows: PipelineArtifact[]): { step: string; artifact: LabStepArtifact }[] {
  const now = new Date().toISOString();
  return rows.map((a) => ({
    step: a.step,
    artifact: {
      done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? now,
      status: a.status,
      ...(a.tier ? { tier: a.tier } : {}),
      ...(a.reason ? { reason: a.reason } : {}),
    },
  }));
}

/**
 * Force-refetch one catalog and reconcile EVERY one of its entities against exactly that
 * response.
 *
 * `entities` is the catalog's known entity list (the Matrix's rows). It matters because the
 * lab's artifact store is keyed by ENTITY id alone, so it is the only way to tell which
 * local state belongs to this catalog — and because absence is information: an entity whose
 * server rows were deleted still has to be reconciled, or a step dropped server-side would
 * read green forever.
 *
 * ── Only entities that hold LOCAL state are reconciled ────────────────────────
 * Deliberate, and not a gap. Reconciliation exists to resolve what LOCAL state says against
 * what the server says; an entity with no local artifacts has nothing to resolve, and every
 * surface (Matrix cells, coach, rollups) already re-renders from the refreshed cache rows
 * the fetch above just stored. Hydrating the rest would ALSO copy the whole catalog's
 * produce bodies into the persisted (localStorage) store — one refresh of `items` alone is
 * ~0.5 MB against a ~5 MB quota — so a refresh would quietly consume the budget the actual
 * work needs.
 *
 * Scoped to ONE catalog on purpose: 36 catalogs × N entities is not a refresh, it is a
 * project-wide re-read nobody asked for.
 */
export async function refreshCatalogFromServer(
  catalogId: string,
  entities: { id: string; name: string }[],
): Promise<Result<CatalogRefreshOutcome, string>> {
  const res = await refreshArtifacts(catalogId);
  if (!res.ok) return { ok: false, error: res.error };

  const rowsByEntity = new Map<string, PipelineArtifact[]>();
  for (const a of res.data) {
    const list = rowsByEntity.get(a.entityId) ?? [];
    list.push(a);
    rowsByEntity.set(a.entityId, list);
  }

  const local = useLabPipelineStore.getState().byEntity;
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  // In the board's own row order, and only where local state exists to reconcile.
  const ordered = entities.filter((e) => local[e.id]).map((e) => e.id);

  const refreshEntity = useLabPipelineStore.getState().refreshEntity;
  const out: CatalogRefreshOutcome = {
    entities: [], rows: res.data.length, reconciled: ordered.length,
    adopted: 0, removed: 0, kept: 0, unchanged: 0,
  };
  for (const id of ordered) {
    const outcome = refreshEntity(id, toLabArtifacts(rowsByEntity.get(id) ?? []));
    out.adopted += outcome.adopted.length;
    out.removed += outcome.removed.length;
    out.kept += outcome.kept.length;
    out.unchanged += outcome.unchanged;
    if (outcome.adopted.length || outcome.removed.length || outcome.kept.length) {
      out.entities.push({ entityId: id, entityName: nameById.get(id) ?? id, outcome });
    }
  }
  return { ok: true, data: out };
}

/** One honest sentence for the headline counts (per-entity details are listed separately). */
export function describeCatalogRefresh(o: CatalogRefreshOutcome): string {
  const entityWord = (n: number) => `${n} ${n === 1 ? 'entity' : 'entities'}`;
  const stepWord = (n: number) => `${n} step${n === 1 ? '' : 's'}`;
  if (o.entities.length === 0) {
    // The re-read is reported even when nothing needed reconciling — the board may well have
    // moved (it renders straight off the refreshed rows), and "nothing changed" would be a
    // claim this function is in no position to make.
    return o.reconciled === 0
      ? `Re-read ${stepWord(o.rows)} from the server. Nothing on this machine needed reconciling.`
      : `Up to date — ${stepWord(o.unchanged)} across ${entityWord(o.reconciled)} match the server.`;
  }
  return [
    `${entityWord(o.entities.length)} changed`,
    o.adopted ? `${o.adopted} adopted` : null,
    o.removed ? `${o.removed} removed` : null,
    o.kept ? `${o.kept} kept` : null,
    o.unchanged ? `${o.unchanged} unchanged` : null,
  ].filter(Boolean).join(' · ');
}
