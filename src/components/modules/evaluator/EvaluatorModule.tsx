'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { Radar, BarChart3, Activity, Link2, LayoutDashboard, ScanSearch, Grid3x3, FileText, ShoppingBag, BookOpen, Coins, Gauge, Swords, Globe, Bug, HeartPulse, Palette, Dna, ShieldCheck, Network, Layers, Calendar, CalendarDays, ChevronLeft, ChevronRight, GitBranch, Pickaxe, SearchCode, Stars, Hammer, Sparkles, Wallet } from 'lucide-react';
import { SessionAnalyticsDashboard } from './SessionAnalyticsDashboard';
import { SpendDashboard } from './SpendDashboard';
import { AggregateQualityDashboard } from './AggregateQualityDashboard';
import { CrossModuleFeatureDashboard } from './CrossModuleFeatureDashboard';
import { DependencyGraph } from './DependencyGraph';
import { ProjectHealthDashboard } from './ProjectHealthDashboard';
import { UnifiedSummaryView } from './UnifiedSummaryView';
import { DeepEvalResults } from './DeepEvalResults';
import { BatchReviewPanel } from './BatchReviewPanel';
import { GameDesignDocView } from './GameDesignDocView';
import { AssetScoutView } from './AssetScoutView';
import { PatternLibraryView } from './PatternLibraryView';
import { EconomySimulatorView } from './EconomySimulatorView';
import { PerformanceProfilingView } from './PerformanceProfilingView';
import { CombatSimulatorView } from './CombatSimulatorView';
import { LocalizationPipelineView } from './LocalizationPipelineView';
import { CrashAnalyzerView } from './CrashAnalyzerView';
import { HolisticHealthView } from './HolisticHealthView';
import { PostProcessStudioView } from './PostProcessStudioView';
import { PromptEvolutionView } from './PromptEvolutionView';
import { GDDComplianceView } from './GDDComplianceView';
import { NexusView } from './NexusView';
import { FeatureConstellation } from './FeatureConstellation';
import { CrossModuleOverlapPanel } from './CrossModuleOverlapPanel';
import { WeeklyDigestView } from './WeeklyDigestView';
import { ProjectWrappedView } from './ProjectWrappedView';
import { CalendarRoadmapView } from './CalendarRoadmapView';
import { WorkflowOrchestratorView } from './WorkflowOrchestratorView';
import { CodebaseArcheologistView } from './CodebaseArcheologistView';
import { AssetCodeOracleView } from './AssetCodeOracleView';
import { ErrorMemoryPanel } from './ErrorMemoryPanel';
import { BuildHealthDashboard } from './BuildHealthDashboard';
import { EvaluatorCoachmark } from './EvaluatorCoachmark';
import { Tooltip } from '@/components/ui/Tooltip';
import { EVALUATOR_TAB_INFO, type EvaluatorTabId } from '@/lib/evaluator/tab-glossary';

type TabId = EvaluatorTabId;

