'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import type { FeatureRow } from '@/types/feature-matrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { RoadmapChecklist } from './RoadmapChecklist';
import { FeatureMatrix } from './FeatureMatrix';
import { QuickActionsPanel } from './QuickActionsPanel';
import { ContextHealthBadge } from './ContextHealthBadge';
import type { SubModuleId, ChecklistItem, QuickAction } from '@/types/modules';

export interface ExtraTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: () => ReactNode;
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

  const allTabIds = ['overview', 'roadmap', ...extraTabs.map((t) => t.id)];
  const [activeTab, setActiveTab] = useState(allTabIds[0]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // --- Checklist CLI session ---
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [lastCompletedItemId, setLastCompletedItemId] = useState<string | null>(null);

  const handleChecklistComplete = useCallback((success: boolean) => {
    if (success && activeItemId) {
      setChecklistItem(moduleId, activeItemId, true);
      setLastCompletedItemId(activeItemId);
      setTimeout(() => setLastCompletedItemId(null), 2000);
    }
    setActiveItemId(null);
  }, [activeItemId, moduleId, setChecklistItem]);

  const checklistCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-cli`,
    label: moduleLabel,
    accentColor,
    onComplete: handleChecklistComplete,
  });

  const sendChecklistPrompt = useCallback(async (itemId: string, prompt: string) => {
    setActiveItemId(itemId);
    const task = TaskFactory.checklist(moduleId, itemId, prompt, moduleLabel);
    checklistCli.execute(task);
  }, [checklistCli, moduleId, moduleLabel]);

  // --- Review CLI session ---
  const [reviewRefetchTrigger, setReviewRefetchTrigger] = useState(0);

  const handleReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    // Claude POSTs results directly to the import API during the session,
    // so by the time this fires the data is already in the DB.
    // Just refresh the UI after a short delay for the DB write to settle.
    await new Promise((r) => setTimeout(r, 300));
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
    const task = TaskFactory.featureFix(moduleId, feature, `${moduleLabel} Fix`);
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
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const task = TaskFactory.featureReview(moduleId, moduleLabel, defs, appOrigin, `${moduleLabel} Review`);
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
            />
          ) : (
            <p className="text-sm text-text-muted">No checklist items defined for this module yet.</p>
          )
        )}

        {extraTabs.map((tab) => (
          activeTab === tab.id ? <div key={tab.id}>{tab.render()}</div> : null
        ))}
      </div>

      {/* Right panel — Quick Actions */}
      <div className="w-56 border-l border-border bg-surface-deep flex-shrink-0">
        <QuickActionsPanel
          actions={quickActions}
          onRunPrompt={(prompt) => {
            const task = TaskFactory.quickAction(moduleId, prompt, moduleLabel);
            checklistCli.execute(task);
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
              : 'bg-surface border-red-500/30 text-red-400'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: toast.type === 'success' ? '#4ade80' : '#f87171' }}
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
