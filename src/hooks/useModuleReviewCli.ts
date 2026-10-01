'use client';

import { useState, useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI, type UseChecklistCLIResult } from '@/hooks/useChecklistCLI';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { getAppOrigin, UI_TIMEOUTS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import { deltaToastType, summarizeDelta } from '@/lib/feature-review-delta';
import type { ReviewDelta } from '@/lib/feature-review-delta';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

/** Toast presentation is left to the caller — the hook only decides WHAT to say. */
export type ModuleReviewToastType = 'success' | 'error' | 'warning';
export type ModuleReviewToast = (message: string, type: ModuleReviewToastType) => void;

interface UseModuleReviewCliOptions {
  /** Module this review session belongs to (drives session keys + feature defs). */
  moduleId: SubModuleId;
  /** Human label used in terminal tabs and task labels (e.g. "Audio", "Level Design"). */
  moduleLabel: string;
  /** Accent color for the spawned CLI terminal tabs. */
  accentColor: string;
  /**
   * Called to surface a result message. The view decides how to render it.
   * Declared as a METHOD (bivariant parameters) so a view whose handler predates
   * 'warning' still type-checks: such a view renders it through its non-success
   * branch (the error style), so a regression is never shown as a success.
   */
  onToast(message: string, type: ModuleReviewToastType): void;
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
 * Encapsulates the four CLI sessions (review / fix / checklist) plus the manual
 * /api/feature-matrix/import sync and the refetch counter. A finished review does
 * NOT import: its callback already POSTed the rows (the prompt forbids writing the
 * disk file a disk-mode import would read), so completion only refetches and says
 * what the review moved. Toast PRESENTATION
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

  // The review's callback already wrote the rows (POST /api/feature-matrix/import,
  // direct mode). Let the write settle, refetch, then report WHICH features the
  // review moved — the history route's per-feature delta of the newest snapshots.
  const handleReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    await new Promise((r) => setTimeout(r, UI_TIMEOUTS.dbSettle));
    setRefetchKey((n) => n + 1);
    const project = projectPath ? `&projectId=${encodeURIComponent(projectPath)}` : '';
    const result = await tryApiFetch<{ delta?: ReviewDelta }>(
      `/api/feature-matrix/history?moduleId=${encodeURIComponent(moduleId)}&limit=2${project}`,
    );
    if (!result.ok || !result.data.delta) {
      onToast(`Review complete — could not read what it changed${result.ok ? '' : `: ${result.error}`}`, 'warning');
      return;
    }
    const { delta } = result.data;
    onToast(`Review complete — ${summarizeDelta(delta)}`, deltaToastType(delta));
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