export function EvaluatorModule() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const tabBarRef = useRef<HTMLDivElement>(null);
  const { scrollRef, captureScroll } = useScrollRestoration(activeTab);

  const switchTab = useCallback((tab: TabId) => {
    captureScroll();
    setActiveTab(tab);
  }, [captureScroll]);

  const handleTabArrowNav = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const tabs = tabBarRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    if (!tabs || tabs.length === 0) return;
    const idx = Array.from(tabs).indexOf(e.currentTarget);
    const next = e.key === 'ArrowRight'
      ? tabs[(idx + 1) % tabs.length]
      : tabs[(idx - 1 + tabs.length) % tabs.length];
    next?.focus();
    next?.click();
  }, []);

  return (
    <div data-testid="pof-module-evaluator" className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <Radar className="w-6 h-6" style={{ color: MODULE_COLORS.evaluator }} />
          <h1 className="text-lg font-semibold text-text">Project Evaluator</h1>
        </div>

        {/* Tab bar with scroll overflow handling */}
        <ScrollableTabBar tabBarRef={tabBarRef}>
          {/* ── Analysis ── */}
          <TabButton tabId="overview" icon={LayoutDashboard} active={activeTab === 'overview'} onClick={() => switchTab('overview')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="nexus" icon={Network} active={activeTab === 'nexus'} onClick={() => switchTab('nexus')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="constellation" icon={Stars} active={activeTab === 'constellation'} onClick={() => switchTab('constellation')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="deep-eval" icon={ScanSearch} active={activeTab === 'deep-eval'} onClick={() => switchTab('deep-eval')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="features" icon={Grid3x3} active={activeTab === 'features'} onClick={() => switchTab('features')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="conflicts" icon={Layers} active={activeTab === 'conflicts'} onClick={() => switchTab('conflicts')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="dependencies" icon={Link2} active={activeTab === 'dependencies'} onClick={() => switchTab('dependencies')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="analytics" icon={BarChart3} active={activeTab === 'analytics'} onClick={() => switchTab('analytics')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="spend" icon={Wallet} active={activeTab === 'spend'} onClick={() => switchTab('spend')} onArrowNav={handleTabArrowNav} />

          <TabDivider label="Quality" />
          <TabButton tabId="quality" icon={Activity} active={activeTab === 'quality'} onClick={() => switchTab('quality')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="scanner" icon={Radar} active={activeTab === 'scanner'} onClick={() => switchTab('scanner')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="compliance" icon={ShieldCheck} active={activeTab === 'compliance'} onClick={() => switchTab('compliance')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="health" icon={HeartPulse} active={activeTab === 'health'} onClick={() => switchTab('health')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="build-health" icon={Hammer} active={activeTab === 'build-health'} onClick={() => switchTab('build-health')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="archeologist" icon={Pickaxe} active={activeTab === 'archeologist'} onClick={() => switchTab('archeologist')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="oracle" icon={SearchCode} active={activeTab === 'oracle'} onClick={() => switchTab('oracle')} onArrowNav={handleTabArrowNav} />

          <TabDivider label="Simulation" />
          <TabButton tabId="economy" icon={Coins} active={activeTab === 'economy'} onClick={() => switchTab('economy')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="combat" icon={Swords} active={activeTab === 'combat'} onClick={() => switchTab('combat')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="perf" icon={Gauge} active={activeTab === 'perf'} onClick={() => switchTab('perf')} onArrowNav={handleTabArrowNav} />

          <TabDivider label="Pipeline" />
          <TabButton tabId="gdd" icon={FileText} active={activeTab === 'gdd'} onClick={() => switchTab('gdd')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="asset-scout" icon={ShoppingBag} active={activeTab === 'asset-scout'} onClick={() => switchTab('asset-scout')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="patterns" icon={BookOpen} active={activeTab === 'patterns'} onClick={() => switchTab('patterns')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="i18n" icon={Globe} active={activeTab === 'i18n'} onClick={() => switchTab('i18n')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="crashes" icon={Bug} active={activeTab === 'crashes'} onClick={() => switchTab('crashes')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="pp-studio" icon={Palette} active={activeTab === 'pp-studio'} onClick={() => switchTab('pp-studio')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="workflows" icon={GitBranch} active={activeTab === 'workflows'} onClick={() => switchTab('workflows')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="roadmap" icon={CalendarDays} active={activeTab === 'roadmap'} onClick={() => switchTab('roadmap')} onArrowNav={handleTabArrowNav} />

          <TabDivider label="Intelligence" />
          <TabButton tabId="evolution" icon={Dna} active={activeTab === 'evolution'} onClick={() => switchTab('evolution')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="digest" icon={Calendar} active={activeTab === 'digest'} onClick={() => switchTab('digest')} onArrowNav={handleTabArrowNav} />
          <TabButton tabId="wrapped" icon={Sparkles} active={activeTab === 'wrapped'} onClick={() => switchTab('wrapped')} onArrowNav={handleTabArrowNav} />
        </ScrollableTabBar>

        {/* Plain-language layer: first-run coachmark + always-on description of the active tab */}
        <div className="pt-3 pb-1 space-y-2">
          <EvaluatorCoachmark />
          <p className="text-xs text-text-muted" aria-live="polite" data-testid="evaluator-active-tab-desc">
            <span className="font-medium text-text">{EVALUATOR_TAB_INFO[activeTab].plain}</span>
            {' — '}
            {EVALUATOR_TAB_INFO[activeTab].description}
          </p>
        </div>
      </div>

      {/* Tab content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'overview' && (
          <UnifiedSummaryView onNavigateTab={switchTab} />
        )}

        {activeTab === 'nexus' && (
          <NexusView />
        )}

        {activeTab === 'constellation' && (
          <FeatureConstellation />
        )}

        {activeTab === 'deep-eval' && (
          <DeepEvalResults />
        )}

        {activeTab === 'features' && (
          <CrossModuleFeatureDashboard />
        )}

        {activeTab === 'conflicts' && (
          <CrossModuleOverlapPanel />
        )}

        {activeTab === 'quality' && (
          <AggregateQualityDashboard />
        )}

        {activeTab === 'dependencies' && (
          <DependencyGraph onNavigateTab={(t) => switchTab(t as TabId)} />
        )}

        {activeTab === 'analytics' && (
          <SessionAnalyticsDashboard onNavigateTab={(t) => switchTab(t as TabId)} />
        )}

        {activeTab === 'spend' && (
          <SpendDashboard />
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <BatchReviewPanel />
            <ErrorMemoryPanel />
            <div className="border-t border-border pt-6">
              <ProjectHealthDashboard onNavigateTab={(t) => switchTab(t as TabId)} />
            </div>
          </div>
        )}

        {activeTab === 'archeologist' && (
          <CodebaseArcheologistView />
        )}

        {activeTab === 'oracle' && (
          <AssetCodeOracleView />
        )}

        {activeTab === 'gdd' && (
          <GameDesignDocView />
        )}

        {activeTab === 'compliance' && (
          <GDDComplianceView />
        )}

        {activeTab === 'asset-scout' && (
          <AssetScoutView />
        )}

        {activeTab === 'patterns' && (
          <PatternLibraryView />
        )}

        {activeTab === 'economy' && (
          <EconomySimulatorView />
        )}

        {activeTab === 'perf' && (
          <PerformanceProfilingView />
        )}

        {activeTab === 'combat' && (
          <CombatSimulatorView />
        )}

        {activeTab === 'i18n' && (
          <LocalizationPipelineView />
        )}

        {activeTab === 'crashes' && (
          <CrashAnalyzerView />
        )}

        {activeTab === 'health' && (
          <HolisticHealthView onNavigateTab={(t) => switchTab(t as TabId)} />
        )}

        {activeTab === 'build-health' && (
          <BuildHealthDashboard />
        )}

        {activeTab === 'pp-studio' && (
          <PostProcessStudioView />
        )}

        {activeTab === 'evolution' && (
          <PromptEvolutionView />
        )}

        {activeTab === 'digest' && (
          <WeeklyDigestView />
        )}

        {activeTab === 'wrapped' && (
          <ProjectWrappedView />
        )}

        {activeTab === 'workflows' && (
          <WorkflowOrchestratorView />
        )}

        {activeTab === 'roadmap' && (
          <CalendarRoadmapView />
        )}
      </div>
    </div>
  );
}

function TabDivider({ label }: { label?: string } = {}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 mx-1" aria-hidden="true">
      <div className="w-px h-4 bg-border" />
      {label && (
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium whitespace-nowrap pr-0.5">
          {label}
        </span>
      )}
    </div>
  );
}

function ScrollableTabBar({ children, tabBarRef }: { children: React.ReactNode; tabBarRef: React.RefObject<HTMLDivElement | null> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative border-b border-border">
      {/* Left fade + chevron */}
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--background), transparent)' }} />
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 flex items-center px-0.5 text-text-muted hover:text-text transition-colors"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Scrollable tab container */}
      <div
        ref={(node) => {
          scrollRef.current = node;
          if (tabBarRef) {
            const mutableTabBarRef = tabBarRef as React.MutableRefObject<HTMLDivElement | null>;
            mutableTabBarRef.current = node;
          }
        }}
        role="tablist"
        aria-label="Evaluator tabs"
        className="flex items-center gap-1 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>

      {/* Right fade + chevron */}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--background), transparent)' }} />
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 flex items-center px-0.5 text-text-muted hover:text-text transition-colors"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function TabButton({
  tabId,
  icon: Icon,
  active,
  onClick,
  onArrowNav,
}: {
  tabId: TabId;
  icon: typeof Radar;
  active: boolean;
  onClick: () => void;
  onArrowNav?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  // Label, plain alias, and description all come from the single glossary so the
  // chip text, its tooltip, and the subtitle never drift apart.
  const info = EVALUATOR_TAB_INFO[tabId];
  return (
    <Tooltip content={`${info.plain} — ${info.description}`} multiline placement="bottom">
      <button
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        onClick={onClick}
        onKeyDown={onArrowNav}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
          active ? 'text-text' : 'text-text-muted hover:text-text'
        }`}
      >
        <Icon className="w-3 h-3" />
        {info.label}
        {active && (
          <span
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
            style={{ backgroundColor: MODULE_COLORS.evaluator }}
          />
        )}
      </button>
    </Tooltip>
  );
}
