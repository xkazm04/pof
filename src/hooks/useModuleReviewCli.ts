'use client';

import { useState, useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI, type UseChecklistCLIResult } from '@/hooks/useChecklistCLI';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { getAppOrigin } from '@/lib/constants';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

/** Toast presentation is left to the caller — the hook only decides WHAT to say. */
export type ModuleReviewToast = (message: string, type: 'success' | 'error') => void;

interface UseModuleReviewCliOptions {
  /** Module this review session belongs to (drives session keys + feature defs). */
  moduleId: SubModuleId;
  /** Human label used in terminal tabs and task labels (e.g. "Audio", "Level Design"). */
  moduleLabel: string;
  /** Accent color for the spawned CLI terminal tabs. */
  accentColor: string;
  /** Called to surface a result message. The view decides how to render it. */
  onToast: ModuleReviewToast;
}

export interface UseModuleReviewCliResult {
  /** Bump this on the FeatureMatrix `key` to force a refetch after an import. */
  refetchKey: number;
  /** Last checklist item id completed (drives the completion-flash highlight). */
  lastCompletedId: string | null;
  /** Roadmap checklist CLI session (`-rv-cli`). */
  checklistCli: UseChecklistCLIResult;
  /** True while the feature-review CLI session is running. */
  isReviewing: boolean;
  /** True while the feature-fix CLI session is running. */
  isFixing: boolean;
  /** Kick off a full module feature review. */
  startReview: () => void;
  /** Run a fix for a single feature row. */
  handleFix: (feature: FeatureRow) => void;
  /** Manually re-import the feature matrix from the latest review artifacts. */
  handleSync: () => Promise<void>;
}

/**
 * Shared "module feature-review" harness extracted from the multi-tab content
 * views (AudioView, LevelDesignView) that cannot use ReviewableModuleView.
 *
 * Encapsulates the four CLI sessions (review / fix / checklist) plus the
 * /api/feature-matrix/import flow and the refetch counter. Toast PRESENTATION
 * is intentionally NOT owned here — callers pass `onToast(message, type)` so
 * each view keeps its own mechanism (inline JSX vs sonner) while the messages,
 * session keys, request bodies, timings, and error strings stay identical.
 */
export function useModuleReviewCli(
  opts: UseModuleReviewCliOptions,
): UseModuleReviewCliResult {
  const { moduleId, moduleLabel, accentColor, onToast } = opts;
  const projectPath = useProjectStore((s) => s.projectPath);

  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const handleItemCompleted = useCallback((itemId: string) => {
    setLastCompletedId(itemId);
    setTimeout(() => setLastCompletedId(null), 2000);
  }, []);

  const checklistCli = useChecklistCLI({
    moduleId,
    sessionKey: `${moduleId}-rv-cli`,
    label: moduleLabel,
    accentColor,
    onItemCompleted: handleItemCompleted,
  });

  const handleReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, projectPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }));
        onToast(err.error ?? `Import failed (${res.status})`, 'error');
        return;
      }
      const data = await res.json();
      onToast(`Imported ${data.imported} features`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to import review results', 'error');
      return;
    }
    setRefetchKey((n) => n + 1);
  }, [moduleId, projectPath, onToast]);

  const reviewCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-rv-review`,
    label: `${moduleLabel} Review`,
    accentColor,
    onComplete: handleReviewComplete,
  });

  const fixCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-rv-fix`,
    label: `${moduleLabel} Fix`,
    accentColor,
  });

  const handleFix = useCallback((feature: FeatureRow) => {
    if (!feature.nextSteps) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureFix(moduleId, feature, `${moduleLabel} Fix`, appOrigin);
    fixCli.execute(task);
  }, [fixCli, moduleId, moduleLabel]);

  const handleSync = useCallback(async () => {
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, projectPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Sync failed' }));
        onToast(err.error ?? `Sync failed (${res.status})`, 'error');
        return;
      }
      const data = await res.json();
      onToast(`Imported ${data.imported} features`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to sync', 'error');
    }
  }, [moduleId, projectPath, onToast]);

  const startReview = useCallback(() => {
    const defs = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
    if (defs.length === 0) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureReview(moduleId, moduleLabel, defs, appOrigin, `${moduleLabel} Review`);
    reviewCli.execute(task);
  }, [reviewCli, moduleId, moduleLabel]);

  return {
    refetchKey,
    lastCompletedId,
    checklistCli,
    isReviewing: reviewCli.isRunning,
    isFixing: fixCli.isRunning,
    startReview,
    handleFix,
    handleSync,
  };
}
