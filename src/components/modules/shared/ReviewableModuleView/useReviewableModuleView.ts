'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin, UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type { FeatureRow } from '@/types/feature-matrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import type { SubModuleId, ChecklistItem } from '@/types/modules';
import type { ExtraTab } from './types';

export function useReviewableModuleView({
  moduleId,
  moduleLabel,
  accentColor,
  checklist,
  extraTabs,
}: {
  moduleId: SubModuleId;
  moduleLabel: string;
  accentColor: string;
  checklist: ChecklistItem[];
  extraTabs: ExtraTab[];
}) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);
  const panelCollapsed = useModuleStore((s) => s.quickActionsPanelCollapsed);
  const setPanelCollapsed = useModuleStore((s) => s.setQuickActionsPanelCollapsed);

  // Close panel on Escape key
  useEffect(() => {
    if (panelCollapsed) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelCollapsed(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [panelCollapsed, setPanelCollapsed]);

  const allTabIds = ['overview', 'roadmap', ...extraTabs.map((t) => t.id)];
  const [activeTab, setActiveTab] = useState(allTabIds[0]);

  // Listen for suggested-action tab navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab && allTabIds.includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('pof-navigate-tab', handler);
    return () => window.removeEventListener('pof-navigate-tab', handler);
  }, [allTabIds]);

  // --- Checklist CLI session ---
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [lastCompletedItemId, setLastCompletedItemId] = useState<string | null>(null);
  const [batchQueue, setBatchQueue] = useState<string[]>([]);

  const appOrigin = getAppOrigin();

  // Refs for reliable access in callbacks (avoids stale closures)
  const activeItemIdRef = useRef<string | null>(null);
  const checklistRef = useRef(checklist);
  const batchQueueRef = useRef(batchQueue);
  useEffect(() => { checklistRef.current = checklist; }, [checklist]);
  useEffect(() => { batchQueueRef.current = batchQueue; }, [batchQueue]);

  // Helper: advance to next batch item (shared by onComplete and watchdog).
  // Reads from batchQueueRef to avoid stale closures, then performs a pure
  // state update followed by a separate side-effect (setTimeout).
  //
  // The timer is self-rescheduling, not a one-shot: each dispatched item's
  // completion calls back into advanceBatch, so the chain re-enters until an
  // exit fires — and each exit says why:
  //   • queue drained   — the batch finished normally
  //   • item not in the checklist — skipped; the watchdog below re-advances, so
  //     the drain continues rather than stalling
  //   • hook unmounted  — LRU eviction destroys the queue and progress UI, so a
  //     further tick would dispatch a paid CLI run nobody can observe
  // Deliberately NOT suspended when the module is hidden: a batch run the user
  // started is a paid, multi-minute CLI job and must survive navigation (same
  // reasoning as the forge poll in visual-gen/asset-forge/useForgeStore.ts).
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceBatch = useCallback(() => {
    const queue = batchQueueRef.current;
    if (queue.length === 0) {
      logger.info(`[${moduleId}] batch run ended: queue drained`);
      return;
    }

    const [nextId, ...rest] = queue;
    setBatchQueue(rest);

    const nextItem = checklistRef.current.find((c) => c.id === nextId);
    if (!nextItem) {
      logger.warn(`[${moduleId}] batch run skipped "${nextId}": no such checklist item — the watchdog will advance to the next`);
      return;
    }

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      activeItemIdRef.current = nextId;
      setActiveItemId(nextId);
      const task = TaskFactory.checklist(moduleId, nextId, nextItem.prompt, moduleLabel, appOrigin);
      checklistCliRef.current?.execute(task);
    }, UI_TIMEOUTS.batchItemDelay);
  }, [moduleId, moduleLabel, appOrigin]);

  // An unmount is a terminal condition for the chain, and a stated one.
  useEffect(() => () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
      logger.info(`[${moduleId}] batch run chain stopped: view unmounted with items still queued`);
    }
  }, [moduleId]);

  const handleChecklistComplete = useCallback((success: boolean) => {
    const completedId = activeItemIdRef.current;

    if (success && completedId) {
      setChecklistItem(moduleId, completedId, true);
      setLastCompletedItemId(completedId);
      setTimeout(() => setLastCompletedItemId(null), UI_TIMEOUTS.completionFlash);
    }

    activeItemIdRef.current = null;
    setActiveItemId(null);

    // Always advance to next item in batch queue (even on failure — skip & continue)
    advanceBatch();
  }, [moduleId, setChecklistItem, advanceBatch]);

  const checklistCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-cli`,
    label: moduleLabel,
    accentColor,
    onComplete: handleChecklistComplete,
  });

  // Keep a ref so callbacks can access the latest CLI handle
  type ChecklistCliHandle = typeof checklistCli;
  const checklistCliRef = useRef<ChecklistCliHandle>(checklistCli);

  // Watchdog: recover from stuck batch states.
  // If the queue has items but nothing is running and no active item, auto-advance.
  useEffect(() => {
    if (batchQueue.length === 0) return;
    if (activeItemId !== null) return;
    if (checklistCli.isRunning) return;

    const timer = setTimeout(() => {
      if (activeItemIdRef.current !== null) return;
      advanceBatch();
    }, UI_TIMEOUTS.batchWatchdog);

    return () => clearTimeout(timer);
  }, [batchQueue.length, activeItemId, checklistCli.isRunning, advanceBatch]);

  // Poll for CLI-driven checklist completions — pauses when module is suspended.
  // The CLI POSTs to /api/checklist/complete — this polls the DB and syncs to the store.
  useSuspendableEffect(() => {
    const isActive = checklistCli.isRunning || batchQueue.length > 0 || activeItemId !== null;
    if (!isActive || !projectPath) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/project-progress?path=${encodeURIComponent(projectPath)}`);
        if (!res.ok) return;
        const json = await res.json();
        const serverProgress: Record<string, boolean> = json.data?.checklistProgress?.[moduleId] ?? {};
        const current = useModuleStore.getState().checklistProgress[moduleId] ?? {};

        for (const [itemId, done] of Object.entries(serverProgress)) {
          if (done && !current[itemId]) {
            setChecklistItem(moduleId, itemId, true);
            setLastCompletedItemId(itemId);
            setTimeout(() => setLastCompletedItemId(null), UI_TIMEOUTS.completionFlash);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(poll, UI_TIMEOUTS.pollInterval);
    return () => clearInterval(interval);
  }, [checklistCli.isRunning, batchQueue.length, activeItemId, projectPath, moduleId, setChecklistItem]);

  const sendChecklistPrompt = useCallback(async (itemId: string, prompt: string) => {
    activeItemIdRef.current = itemId;
    setActiveItemId(itemId);
    const task = TaskFactory.checklist(moduleId, itemId, prompt, moduleLabel, appOrigin);
    checklistCli.execute(task);
  }, [checklistCli, moduleId, moduleLabel, appOrigin]);

  const startBatchRun = useCallback((itemIds: string[]) => {
    if (itemIds.length === 0) return;
    const [firstId, ...rest] = itemIds;
    const firstItem = checklist.find((c) => c.id === firstId);
    if (!firstItem) return;
    setBatchQueue(rest);
    activeItemIdRef.current = firstId;
    setActiveItemId(firstId);
    const task = TaskFactory.checklist(moduleId, firstId, firstItem.prompt, moduleLabel, appOrigin);
    checklistCli.execute(task);
  }, [checklist, moduleId, moduleLabel, checklistCli, appOrigin]);

  // --- Review CLI session ---
  const [reviewRefetchTrigger, setReviewRefetchTrigger] = useState(0);

  const handleReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    // Claude POSTs results directly to the import API during the session,
    // so by the time this fires the data is already in the DB.
    // Just refresh the UI after a short delay for the DB write to settle.
    await new Promise((r) => setTimeout(r, UI_TIMEOUTS.dbSettle));
    setReviewRefetchTrigger((n) => n + 1);
    toast.success('Review complete — features updated');
  }, []);

  const reviewCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-review`,
    label: `${moduleLabel} Review`,
    accentColor,
    onComplete: handleReviewComplete,
  });

  // --- Fix CLI session ---
  const fixCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-fix`,
    label: `${moduleLabel} Fix`,
    accentColor,
  });

  const handleFix = useCallback(async (feature: FeatureRow) => {
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
        toast.error(err.error ?? `Sync failed (${res.status})`);
        return;
      }
      const data = await res.json();
      toast.success(`Imported ${data.imported} features`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync review results');
    }
  }, [moduleId, projectPath]);

  const startReview = useCallback(async () => {
    const defs = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
    if (defs.length === 0) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureReview(moduleId, moduleLabel, defs, appOrigin, `${moduleLabel} Review`);
    reviewCli.execute(task);
  }, [moduleId, moduleLabel, reviewCli]);

  const handleReviewFeature = useCallback(async (feature: FeatureRow) => {
    const defs = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
    const featureDef = defs.find((d) => d.featureName === feature.featureName);
    if (!featureDef) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureReview(moduleId, moduleLabel, [featureDef], appOrigin, `Review: ${feature.featureName}`);
    reviewCli.execute(task);
  }, [moduleId, moduleLabel, reviewCli]);

  const isAnyRunning = checklistCli.isRunning || reviewCli.isRunning || fixCli.isRunning;

  return {
    activeTab,
    setActiveTab,
    activeItemId,
    lastCompletedItemId,
    batchQueue,
    panelCollapsed,
    setPanelCollapsed,
    reviewRefetchTrigger,
    checklistCli,
    reviewCli,
    fixCli,
    sendChecklistPrompt,
    startBatchRun,
    startReview,
    handleSync,
    handleFix,
    handleReviewFeature,
    isAnyRunning,
  };
}
