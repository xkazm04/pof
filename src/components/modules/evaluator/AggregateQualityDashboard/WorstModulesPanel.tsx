import { AlertTriangle, Star, XCircle } from 'lucide-react';
import { STATUS_ERROR, RATING_EMPTY, statusBorder } from '@/lib/chart-colors';
import type { CellData } from './types';

interface WorstModulesPanelProps {
  worstModules: CellData[];
  setSelectedModule: (v: string | null) => void;
}

export function WorstModulesPanel({ worstModules, setSelectedModule }: WorstModulesPanelProps) {
  return (
    <div className="bg-surface border rounded-lg p-4" style={{ borderColor: statusBorder(STATUS_ERROR) }}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
          Needs Attention
        </span>
        <span className="text-2xs text-text-muted">
          modules with average quality below 3.0
        </span>
      </div>
      <div className="space-y-1.5">
        {worstModules.map((m) => (
          <div
            key={m.moduleId}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
            onClick={() => setSelectedModule(m.moduleId)}
          >
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
            <span className="text-xs text-text font-medium flex-1">
              {m.label}
            </span>
            <div className="flex items-center gap-px">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className="w-2.5 h-2.5"
                  style={{
                    color: i < Math.round(m.avgQuality!) ? STATUS_ERROR : RATING_EMPTY,
                    fill: i < Math.round(m.avgQuality!) ? STATUS_ERROR : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium w-6 text-right" style={{ color: STATUS_ERROR }}>
              {m.avgQuality}
            </span>
            <span className="text-xs text-text-muted">
              {m.implemented}/{m.total} done
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
