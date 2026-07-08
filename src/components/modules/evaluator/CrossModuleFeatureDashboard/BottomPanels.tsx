'use client';

import {
  AlertTriangle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import type { CellData, MissingFeatureGroup } from './types';

export function BottomPanels({
  lowestModules,
  mostMissingFeatures,
  handleCellClick,
}: {
  lowestModules: CellData[];
  mostMissingFeatures: MissingFeatureGroup[];
  handleCellClick: (moduleId: SubModuleId) => void;
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

      {/* Most missing features */}
      <div className="bg-surface border border-[#fbbf24]/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <XCircle className="w-3.5 h-3.5 text-[#fbbf24]" />
          <span className="text-xs font-semibold text-[#fbbf24] uppercase tracking-wider">
            Most Missing Features
          </span>
        </div>
        <div className="space-y-1.5">
          {mostMissingFeatures.map((f) => (
            <div
              key={f.featureName}
              className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors"
            >
              <XCircle className="w-3 h-3 text-[#f87171] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text font-medium block truncate">
                  {f.featureName}
                </span>
                <span className="text-2xs text-text-muted">
                  Missing in: {f.modules.join(', ')}
                </span>
              </div>
              <span className="text-xs font-medium text-[#f87171] flex-shrink-0">
                {f.modules.length}x
              </span>
            </div>
          ))}
          {mostMissingFeatures.length === 0 && (
            <p className="text-xs text-text-muted italic px-3 py-2">
              No missing features found (run reviews first)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
