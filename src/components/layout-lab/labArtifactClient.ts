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
