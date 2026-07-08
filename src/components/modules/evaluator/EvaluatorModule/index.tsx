'use client';

import { useState, useCallback, useRef } from 'react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { Radar, BarChart3, Activity, Link2, LayoutDashboard, ScanSearch, Grid3x3, FileText, ShoppingBag, BookOpen, Coins, Gauge, Swords, Globe, Bug, HeartPulse, Palette, Dna, ShieldCheck, Network, Layers, Calendar, CalendarDays, GitBranch, Pickaxe, SearchCode, Stars, Hammer, Sparkles, Wallet } from 'lucide-react';
import { SessionAnalyticsDashboard } from '../SessionAnalyticsDashboard';
import { SpendDashboard } from '../SpendDashboard';
import { AggregateQualityDashboard } from '../AggregateQualityDashboard';
import { CrossModuleFeatureDashboard } from '../CrossModuleFeatureDashboard';
import { DependencyGraph } from '../DependencyGraph';
import { ProjectHealthDashboard } from '../ProjectHealthDashboard';
import { UnifiedSummaryView } from '../UnifiedSummaryView';
import { DeepEvalResults } from '../DeepEvalResults';
import { BatchReviewPanel } from '../BatchReviewPanel';
import { GameDesignDocView } from '../GameDesignDocView';
import { AssetScoutView } from '../AssetScoutView';
import { PatternLibraryView } from '../PatternLibraryView';
import { EconomySimulatorView } from '../EconomySimulatorView';
import { PerformanceProfilingView } from '../PerformanceProfilingView';
import { CombatSimulatorView } from '../CombatSimulatorView';
import { LocalizationPipelineView } from '../LocalizationPipelineView';
import { CrashAnalyzerView } from '../CrashAnalyzerView';
import { HolisticHealthView } from '../HolisticHealthView';
import { PostProcessStudioView } from '../PostProcessStudioView';
import { PromptEvolutionView } from '../PromptEvolutionView';
import { GDDComplianceView } from '../GDDComplianceView';
import { NexusView } from '../NexusView';
import { FeatureConstellation } from '../FeatureConstellation';
import { CrossModuleOverlapPanel } from '../CrossModuleOverlapPanel';
import { WeeklyDigestView } from '../WeeklyDigestView';
import { ProjectWrappedView } from '../ProjectWrappedView';
import { CalendarRoadmapView } from '../CalendarRoadmapView';
import { WorkflowOrchestratorView } from '../WorkflowOrchestratorView';
import { CodebaseArcheologistView } from '../CodebaseArcheologistView';
import { AssetCodeOracleView } from '../AssetCodeOracleView';
import { ErrorMemoryPanel } from '../ErrorMemoryPanel';
import { BuildHealthDashboard } from '../BuildHealthDashboard';
import { EvaluatorCoachmark } from '../EvaluatorCoachmark';
import { EVALUATOR_TAB_INFO } from '@/lib/evaluator/tab-glossary';
import { type TabId } from './types';
import { TabDivider, ScrollableTabBar, TabButton } from './TabControls';

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
