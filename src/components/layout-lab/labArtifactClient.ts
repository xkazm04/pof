'use client';

import { tryApiFetch } from '@/lib/api-utils';
import type { ApiResponse } from '@/types/api';
import type { Result } from '@/types/result';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { DrainSummary } from '@/lib/test-gate-runner/types';
import type { DrainOutcome } from './batchDrainModel';

export interface ArtifactUpsertBody {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
}

/**
 * GET persisted artifacts for a catalog (optionally one entity), keeping the failure.
 *
 * A failed GET is NOT an empty catalog: a dead server, a 500 or an offline moment used
 * to be folded into `[]`, which every surface then rendered as "nothing has been
 * produced here" — the operator could re-produce over server truth. Callers that must
 * distinguish the two (the lab's shared artifact cache) read this `Result`.
 */
export async function fetchArtifactsResult(catalogId: string, entityId?: string): Promise<Result<PipelineArtifact[], string>> {
  const q = new URLSearchParams({ catalogId });
  if (entityId) q.set('entityId', entityId);
  const r = await tryApiFetch<PipelineArtifact[]>(`/api/pipeline-artifacts?${q.toString()}`);
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
}

/**
 * Lossy convenience wrapper over {@link fetchArtifactsResult} → `[]` on failure. Kept
 * for read-only consumers (the /status views) that aggregate many catalogs and have no
 * per-catalog error surface. Anything that RENDERS "not produced" must use the `Result`
 * form instead, or it will report a failed fetch as an empty pipeline.
 */
export async function fetchArtifacts(catalogId: string, entityId?: string): Promise<PipelineArtifact[]> {
  const r = await fetchArtifactsResult(catalogId, entityId);
  return r.ok ? r.data : [];
}

/**
 * POST one produced step's artifact. Returns whether the write actually reached the
 * server (mirrors {@link fetchArtifacts}'s `r.ok` pattern) — `false` when the server is
 * offline / 500 — so the write-through can surface an honest "not synced" state instead
 * of leaving the optimistic local store looking as if the server accepted it.
 */
export async function postArtifact(body: ArtifactUpsertBody): Promise<boolean> {
  const r = await tryApiFetch('/api/pipeline-artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.ok;
}

/**
 * DELETE every persisted artifact for one entity (the server half of "Reset"). Returns a
 * `Result` rather than a boolean because the caller must SHOW the reason: a reset whose
 * server delete silently failed would be re-hydrated on the next load, so it may never be
 * reported as "done".
 */
export async function deleteEntityArtifacts(catalogId: string, entityId: string): Promise<Result<number, string>> {
  const q = new URLSearchParams({ catalogId, entityId });
  const r = await tryApiFetch<{ deleted: number }>(`/api/pipeline-artifacts?${q.toString()}`, { method: 'DELETE' });
  return r.ok ? { ok: true, data: r.data.deleted } : { ok: false, error: r.error };
}

/** Runner lease state read from the drain status route (mirrors `LeaseState` server-side). */
export interface DrainLeaseState {
  held: boolean;
  /** Scope of the oldest held lease (`catalog/entity` or `global`) — null when idle. */
  scope: string | null;
  since: string | null;
  scopes: string[];
}

/**
 * Read the current drain lease state (is the non-reentrant UE editor busy, and with what).
 * Non-throwing → null on failure so the runner chip degrades to "unknown/idle" rather than error.
 */
export async function fetchDrainLease(): Promise<DrainLeaseState | null> {
  const r = await tryApiFetch<DrainLeaseState>('/api/pipeline-artifacts/drain/status');
  return r.ok ? r.data : null;
}

export interface DrainSummaryLite { ran: number; passed: number; failed: number; skipped: number }

/** Operator-triggered: run this entity's deferred L3/L4 gates through the live-UE runner. */
export async function drainGates(catalogId: string, entityId: string): Promise<DrainSummaryLite | null> {
  const r = await tryApiFetch<DrainSummaryLite>('/api/pipeline-artifacts/drain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId, entityId }),
  });
  return r.ok ? r.data : null;
}

/**
 * CATALOG-LEVEL batch drain: sends the WHOLE set of deferred entities in ONE request
 * (`{ catalogId, entityIds }`), so the server does one artifact collection + one grouped
 * editor boot for every gate across all the entities — not one boot per entity. Returns
 * one of the three outcomes the Matrix drain reacts to:
 * - `ok` — the aggregate {@link DrainSummary} for the whole set (per-step results, tagged
 *   with their `job.entityId`, so per-entity fail reasons survive the fold).
 * - `locked` — HTTP 409: the batch lease is ALL-OR-NOTHING, so if ANY requested entity is
 *   already in flight the server refuses the whole batch (the caller retries once, then
 *   records every requested entity as locked).
 * - `error` — network/server failure.
 * The route documents no batch-size limit (one collection + one grouped boot cover the set),
 * so the caller sends the full list in a single POST.
 */
export async function drainCatalogGates(catalogId: string, entityIds: string[]): Promise<DrainOutcome> {
  try {
    const res = await fetch('/api/pipeline-artifacts/drain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId, entityIds }),
    });
    if (res.status === 409) return { kind: 'locked' };
    const json = (await res.json()) as ApiResponse<DrainSummary>;
    if (!json.success) return { kind: 'error', reason: json.error };
    return { kind: 'ok', summary: json.data };
  } catch (e) {
    return { kind: 'error', reason: e instanceof Error ? e.message : 'Network error' };
  }
}
