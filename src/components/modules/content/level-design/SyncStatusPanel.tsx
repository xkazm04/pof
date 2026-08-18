'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, AlertOctagon, Info, RefreshCw, GitCompare,
  ChevronDown, ChevronRight, ArrowRight, ArrowLeft, Loader2, HelpCircle,
} from 'lucide-react';
import type { SyncStatus, SyncDivergence } from '@/types/level-design';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

interface SyncPresentation {
  icon: typeof CheckCircle;
  color: string;
  bg: string;
  label: string;
  desc: string;
}

const SYNC_CONFIG: Record<SyncStatus, SyncPresentation> = {
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
 * What the panel shows when NOTHING has ever compared this document against the
 * code. Only the sync callback writes `lastCodeHash`, so a null hash is proof no
 * comparison ran — and a `synced` badge on such a document would be a claim
 * nobody made. Code generation sets `synced` optimistically; that is the exact
 * case this replaces.
 */
export const NEVER_CHECKED: SyncPresentation = {
  icon: HelpCircle,
  color: STATUS_NEUTRAL,
  bg: `${STATUS_NEUTRAL}15`,
  label: 'Never checked',
  desc: 'Nothing has compared this document against the code yet.',
};

/**
 * The badge a document actually earns. A stored `synced` with no recorded code
 * fingerprint degrades to "Never checked"; every other status is a claim
 * something observed (a local edit, a comparison, or the absence of code).
 */
export function resolveSyncPresentation(status: SyncStatus, lastCodeHash: string | null): SyncPresentation {
  if (status === 'synced' && !lastCodeHash) return NEVER_CHECKED;
  return SYNC_CONFIG[status] ?? SYNC_CONFIG.unlinked;
}

/**
 * Copy for the "nothing to show" case, per status — so a zero-divergence
 * report never reads as a clean bill of health when nothing was compared.
 */
function emptyCopy(status: SyncStatus, lastCodeHash: string | null): string {
  if (!lastCodeHash) {
    return status === 'unlinked'
      ? 'Nothing to compare yet — generate code from the design doc, then run Check Sync.'
      : 'No comparison has run on this document. Run Check Sync to find out whether the code matches it.';
  }
  if (status === 'synced') return 'No divergences detected. Design and code are in sync.';
  return 'No field-level divergences listed. Run Check Sync to refresh the report.';
}

interface SyncStatusPanelProps {
  syncStatus: SyncStatus;
  divergences: SyncDivergence[];
  /**
   * Fingerprint of the code the last comparison read — null until a sync check
   * has ever run. Display-only evidence; it never changes a stored verdict.
   */
  lastCodeHash: string | null;
  onCheckSync: () => void;
  /** Code adopts the doc's value — dispatches the reconcile CLI task. */
  onReconcile: (divergence: SyncDivergence) => void;
  /** Doc adopts the code's value — a local document edit, no CLI run. */
  onAdoptCode: (divergence: SyncDivergence) => void;
  isChecking: boolean;
  accentColor: string;
}

export function SyncStatusPanel({
  syncStatus,
  divergences,
  lastCodeHash,
  onCheckSync,
  onReconcile,
  onAdoptCode,
  isChecking,
  accentColor,
}: SyncStatusPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const cfg = resolveSyncPresentation(syncStatus, lastCodeHash);
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

      {/* The evidence line: what the badge above is actually based on. */}
      <p className="text-2xs text-text-muted -mt-2" data-testid="sync-last-checked">
        {lastCodeHash
          ? `Last compared against code fingerprint ${lastCodeHash}.`
          : 'Never compared against the code — no sync check has run on this document.'}
      </p>

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
              {/* Two directions, named — neither button is a mystery "Fix". */}
              <p className="text-2xs text-text-muted leading-relaxed pb-1" data-testid="sync-reconcile-legend">
                <strong className="text-text-muted-hover">Adopt code</strong> writes the code&apos;s value into this
                design document (a local edit, no CLI run).{' '}
                <strong className="text-text-muted-hover">Fix code</strong> dispatches a CLI task that edits the C++ to
                match the document. Neither re-runs the comparison — the verdict above stands until the next Check Sync.
              </p>
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

                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onAdoptCode(div)}
                          // Every row shows the same two buttons — name the room and
                          // field so screen-reader users can tell them apart.
                          aria-label={`Adopt the code value for ${div.field} on ${div.roomName} into the design document`}
                          title={`Set ${div.field} on ${div.roomName} to the code's value (${div.codeValue || 'empty'})`}
                          data-testid={`sync-adopt-${div.roomId}-${div.field}`}
                          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all focus-ring border border-border text-text-muted-hover hover:text-text"
                        >
                          <ArrowLeft className="w-2.5 h-2.5" aria-hidden="true" />
                          Adopt code
                        </button>
                        <button
                          type="button"
                          onClick={() => onReconcile(div)}
                          aria-label={`Fix the C++ so ${div.field} on ${div.roomName} matches the design document`}
                          title={`Edit the C++ so ${div.field} on ${div.roomName} matches the doc (${div.docValue || 'empty'})`}
                          data-testid={`sync-fix-${div.roomId}-${div.field}`}
                          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all focus-ring"
                          style={{
                            backgroundColor: `${accentColor}24`,
                            color: accentColor,
                            border: `1px solid ${accentColor}38`,
                          }}
                        >
                          <RefreshCw className="w-2.5 h-2.5" aria-hidden="true" />
                          Fix code
                        </button>
                      </div>
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
          {emptyCopy(syncStatus, lastCodeHash)}
        </p>
      )}
    </div>
  );
}
