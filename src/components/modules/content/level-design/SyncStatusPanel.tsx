'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, AlertOctagon, Info, RefreshCw, GitCompare,
  ChevronDown, ChevronRight, ArrowRight, Loader2,
} from 'lucide-react';
import type { SyncStatus, SyncDivergence } from '@/types/level-design';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

const SYNC_CONFIG: Record<SyncStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string; desc: string }> = {
  synced:     { icon: CheckCircle,    color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}15`, label: 'Synced',     desc: 'Design doc matches generated code' },
  'doc-ahead': { icon: AlertTriangle, color: STATUS_WARNING, bg: `${STATUS_WARNING}15`, label: 'Doc Ahead',  desc: 'Design doc has changes not yet in code' },
  'code-ahead': { icon: AlertTriangle, color: STATUS_INFO, bg: `${STATUS_INFO}15`, label: 'Code Ahead', desc: 'Code has changes not reflected in doc' },
  diverged:   { icon: AlertOctagon,   color: STATUS_ERROR, bg: `${STATUS_ERROR}15`, label: 'Diverged',   desc: 'Both doc and code have independent changes' },
  unlinked:   { icon: Info,           color: STATUS_NEUTRAL, bg: `${STATUS_NEUTRAL}15`, label: 'Unlinked',   desc: 'No code generated yet' },
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof Info; label: string }> = {
  info:     { color: STATUS_INFO, icon: Info, label: 'Info' },
  warning:  { color: STATUS_WARNING, icon: AlertTriangle, label: 'Warning' },
  critical: { color: STATUS_ERROR, icon: AlertOctagon, label: 'Critical' },
};

/** Never index blind — an unrecognised severity must degrade, not crash the panel. */
function severityOf(severity: string) {
  return SEVERITY_CONFIG[severity] ?? { color: STATUS_NEUTRAL, icon: Info, label: severity || 'Unknown' };
}

/**
 * Copy for the "nothing to show" case, per status — so a zero-divergence
 * report never reads as a clean bill of health when nothing was compared.
 */
function emptyCopy(status: SyncStatus): string {
  if (status === 'synced') return 'No divergences detected. Design and code are in sync.';
  if (status === 'unlinked') return 'Nothing to compare yet — generate code from the design doc, then run Check Sync.';
  return 'No field-level divergences listed. Run Check Sync to refresh the report.';
}

interface SyncStatusPanelProps {
  syncStatus: SyncStatus;
  divergences: SyncDivergence[];
  onCheckSync: () => void;
  onReconcile: (divergence: SyncDivergence) => void;
  isChecking: boolean;
  accentColor: string;
}

export function SyncStatusPanel({
  syncStatus,
  divergences,
  onCheckSync,
  onReconcile,
  isChecking,
  accentColor,
}: SyncStatusPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const cfg = SYNC_CONFIG[syncStatus];
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-4">
      {/* Sync status badge — role=status so a re-check announces the new verdict */}
      <div
        role="status"
        aria-live="polite"
        data-testid="sync-status-badge"
        className="flex items-center gap-3 px-4 py-3 rounded-lg border"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.color + '30' }}
      >
        <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{cfg.desc}</p>
        </div>

        <button
          type="button"
          onClick={onCheckSync}
          disabled={isChecking}
          aria-busy={isChecking}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 focus-ring"
          style={{
            backgroundColor: `${accentColor}24`,
            color: accentColor,
            border: `1px solid ${accentColor}38`,
          }}
        >
          {isChecking ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <GitCompare className="w-3 h-3" aria-hidden="true" />
          )}
          {isChecking ? 'Checking…' : 'Check Sync'}
        </button>
      </div>

      {/* Divergence list */}
      {divergences.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="sync-divergence-list"
            className="flex items-center gap-1.5 w-full text-left mb-2 focus-ring rounded"
          >
            {expanded
              ? <ChevronDown className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />
              : <ChevronRight className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />}
            <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
              Divergences
            </span>
            <span
              className="text-2xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${STATUS_ERROR}18`, color: STATUS_ERROR }}
            >
              {divergences.length}
            </span>
          </button>

          {expanded && (
            <div className="space-y-1.5" id="sync-divergence-list">
              {divergences.map((div, i) => {
                const sev = severityOf(div.severity);
                const SevIcon = sev.icon;

                return (
                  <div
                    key={`${div.roomId}-${div.field}-${i}`}
                    className="px-3 py-2.5 rounded-md bg-surface-deep border border-border"
                  >
                    <div className="flex items-start gap-2">
                      <SevIcon
                        className="w-3 h-3 flex-shrink-0 mt-0.5"
                        style={{ color: sev.color }}
                        role="img"
                        aria-label={`${sev.label} severity`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-text">{div.roomName}</span>
                          <span className="text-2xs text-text-muted">&middot; {div.field}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-1.5">
                          <div>
                            <span className="text-2xs text-text-muted block">Design Doc</span>
                            <span className="text-xs text-text-muted-hover font-mono block truncate">
                              {div.docValue || '(empty)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-2xs text-text-muted block">Code</span>
                            <span className="text-xs text-text-muted-hover font-mono block truncate">
                              {div.codeValue || '(empty)'}
                            </span>
                          </div>
                        </div>

                        {div.suggestion && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <ArrowRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-text-muted leading-relaxed">
                              {div.suggestion}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onReconcile(div)}
                        // Every row's button reads "Fix" — name it so screen-reader
                        // users can tell N identical buttons apart.
                        aria-label={`Reconcile ${div.field} on ${div.roomName}`}
                        title={`Reconcile ${div.field} on ${div.roomName}`}
                        className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium flex-shrink-0 transition-all focus-ring"
                        style={{
                          backgroundColor: `${accentColor}24`,
                          color: accentColor,
                          border: `1px solid ${accentColor}38`,
                        }}
                      >
                        <RefreshCw className="w-2.5 h-2.5" aria-hidden="true" />
                        Fix
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {divergences.length === 0 && (
        <p className="text-xs text-text-muted text-center py-2" data-testid="sync-empty-copy">
          {emptyCopy(syncStatus)}
        </p>
      )}
    </div>
  );
}
