'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { AbilityEntry, LifecycleRecord } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import { useCatalogStore } from '@/stores/catalogStore';
import { getAppOrigin } from '@/lib/constants';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_COLORS } from '@/lib/chart-colors';

export interface UseGenerationResult {
  generate: (step: GenerationStep) => void;
  isRunning: boolean;
}

/**
 * Drives folder-09 generation for one catalog entity: dispatches a recipe step
 * through the CLI (`TaskFactory.generate`), and once the session's `@@CALLBACK`
 * has persisted the lifecycle transition to `/api/catalog`, refetches + merges
 * it so the Spellbook lifecycle badge reflects server truth.
 */
export function useGeneration(entity: AbilityEntry): UseGenerationResult {
  const loadLifecycle = useCatalogStore((s) => s.loadLifecycle);

  const cli = useModuleCLI({
    moduleId: 'arpg-gas',
    sessionKey: `gen-${entity.id}`,
    label: `Gen ${entity.name}`,
    accentColor: MODULE_COLORS.core,
    onComplete: () => {
      apiFetch<LifecycleRecord[]>(`/api/catalog?catalogId=${entity.catalogId}`)
        .then((records) => loadLifecycle(records))
        .catch(() => {});
    },
  });

  const generate = useCallback(
    (step: GenerationStep) => {
      void cli.execute(
        TaskFactory.generate('arpg-gas', entity, step, getAppOrigin(), `Gen ${entity.name} · ${step}`),
      );
    },
    [cli, entity],
  );

  return { generate, isRunning: cli.isRunning };
}
