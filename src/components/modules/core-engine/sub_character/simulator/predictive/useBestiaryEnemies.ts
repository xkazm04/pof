'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import {
  groupBestiaryArtifacts,
  hydrateEnemyRegistryFromBestiary,
  HARDCODED_ENEMY_SOURCE,
  type ArchetypeRegistry,
  type EnemySourceReport,
} from '@/lib/combat/simulation-engine';
import { ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';

/** Shape of a `pipeline_artifacts` row as served by the artifacts API. */
interface ArtifactRow {
  entityId: string;
  step: string;
  data: Record<string, unknown>;
}

export interface BestiaryEnemies {
  registry: ArchetypeRegistry;
  provenance: EnemySourceReport;
  loading: boolean;
  /** Fetch/parse failure — the sim still runs, on the hardcoded fixtures. */
  error: string | null;
}

/**
 * Source the simulator's enemies from the REAL bestiary catalog.
 *
 * Reads the bestiary's stored `pipeline_artifacts` and runs them through the
 * pure adapter (`hydrateEnemyRegistryFromBestiary`), so editing a bestiary row
 * in /layout moves the balance numbers. Every outcome is disclosed rather than
 * implied: an empty/unreachable catalog falls back to the hardcoded fixtures AND
 * says so, and a row the adapter refuses is named with its reason.
 */
export function useBestiaryEnemies(): BestiaryEnemies {
  const [state, setState] = useState<BestiaryEnemies>({
    registry: ENEMY_ARCHETYPE_BY_ID,
    provenance: HARDCODED_ENEMY_SOURCE,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await tryApiFetch<ArtifactRow[]>('/api/pipeline-artifacts?catalogId=bestiary');
      if (cancelled) return;
      if (!res.ok) {
        setState({
          registry: ENEMY_ARCHETYPE_BY_ID,
          provenance: {
            ...HARDCODED_ENEMY_SOURCE,
            summary:
              `${HARDCODED_ENEMY_SOURCE.summary} The bestiary catalog could not be read, ` +
              'so nothing could be hydrated from it.',
          },
          loading: false,
          error: res.error,
        });
        return;
      }
      const { registry, provenance } = hydrateEnemyRegistryFromBestiary(
        groupBestiaryArtifacts(res.data ?? []),
      );
      setState({ registry, provenance, loading: false, error: null });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
