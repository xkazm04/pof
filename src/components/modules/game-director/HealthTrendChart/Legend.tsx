import { AlertOctagon } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_INFO, ACCENT_ORANGE } from '@/lib/chart-colors';

export function Legend({ regressionCount }: { regressionCount: number }) {
  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-border">
      <LegendItem color={STATUS_SUCCESS} label="Overall score" />
      <LegendItem color={STATUS_INFO} label="Findings" dashed />
      {regressionCount > 0 && (
        <span className="inline-flex items-center gap-1 text-2xs text-text-muted">
          <AlertOctagon className="w-2.5 h-2.5" style={{ color: ACCENT_ORANGE }} />
          {regressionCount} regression event{regressionCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-text-muted">
      <svg width="14" height="6" aria-hidden="true">
        <line
          x1="0" y1="3" x2="14" y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '3 2' : '0'}
        />
      </svg>
      {label}
    </span>
  );
}
