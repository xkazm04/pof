'use client';

import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';

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

/** GET persisted artifacts for a catalog (optionally one entity). Non-throwing → [] on failure. */
export async function fetchArtifacts(catalogId: string, entityId?: string): Promise<PipelineArtifact[]> {
  const q = new URLSearchParams({ catalogId });
  if (entityId) q.set('entityId', entityId);
  const r = await tryApiFetch<PipelineArtifact[]>(`/api/pipeline-artifacts?${q.toString()}`);
  return r.ok ? r.data : [];
}

/** POST one produced step's artifact. Fire-and-forget; errors are swallowed (server may be offline). */
export async function postArtifact(body: ArtifactUpsertBody): Promise<void> {
  await tryApiFetch('/api/pipeline-artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
