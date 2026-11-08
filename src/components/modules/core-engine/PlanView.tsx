'use client';

import { useState } from 'react';
import { ClipboardList, Dna } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { ImplementationPlan } from './ImplementationPlan';
import { TelemetryEvolution } from './TelemetryEvolution';

const ACCENT = MODULE_COLORS.core;

type PlanTab = 'plan' | 'evolution';

const TABS: ReadonlyArray<TabItem<PlanTab>> = [
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'evolution', label: 'Evolution', icon: Dna },
];

/**
 * PlanView - Dedicated view for the Core Engine Implementation Plan + Evolution
 *
 * Displays the unified implementation plan for all core-engine submodules
 * and the telemetry evolution timeline (moved here from per-module tabs).
 */
export function PlanView() {
  const [activeTab, setActiveTab] = useState<PlanTab>('plan');

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Header with title + tab bar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-text">Core Engine Implementation Plan</span>
          <span className="text-xs text-text-muted">(cross-module view)</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Track feature implementation progress across all core-engine submodules, manage dependencies, and optimize prioritization.
        </p>

        {/* Tab bar */}
        <TabBar
          tabs={TABS}
          activeId={activeTab}
          onChange={setActiveTab}
          layoutId="plan-view-tab"
          accent={ACCENT}
          ariaLabel="Plan view"
          className="mt-3 -mb-[1px]"
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        {activeTab === 'plan' && <ImplementationPlan />}
        {activeTab === 'evolution' && <TelemetryEvolution />}
      </div>
    </div>
  );
}
