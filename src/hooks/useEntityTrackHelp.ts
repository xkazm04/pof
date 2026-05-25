'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { trackLabel, trackHint, type PipelineTrackId } from '@/lib/pipeline/tracks';
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
 * Dispatches a CLI evaluation for one production track of an entity. The
 * prompt asks Claude to assess the track's current coverage and recommend the
 * concrete next steps to bring it to `done`. Output streams into the CLI Rail;
 * the session key matches `gen-<entityId>` so it appears under the entity's
 * rail filter alongside generation sessions.
 *
 * Phase 13 keeps this as a help dispatch (operator reads + sets state). Auto
 * write-back of the track state via @@CALLBACK is Phase 13b.
 */
export function useEntityTrackHelp(entity: StoredCatalogEntity): UseEntityTrackHelpResult {
  const moduleId = CATALOG_MODULE[entity.catalogId] ?? 'arpg-gas';
  const cli = useModuleCLI({
    moduleId,
    sessionKey: `gen-${entity.id}`,
    label: `Eval ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const evaluate = useCallback(
    (trackId: PipelineTrackId) => {
      const label = trackLabel(trackId);
      const prompt =
        `Evaluate the "${label}" production track for the ${entity.catalogId} entity "${entity.name}".\n\n` +
        `Track scope: ${trackHint(trackId)}\n\n` +
        `Assess what exists today (in the UE project + this catalog entity's data), ` +
        `judge whether the "${label}" track is not-started / in-progress / done / blocked, ` +
        `and list the concrete next steps to bring it to a playable "done" state. ` +
        `Be specific about file paths, asset names, and which existing PoF systems to reuse.`;
      void cli.execute(TaskFactory.quickAction(moduleId, prompt, `Eval ${entity.name} · ${label}`));
    },
    [cli, entity, moduleId],
  );

  return { evaluate, isRunning: cli.isRunning };
}
