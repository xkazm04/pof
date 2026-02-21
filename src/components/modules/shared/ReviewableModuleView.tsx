'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin, UI_TIMEOUTS } from '@/lib/constants';
import type { FeatureRow } from '@/types/feature-matrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { RoadmapChecklist } from './RoadmapChecklist';
import { FeatureMatrix } from './FeatureMatrix';
import { QuickActionsPanel } from './QuickActionsPanel';
import { ContextHealthBadge } from './ContextHealthBadge';
import { RecommendedNextBanner } from './RecommendedNextBanner';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import type { SubModuleId, ChecklistItem, QuickAction } from '@/types/modules';

export interface ExtraTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: (moduleId: SubModuleId) => ReactNode;
}

interface ReviewableModuleViewProps {
  moduleId: SubModuleId;
  moduleLabel: string;
  moduleDescription: string;
  moduleIcon: LucideIcon;
  accentColor: string;
  checklist: ChecklistItem[];
  quickActions: QuickAction[];
  extraTabs?: ExtraTab[];
}

export function ReviewableModuleView({
  moduleId,
  moduleLabel,
  moduleDescription,
  moduleIcon: Icon,
  accentColor,
  checklist,
  quickActions,
  extraTabs = [],
}: ReviewableModuleViewProps) {
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), UI_TIMEOUTS.toast);
    return () => clearTimeout(timer);
  }, [toast]);

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
  checklistRef.current = checklist;

  // Helper: advance to next batch item (shared by onComplete and watchdog)
  const advanceBatch = useCallback(() => {
    setBatchQueue((prev) => {
      if (prev.length === 0) return prev;
      const [nextId, ...rest] = prev;
      const nextItem = checklistRef.current.find((c) => c.id === nextId);
      if (nextItem) {
        setTimeout(() => {
          activeItemIdRef.current = nextId;
          setActiveItemId(nextId);
          const task = TaskFactory.checklist(moduleId, nextId, nextItem.prompt, moduleLabel, appOrigin);
          checklistCliRef.current?.execute(task);
        }, UI_TIMEOUTS.batchItemDelay);
      }
      return rest;
    });
  }, [moduleId, moduleLabel, appOrigin]);

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
  const checklistCliRef = useRef(checklistCli);
  checklistCliRef.current = checklistCli;

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
    setToast({ message: 'Review complete — features updated', type: 'success' });
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
        setToast({ message: err.error ?? `Sync failed (${res.status})`, type: 'error' });
        return;
      }
      const data = await res.json();
      setToast({ message: `Imported ${data.imported} features`, type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to sync review results', type: 'error' });
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

  return (
    <div className="flex h-full relative">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex items-center">
            <Icon className="w-6 h-6" style={{ color: accentColor }} />
            <div className="ml-0.5">
              <ContextHealthBadge />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">{moduleLabel}</h1>
            <p className="text-xs text-text-muted">{moduleDescription}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accentColor={accentColor} />
          <TabButton label="Roadmap" active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accentColor={accentColor} />
          {extraTabs.map((tab) => (
            <TabButton key={tab.id} label={tab.label} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} accentColor={accentColor} />
          ))}
        </div>

        {/* Prerequisite / Recommended Next banner */}
        <RecommendedNextBanner moduleId={moduleId} accentColor={accentColor} />

        {/* Tab content */}
        {activeTab === 'overview' && (
          <FeatureMatrix
            key={reviewRefetchTrigger}
            moduleId={moduleId}
            accentColor={accentColor}
            onReview={startReview}
            onSync={handleSync}
            isReviewing={reviewCli.isRunning}
            onFix={handleFix}
            isFixing={fixCli.isRunning}
            onReviewFeature={handleReviewFeature}
          />
        )}

        {activeTab === 'roadmap' && (
          checklist.length > 0 ? (
            <RoadmapChecklist
              items={checklist}
              subModuleId={moduleId}
              onRunPrompt={sendChecklistPrompt}
              accentColor={accentColor}
              isRunning={checklistCli.isRunning}
              activeItemId={activeItemId}
              lastCompletedItemId={lastCompletedItemId}
              onBatchRun={startBatchRun}
              batchQueue={batchQueue}
            />
          ) : (
            <p className="text-sm text-text-muted">No checklist items defined for this module yet.</p>
          )
        )}

        {extraTabs.map((tab) => (
          activeTab === tab.id ? <div key={tab.id}>{tab.render(moduleId)}</div> : null
        ))}
      </div>

      {/* Quick Actions toggle — fixed on right edge */}
      <button
        onClick={() => setPanelCollapsed(false)}
        className="absolute right-0 top-3 z-20 w-7 h-14 rounded-l-lg bg-surface border border-r-0 border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors shadow-md"
        style={{ display: panelCollapsed ? undefined : 'none' }}
        title="Open Quick Actions"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Backdrop overlay */}
      {!panelCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/40 animate-in fade-in duration-200"
          onClick={() => setPanelCollapsed(true)}
        />
      )}

      {/* Quick Actions slide-over panel */}
      <div
        className={`fixed top-0 right-0 z-40 h-full w-1/2 max-w-[600px] min-w-[320px] bg-surface-deep border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          panelCollapsed ? 'translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accentColor }} />
            <h2 className="text-sm font-semibold text-text">Quick Actions</h2>
            <span className="text-xs text-text-muted">— {moduleLabel}</span>
          </div>
          <button
            onClick={() => setPanelCollapsed(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title="Close panel (Esc)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Panel content */}
        <QuickActionsPanel
          actions={quickActions}
          onRunPrompt={(prompt) => {
            const task = TaskFactory.quickAction(moduleId, prompt, moduleLabel);
            checklistCli.execute(task);
            setPanelCollapsed(true);
          }}
          accentColor={accentColor}
          isRunning={isAnyRunning}
          moduleLabel={moduleLabel}
          moduleId={moduleId}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium shadow-lg border animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-surface border-green-500/30 text-green-400'
              : 'bg-surface border-status-red-strong text-red-400'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: toast.type === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}
          />
          {toast.message}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick, accentColor }: {
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accentColor }}
        />
      )}
    </button>
  );
}
