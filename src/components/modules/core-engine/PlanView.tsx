'use client';

import { ImplementationPlan } from './ImplementationPlan';

/**
 * PlanView - Dedicated view for the Core Engine Implementation Plan
 * 
 * This component displays the unified implementation plan for all core-engine submodules.
 * It replaces per-submodule "Plan" tabs with a single, comprehensive sidebar item.
 */
export function PlanView() {
  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Header with title */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-text">Core Engine Implementation Plan</span>
          <span className="text-xs text-text-muted">(cross-module view)</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Track feature implementation progress across all core-engine submodules, manage dependencies, and optimize prioritization.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <ImplementationPlan />
      </div>
    </div>
  );
}
