'use client';

import { useCallback, useMemo } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { LifecycleRecord, StoredCatalogEntity } from '@/lib/catalog/types';
import { getRecipe, type GenerationStep } from '@/lib/catalog/recipe';
import { nextGenerationStep } from '@/lib/catalog/generationPlan';
import { useCatalogStore } from '@/stores/catalogStore';
import { getAppOrigin } from '@/lib/constants';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { catalogModule } from '@/lib/catalog/catalog-module';
import { logger } from '@/lib/logger';

const NO_STEPS: readonly GenerationStep[] = [];

export interface UseGenerationResult {
  /** Dispatch `step` (default: {@link nextStep}); a step outside the recipe dispatches nothing. */
  generate: (step?: GenerationStep) => void;
  /**
   * The recipe's next step for the entity's lifecycle (`nextGenerationStep`), or null
   * when none may run (verified, failed, or no recipe) — render no (Re)generate then.
   */
  nextStep: GenerationStep | null;
  isRunning: boolean;
}

/**
 * Drives folder-09 generation for one catalog entity: dispatches a recipe step
 * through the CLI (`TaskFactory.generate`), and once the session's `@@CALLBACK`
 * has recorded its evidence at `/api/catalog` (which persists the DERIVED
 * lifecycle — the one writer), refetches + merges the rows so the catalog's
 * lifecycle cell reflects server truth.
 *
 * Entity-generic since R2: works for any registered catalog (spellbook, items,
 * loot-tables, …). The owning PoF module is derived from `entity.catalogId`; the
 * offered step is derived from the catalog's own recipe, never hand-copied.
 */
export function useGeneration(entity: StoredCatalogEntity): UseGenerationResult {
  const loadLifecycle = useCatalogStore((s) => s.loadLifecycle);
  const moduleId = catalogModule(entity.catalogId);
  const steps = getRecipe(entity.catalogId)?.steps ?? NO_STEPS;
  const nextStep = useMemo(() => nextGenerationStep(steps, entity.lifecycle), [steps, entity.lifecycle]);

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
    (requested?: GenerationStep) => {
      const step = requested ?? nextStep;
      if (!step || !steps.includes(step)) {
        logger.warn(`[useGeneration] refused step "${step ?? 'none'}" for ${entity.catalogId}/${entity.id}: not a step of its recipe (${steps.join(', ') || 'no recipe'}).`);
        return;
      }
      void cli.execute(
        TaskFactory.generate(moduleId, entity, step, getAppOrigin(), `Gen ${entity.name} · ${step}`),
      );
    },
    [cli, entity, moduleId, nextStep, steps],
  );

  return { generate, nextStep, isRunning: cli.isRunning };
}
