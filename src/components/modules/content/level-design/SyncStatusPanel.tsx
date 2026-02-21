'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, AlertOctagon, Info, RefreshCw, GitCompare,
  ChevronDown, ChevronRight, ArrowRight, Loader2,
} from 'lucide-react';
import type { SyncStatus, SyncDivergence } from '@/types/level-design';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, STATUS_ERROR } from '@/lib/chart-colors';

const SYNC_CONFIG: Record<SyncStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string; desc: string }> = {
  synced:     { icon: CheckCircle,    color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}15`, label: 'Synced',     desc: 'Design doc matches generated code' },
  'doc-ahead': { icon: AlertTriangle, color: STATUS_WARNING, bg: `${STATUS_WARNING}15`, label: 'Doc Ahead',  desc: 'Design doc has changes not yet in code' },
  'code-ahead': { icon: AlertTriangle, color: STATUS_INFO, bg: `${STATUS_INFO}15`, label: 'Code Ahead', desc: 'Code has changes not reflected in doc' },
  diverged:   { icon: AlertOctagon,   color: STATUS_ERROR, bg: `${STATUS_ERROR}15`, label: 'Diverged',   desc: 'Both doc and code have independent changes' },
  unlinked:   { icon: Info,           color: 'var(--text-muted)', bg: 'var(--text-muted)15', label: 'Unlinked',   desc: 'No code generated yet' },
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof Info }> = {
  info:     { color: STATUS_INFO, icon: Info },
  warning:  { color: STATUS_WARNING, icon: AlertTriangle },
  critical: { color: STATUS_ERROR, icon: AlertOctagon },
};

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
    <div className="space-y-3">
      {/* Sync status badge */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg border"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.color + '30' }}
      >
        <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{cfg.desc}</p>
        </div>

        <button
          onClick={onCheckSync}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${accentColor}24`,
            color: accentColor,
            border: `1px solid ${accentColor}38`,
          }}
        >
          {isChecking ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <GitCompare className="w-3 h-3" />
          )}
          {isChecking ? 'Checking...' : 'Check Sync'}
        </button>
      </div>

      {/* Divergence list */}
      {divergences.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 w-full text-left mb-2"
          >
            {expanded ? <ChevronDown className="w-3 h-3 text-text-muted-hover" /> : <ChevronRight className="w-3 h-3 text-text-muted-hover" />}
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
            <div className="space-y-1.5">
              {divergences.map((div, i) => {
                const sev = SEVERITY_CONFIG[div.severity];
                const SevIcon = sev.icon;

                return (
                  <div
                    key={`${div.roomId}-${div.field}-${i}`}
                    className="px-3 py-2.5 rounded-md bg-surface-deep border border-border"
                  >
                    <div className="flex items-start gap-2">
                      <SevIcon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: sev.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-text">{div.roomName}</span>
                          <span className="text-2xs text-text-muted">&middot; {div.field}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-1.5">
                          <div>
                            <span className="text-2xs text-text-muted block">Design Doc</span>
                            <span className="text-xs text-[#b0b4cc] font-mono block truncate">
                              {div.docValue || '(empty)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-2xs text-text-muted block">Code</span>
                            <span className="text-xs text-[#b0b4cc] font-mono block truncate">
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
                        onClick={() => onReconcile(div)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium flex-shrink-0 transition-all"
                        style={{
                          backgroundColor: `${accentColor}24`,
                          color: accentColor,
                          border: `1px solid ${accentColor}38`,
                        }}
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
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

      {divergences.length === 0 && syncStatus === 'synced' && (
        <p className="text-xs text-text-muted text-center py-2">
          No divergences detected. Design and code are in sync.
        </p>
      )}
    </div>
  );
}
