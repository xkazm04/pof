'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { getAppOrigin } from '@/lib/constants';
import { trackLabel, type PipelineTrackId } from '@/lib/pipeline/tracks';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { SubModuleId } from '@/types/modules';

export interface UseEntityTrackHelpResult {
  evaluate: (trackId: PipelineTrackId) => void;
  isRunning: boolean;
}

/** Catalog → owning PoF module for session labelling (matches useGeneration). */
const CATALOG_MODULE: Record<string, SubModuleId> = {
  spellbook: 'arpg-gas',
  items: 'arpg-inventory',
  'loot-tables': 'arpg-loot',
  bestiary: 'arpg-enemy-ai',
  'combat-map': 'arpg-combat',
  'screen-flow': 'arpg-ui',
  'zone-map': 'arpg-world',
  'state-graph': 'arpg-animation',
};

/**
 * Dispatches a CLI evaluation for one production track of an entity (ECW
 * Phase 13/13b). The `evaluate-track` task asks Claude to assess the track and
 * emits a `@@CALLBACK` that writes the assessed `{ state, note }` back to
 * `/api/pipeline`. On stream completion this hook refetches the entity's
 * tracks and merges them via `loadTracks`, so the pipeline node reflects the
 * CLI's verdict automatically — no manual state-setting needed (13b).
 *
 * The session key matches `gen-<entityId>` so it appears under the entity's
 * CLI Rail filter alongside generation sessions.
 */
export function useEntityTrackHelp(entity: StoredCatalogEntity): UseEntityTrackHelpResult {
  const moduleId = CATALOG_MODULE[entity.catalogId] ?? 'arpg-gas';
  const loadTracks = usePipelineStore((s) => s.loadTracks);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: `gen-${entity.id}`,
    label: `Eval ${entity.name}`,
    accentColor: MODULE_COLORS.core,
    onComplete: () => {
      fetch(`/api/pipeline?catalogId=${encodeURIComponent(entity.catalogId)}&entityId=${encodeURIComponent(entity.id)}`)
        .then((r) => r.json())
        .then((res: { success: boolean; data?: PipelineTrackRecord[] }) => {
          if (res.success && res.data) loadTracks(entity.catalogId, entity.id, res.data);
        })
        .catch(() => {});
    },
  });

  const evaluate = useCallback(
    (trackId: PipelineTrackId) => {
      void cli.execute(
        TaskFactory.evaluateTrack(moduleId, entity, trackId, getAppOrigin(), `Eval ${entity.name} · ${trackLabel(trackId)}`),
      );
    },
    [cli, entity, moduleId],
  );

  return { evaluate, isRunning: cli.isRunning };
}
