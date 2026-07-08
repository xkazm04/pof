'use client';

import {
  ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info,
} from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { type ValidationWarning } from '@/lib/state-machine-validator';
import { severityColor } from './helpers';

export function WarningsPanel({
  warnings,
  errorCount,
  warnCount,
  infoCount,
  collapsed,
  onToggle,
  onFocus,
}: {
  warnings: ValidationWarning[];
  errorCount: number;
  warnCount: number;
  infoCount: number;
  collapsed: boolean;
  onToggle: () => void;
  onFocus: (w: ValidationWarning) => void;
}) {
  const headerColor =
    errorCount > 0 ? STATUS_ERROR : warnCount > 0 ? STATUS_WARNING : STATUS_INFO;
  const headerIcon =
    errorCount > 0 ? (
      <AlertCircle className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
    ) : warnCount > 0 ? (
      <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
    ) : (
      <Info className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />
    );

  return (
    <div
      className="rounded-lg border bg-surface-deep"
      style={{ borderColor: `${headerColor}${OPACITY_30}` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-text">
          {headerIcon}
          Linter ({warnings.length} {warnings.length === 1 ? 'finding' : 'findings'})
          <span className="flex items-center gap-1.5 ml-2 font-normal">
            {errorCount > 0 && (
              <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}`, color: STATUS_ERROR }}>
                {errorCount} error{errorCount === 1 ? '' : 's'}
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_15}`, color: STATUS_WARNING }}>
                {warnCount} warning{warnCount === 1 ? '' : 's'}
              </span>
            )}
            {infoCount > 0 && (
              <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_INFO}${OPACITY_15}`, color: STATUS_INFO }}>
                {infoCount} info
              </span>
            )}
          </span>
        </span>
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-text-muted" />
        ) : (
          <ChevronDown className="w-3 h-3 text-text-muted" />
        )}
      </button>
      {!collapsed && (
        <ul className="px-3 pb-2.5 space-y-1 max-h-[180px] overflow-y-auto">
          {warnings.map((w, idx) => {
            const c = severityColor(w.severity);
            return (
              <li key={idx}>
                <button
                  onClick={() => onFocus(w)}
                  className="w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-2xs transition-colors hover:bg-surface-hover/30 border"
                  style={{ borderColor: `${c}${OPACITY_20}`, backgroundColor: `${c}08` }}
                  title="Click to focus the offending state/transition"
                >
                  <span className="flex-shrink-0 mt-0.5" style={{ color: c }}>
                    {w.severity === 'error' ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : w.severity === 'warning' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Info className="w-3 h-3" />
                    )}
                  </span>
                  <span className="flex-1 text-text">{w.message}</span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider flex-shrink-0"
                    style={{ color: c }}
                  >
                    {w.kind.replace(/-/g, ' ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
