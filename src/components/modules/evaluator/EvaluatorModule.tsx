'use client';

import { useState } from 'react';
import { Radar, BarChart3, Activity, Link2, LayoutDashboard, ScanSearch, Grid3x3, FileText } from 'lucide-react';
import { SessionAnalyticsDashboard } from './SessionAnalyticsDashboard';
import { AggregateQualityDashboard } from './AggregateQualityDashboard';
import { CrossModuleFeatureDashboard } from './CrossModuleFeatureDashboard';
import { DependencyGraph } from './DependencyGraph';
import { ProjectHealthDashboard } from './ProjectHealthDashboard';
import { UnifiedSummaryView } from './UnifiedSummaryView';
import { DeepEvalResults } from './DeepEvalResults';
import { BatchReviewPanel } from './BatchReviewPanel';
import { GameDesignDocView } from './GameDesignDocView';

type TabId = 'overview' | 'features' | 'quality' | 'dependencies' | 'analytics' | 'scanner' | 'deep-eval' | 'gdd';

export function EvaluatorModule() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <Radar className="w-6 h-6 text-[#ef4444]" />
          <h1 className="text-lg font-semibold text-text">Project Evaluator</h1>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border">
          <TabButton label="Overview" icon={LayoutDashboard} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Deep Eval" icon={ScanSearch} active={activeTab === 'deep-eval'} onClick={() => setActiveTab('deep-eval')} />
          <TabButton label="Features" icon={Grid3x3} active={activeTab === 'features'} onClick={() => setActiveTab('features')} />
          <TabButton label="Quality" icon={Activity} active={activeTab === 'quality'} onClick={() => setActiveTab('quality')} />
          <TabButton label="Dependencies" icon={Link2} active={activeTab === 'dependencies'} onClick={() => setActiveTab('dependencies')} />
          <TabButton label="Analytics" icon={BarChart3} active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <TabButton label="Scanner" icon={Radar} active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} />
          <TabButton label="GDD" icon={FileText} active={activeTab === 'gdd'} onClick={() => setActiveTab('gdd')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'overview' && (
          <UnifiedSummaryView onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'deep-eval' && (
          <DeepEvalResults />
        )}

        {activeTab === 'features' && (
          <CrossModuleFeatureDashboard />
        )}

        {activeTab === 'quality' && (
          <AggregateQualityDashboard />
        )}

        {activeTab === 'dependencies' && (
          <DependencyGraph />
        )}

        {activeTab === 'analytics' && (
          <SessionAnalyticsDashboard />
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <BatchReviewPanel />
            <div className="border-t border-border pt-6">
              <ProjectHealthDashboard />
            </div>
          </div>
        )}

        {activeTab === 'gdd' && (
          <GameDesignDocView />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Radar;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: '#ef4444' }}
        />
      )}
    </button>
  );
}
