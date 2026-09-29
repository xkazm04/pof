'use client';

import {
  AlertTriangle,
  Hammer,
  ChevronRight,
} from 'lucide-react';
import { STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, statusBorder } from '@/lib/chart-colors';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { PlanItem } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';
import type { CellData } from './types';
import { BuildButton } from './CellDrillPanel';

export function BottomPanels({
  lowestModules,
  buildable,
  handleCellClick,
  onBuild,
  isBuilding,
}: {
  lowestModules: CellData[];
  /** `buildableNow(plan)`: the highest-impact ready features across modules. */
  buildable: PlanItem[];
  handleCellClick: (moduleId: SubModuleId) => void;
  onBuild: (item: PlanItem) => void;
  isBuilding: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Lowest-scoring modules */}
      <div className="bg-surface border border-[#f87171]/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-[#f87171]" />
          <span className="text-xs font-semibold text-[#f87171] uppercase tracking-wider">
            Lowest Completion
          </span>
        </div>
        <div className="space-y-1.5">
          {lowestModules.map((m) => {
            const pct = Math.round(m.pctComplete * 100);
            return (
              <button
                key={m.moduleId}
                onClick={() => handleCellClick(m.moduleId)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors text-left group"
              >
                <span className="text-xs text-text font-medium flex-1 group-hover:text-text">
                  {m.label}
                </span>
                <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 40 ? STATUS_WARNING : pct > 0 ? STATUS_ERROR : 'var(--text-muted)',
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium w-7 text-right"
                  style={{ color: pct >= 40 ? STATUS_WARNING : pct > 0 ? STATUS_ERROR : 'var(--text-muted)' }}
                >
                  {pct}%
                </span>
                <span className="text-2xs text-text-muted">
                  {m.missing} missing
                </span>
                <ChevronRight className="w-3 h-3 text-text-muted opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all" />
              </button>
            );
          })}
          {lowestModules.length === 0 && (
            <p className="text-xs text-text-muted italic px-3 py-2">
              No reviewed modules yet
            </p>
          )}
        </div>
      </div>

      {/* Buildable now: ready features (every dependency done), by impact */}
      <div
        data-testid="pof-buildable-now"
        className="bg-surface border rounded-lg p-4"
        style={{ borderColor: statusBorder(STATUS_SUCCESS) }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Hammer className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: STATUS_SUCCESS }}>
            Buildable now
          </span>
          <span className="text-2xs text-text-muted">every dependency done · by impact</span>
        </div>
        <div className="space-y-1.5">
          {buildable.map((item) => (
            <div
              key={item.key}
              role="group"
              aria-label={item.featureName}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text font-medium block truncate">
                  {item.featureName}
                </span>
                <span className="text-2xs text-text-muted">
                  {MODULE_LABELS[item.moduleId] ?? item.moduleId} · {item.status}
                  {item.impact.directUnblocks > 0 && ` · unblocks ${item.impact.directUnblocks}`}
                </span>
              </div>
              <BuildButton featureName={item.featureName} disabled={isBuilding} onClick={() => onBuild(item)} />
            </div>
          ))}
          {buildable.length === 0 && (
            <p className="text-xs text-text-muted italic px-3 py-2">
              Nothing is ready to build: every open feature waits on another
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
