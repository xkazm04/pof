'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import { Z_INDEX } from '@/lib/constants';
import { RoadmapChecklist } from '../RoadmapChecklist';
import { FeatureMatrix } from '../FeatureMatrix';
import { QuickActionsPanel } from '../QuickActionsPanel';
import { ContextHealthBadge } from '../ContextHealthBadge';
import { RecommendedNextBanner } from '../RecommendedNextBanner';
import { TabButton } from './TabButton';
import { useReviewableModuleView } from './useReviewableModuleView';
import type { ReviewableModuleViewProps } from './types';

export type { ExtraTab, ReviewableModuleViewProps } from './types';

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
  const {
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
  } = useReviewableModuleView({ moduleId, moduleLabel, accentColor, checklist, extraTabs });

  // Focus handoff for the Quick Actions slide-over. The opener button is
  // `display:none` while the panel is open, so without this the browser drops
  // focus to <body> on open and there is nothing to return to on close.
  // `null` seeds the ref so the initial render (the panel may be persisted open)
  // never steals focus — only genuine open/close transitions move it.
  const closePanelRef = useRef<HTMLButtonElement>(null);
  const openPanelRef = useRef<HTMLButtonElement>(null);
  const wasPanelOpenRef = useRef<boolean | null>(null);

  useEffect(() => {
    const isOpen = !panelCollapsed;
    if (wasPanelOpenRef.current === null) {
      wasPanelOpenRef.current = isOpen;
      return;
    }
    if (wasPanelOpenRef.current === isOpen) return;
    wasPanelOpenRef.current = isOpen;
    if (isOpen) closePanelRef.current?.focus();
    else openPanelRef.current?.focus();
  }, [panelCollapsed]);

  return (
    <div data-testid={`pof-module-${moduleId}`} className="flex h-full relative">
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
        <div className="flex items-center gap-1 mb-5 border-b border-border" role="tablist" aria-label={`${moduleLabel} sections`}>
          <TabButton id="overview" label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accentColor={accentColor} />
          <TabButton id="roadmap" label="Roadmap" active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accentColor={accentColor} />
          {extraTabs.map((tab) => (
            <TabButton key={tab.id} id={tab.id} label={tab.label} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} accentColor={accentColor} />
          ))}
        </div>

        {/* Prerequisite / Recommended Next banner */}
        <RecommendedNextBanner moduleId={moduleId} accentColor={accentColor} />

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
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
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div role="tabpanel" id="tabpanel-roadmap" aria-labelledby="tab-roadmap">
          {checklist.length > 0 ? (
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
          )}
          </div>
        )}

        {extraTabs.map((tab) => (
          activeTab === tab.id ? <div key={tab.id} role="tabpanel" id={`tabpanel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} className="flex flex-col" style={{ minHeight: 'calc(100vh - 180px)' }}>{tab.render(moduleId)}</div> : null
        ))}
      </div>

      {/* Quick Actions toggle — fixed on right edge */}
      <button
        ref={openPanelRef}
        type="button"
        onClick={() => setPanelCollapsed(false)}
        className="absolute right-0 top-3 w-7 h-14 rounded-l-lg bg-surface border border-r-0 border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors shadow-md"
        style={{ zIndex: Z_INDEX.overlay, display: panelCollapsed ? undefined : 'none' }}
        title="Open Quick Actions"
        aria-label="Open Quick Actions"
        aria-expanded={!panelCollapsed}
      >
        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {/* Backdrop overlay — decorative click-catcher; Escape closes for keyboard users */}
      {!panelCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 animate-in fade-in duration-200"
          style={{ zIndex: Z_INDEX.backdrop }}
          onClick={() => setPanelCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Quick Actions slide-over panel.
          Stays mounted for the slide transition, so while collapsed it must be
          `inert` — otherwise its buttons and prompt input stay in the tab order
          and the accessibility tree despite being translated off-screen. */}
      <div
        role="dialog"
        aria-modal={!panelCollapsed}
        aria-label={`Quick Actions — ${moduleLabel}`}
        inert={panelCollapsed}
        className={`fixed top-0 right-0 h-full w-1/2 max-w-[600px] min-w-[320px] bg-surface-deep border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          panelCollapsed ? 'translate-x-full' : 'translate-x-0'
        }`}
        style={{ zIndex: Z_INDEX.panel }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text">Quick Actions</h2>
            <span className="text-xs text-text-muted">— {moduleLabel}</span>
          </div>
          <button
            ref={closePanelRef}
            type="button"
            onClick={() => setPanelCollapsed(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title="Close panel (Esc)"
            aria-label="Close Quick Actions panel"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
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

    </div>
  );
}
