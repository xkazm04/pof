'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, ChevronDown, ChevronRight, Shield, Loader2,
  Bug, Eye,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import type { RegressionStatus } from '@/types/regression-tracker';
import type {
  FindingFingerprint,
  FingerprintOccurrence,
} from '@/types/regression-tracker';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  OPACITY_12, OPACITY_20,
} from '@/lib/chart-colors';
import { SEVERITY_TOKENS, REGRESSION_STATUS_TOKENS } from '@/lib/game-director-styles';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';
import { ACCENT } from './constants';

// ─── Fingerprints Tab ─────────────────────────────────────────────────────────

export function FingerprintsTab({
  fingerprints,
  onResolve,
}: {
  fingerprints: FindingFingerprint[];
  onResolve: (fpId: string) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<FingerprintOccurrence[]>([]);
  const [loadingOcc, setLoadingOcc] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return fingerprints;
    return fingerprints.filter(fp => fp.status === filter);
  }, [fingerprints, filter]);

  const fetchOccurrences = useCallback(async (fpId: string) => {
    setLoadingOcc(true);
    setOccError(null);
    try {
      const occData = await apiFetch<FingerprintOccurrence[]>(`/api/regression-tracker?action=occurrences&fpId=${fpId}`);
      setOccurrences(occData);
    } catch (err) {
      setOccError(err instanceof Error ? err.message : 'Failed to load occurrence history');
      setOccurrences([]);
    } finally {
      setLoadingOcc(false);
    }
  }, []);

  const loadOccurrences = useCallback((fpId: string) => {
    if (expandedId === fpId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(fpId);
    void fetchOccurrences(fpId);
  }, [expandedId, fetchOccurrences]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: fingerprints.length, open: 0, fixed: 0, regressed: 0, resolved: 0 };
    for (const fp of fingerprints) counts[fp.status] = (counts[fp.status] ?? 0) + 1;
    return counts;
  }, [fingerprints]);

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'open', 'regressed', 'fixed', 'resolved'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`focus-ring px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'text-white' : 'text-text-muted hover:text-text bg-surface-hover/50'
            }`}
            style={filter === s ? {
              backgroundColor: s === 'all' ? ACCENT : (REGRESSION_STATUS_TOKENS[s as RegressionStatus]?.color ?? ACCENT),
            } : undefined}
          >
            {s === 'all' ? 'All' : REGRESSION_STATUS_TOKENS[s as RegressionStatus]?.label ?? s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Fingerprint list */}
      {filtered.length === 0 ? (
        fingerprints.length === 0 ? (
          <EmptyState
            icon={Bug}
            iconColor={ACCENT}
            satelliteIcons={[Shield, Eye]}
            title="No tracked issues yet"
            description={`Tracked issues are unique bugs fingerprinted across multiple playtest sessions. Use the "Analyze Session" panel above to process a completed session and start tracking recurring issues.`}
          />
        ) : (
          <div className="text-center py-12 text-text-muted text-xs">
            No tracked issues with status &quot;{filter}&quot;.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map(fp => {
            const sev = SEVERITY_TOKENS[fp.peakSeverity];
            const statusToken = REGRESSION_STATUS_TOKENS[fp.status];
            const SevIcon = sev.icon;
            const isExpanded = expandedId === fp.id;

            return (
              <SurfaceCard key={fp.id} level={2}>
                <button
                  onClick={() => loadOccurrences(fp.id)}
                  aria-expanded={isExpanded}
                  className="focus-ring-inset rounded-md w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-surface-hover/30 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  }
                  <SevIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sev.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text block truncate">{fp.titleStem}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{fp.category}</span>
                      {fp.relatedModule && (
                        <span className="text-xs text-text-muted">{fp.relatedModule}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-2xs font-mono text-text-muted">{fp.occurrenceCount}x seen</span>
                    {fp.regressionCount > 0 && (
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_12}` }}>
                        {fp.regressionCount}x regressed
                      </span>
                    )}
                    <StatusChip token={statusToken} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                        {loadingOcc ? (
                          <div className="flex items-center gap-2 text-2xs text-text-muted">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading history...
                          </div>
                        ) : occError ? (
                          <InlineErrorRetry
                            dense
                            message={`Couldn't load history: ${occError}`}
                            onRetry={() => { void fetchOccurrences(fp.id); }}
                          />
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-2xs font-semibold text-text-muted">Occurrence History</span>
                              {(fp.status === 'open' || fp.status === 'regressed') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onResolve(fp.id); }}
                                  className="focus-ring text-xs font-medium px-2 py-0.5 rounded transition-colors"
                                  style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_12}` }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${STATUS_SUCCESS}${OPACITY_20}`; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${STATUS_SUCCESS}${OPACITY_12}`; }}
                                >
                                  Mark Resolved
                                </button>
                              )}
                            </div>
                            {occurrences.map(occ => {
                              const occSev = SEVERITY_TOKENS[occ.severity];
                              const OccIcon = occSev.icon;
                              return (
                                <div key={`${occ.sessionId}-${occ.findingId}`} className="flex items-start gap-2 px-2 py-1.5 rounded bg-background text-2xs">
                                  <OccIcon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: occSev.color }} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-text block truncate">{occ.title}</span>
                                    {occ.suggestedFix && (
                                      <span className="text-text-muted block mt-0.5 truncate">Fix: {occ.suggestedFix}</span>
                                    )}
                                  </div>
                                  <span className="text-text-muted flex-shrink-0">
                                    {new Date(occ.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              );
                            })}
                            {occurrences.length === 0 && (
                              <span className="text-2xs text-text-muted">No occurrence records found.</span>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
