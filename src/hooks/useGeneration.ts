'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { LifecycleRecord, StoredCatalogEntity } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import { useCatalogStore } from '@/stores/catalogStore';
import { getAppOrigin } from '@/lib/constants';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { catalogModule } from '@/lib/catalog/catalog-module';

export interface UseGenerationResult {
  generate: (step: GenerationStep) => void;
  isRunning: boolean;
}

/**
 * Drives folder-09 generation for one catalog entity: dispatches a recipe step
 * through the CLI (`TaskFactory.generate`), and once the session's `@@CALLBACK`
 * has persisted the lifecycle transition to `/api/catalog`, refetches + merges
 * it so the catalog's lifecycle cell reflects server truth.
 *
 * Entity-generic since R2: works for any registered catalog (spellbook, items,
 * loot-tables, …). The owning PoF module is derived from `entity.catalogId`.
 */
export function useGeneration(entity: StoredCatalogEntity): UseGenerationResult {
  const loadLifecycle = useCatalogStore((s) => s.loadLifecycle);
  const moduleId = catalogModule(entity.catalogId);

  const cli = useModuleCLI({
    moduleId,
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
        TaskFactory.generate(moduleId, entity, step, getAppOrigin(), `Gen ${entity.name} · ${step}`),
      );
    },
    [cli, entity, moduleId],
  );

  return { generate, isRunning: cli.isRunning };
}
