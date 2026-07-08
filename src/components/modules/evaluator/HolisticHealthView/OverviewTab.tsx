import { Layers, Target, Activity } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ModuleHealthSummary, Milestone, SubsystemSignal } from '@/types/project-health';
import { ModuleHeatCell } from './ModuleHeatCell';
import { MilestoneRow } from './MilestoneRow';
import { SignalCard } from './SignalCard';

export function OverviewTab({
  moduleHealth,
  milestones,
  subsystemSignals,
  onNavigateTab,
}: {
  moduleHealth: ModuleHealthSummary[];
  milestones: Milestone[];
  subsystemSignals: SubsystemSignal[];
  onNavigateTab?: (tab: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Module Heatmap */}
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Module Health Heatmap
        </h3>
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
          {moduleHealth.map((m) => (
            <ModuleHeatCell key={m.moduleId} module={m} />
          ))}
        </div>
      </SurfaceCard>

      {/* Milestone predictions */}
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-emerald-400" />
          Milestone Predictions
        </h3>
        <div className="space-y-2.5">
          {milestones.map((ms) => (
            <MilestoneRow key={ms.id} milestone={ms} />
          ))}
        </div>
      </SurfaceCard>

      {/* Subsystem signals */}
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          Subsystem Status
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {subsystemSignals.map((s) => (
            <SignalCard key={s.subsystem} signal={s} onNavigateTab={onNavigateTab} />
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
