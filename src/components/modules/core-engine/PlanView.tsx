'use client';

import { useState } from 'react';
import { ClipboardList, Dna } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { ImplementationPlan } from './ImplementationPlan';
import { TelemetryEvolution } from './TelemetryEvolution';

const ACCENT = MODULE_COLORS.core;

type PlanTab = 'plan' | 'evolution';

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
        <div className="flex items-center gap-1 mt-3 border-b border-border -mb-[1px]">
          <TabButton
            label="Plan"
            icon={ClipboardList}
            active={activeTab === 'plan'}
            onClick={() => setActiveTab('plan')}
          />
          <TabButton
            label="Evolution"
            icon={Dna}
            active={activeTab === 'evolution'}
            onClick={() => setActiveTab('evolution')}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        {activeTab === 'plan' && <ImplementationPlan />}
        {activeTab === 'evolution' && <TelemetryEvolution />}
      </div>
    </div>
  );
}

function TabButton({ label, icon: Icon, active, onClick }: {
  label: string;
  icon: typeof ClipboardList;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: ACCENT }}
        />
      )}
    </button>
  );
}
