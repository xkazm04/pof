'use client';

import { useEcwStore } from '@/stores/ecwStore';

export type RailScope =
  | { kind: 'entity'; catalogId: string; entityId: string }
  | { kind: 'project' };

/**
 * The CLI Rail's current scope. When both a catalog and an entity are
 * selected in `ecwStore`, the rail filters to sessions for that entity
 * (matched via `sessionKey === 'gen-${entityId}'` set by `useGeneration`).
 * Otherwise the rail shows all sessions (project scope).
 */
export function useRailScope(): RailScope {
  const catalogId = useEcwStore((s) => s.activeCatalogId);
  const entityId = useEcwStore((s) => s.activeEntityId);

  if (catalogId && entityId) return { kind: 'entity', catalogId, entityId };
  return { kind: 'project' };
}
