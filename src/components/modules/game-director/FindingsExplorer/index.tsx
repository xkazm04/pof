'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Filter, FilterX, Search, Loader2, Target, FileSearch, Plus,
} from 'lucide-react';
import type {
  PlaytestSession, PlaytestFinding, FindingSeverity, TriageStatus,
} from '@/types/game-director';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SEVERITY_TOKENS, TRIAGE_TOKENS } from '@/lib/game-director-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { SeverityLegend } from '../SeverityLegend';
import { FindingFixButton } from '../FindingFixButton';
import { ACCENT, TRIAGE_FILTER_LABELS, type TriageFilter } from './constants';
import { FindingCard } from './FindingCard';

/** A triage write that failed — kept whole so Retry can replay the exact call. */
interface FailedTriage {
  message: string;
  finding: PlaytestFinding;
  triageStatus: TriageStatus;
  note?: string;
  snoozedUntil?: string | null;
}

const SEVERITY_FILTERS = ['all', 'critical', 'high', 'medium', 'low', 'positive'] as const;

interface FindingsExplorerProps {
  sessions: PlaytestSession[];
  /** Single batch fetch returning every finding; grouped/filtered client-side. */
  getAllFindings: () => Promise<PlaytestFinding[]>;
  updateTriage: (
    findingId: string,
    triageStatus: TriageStatus,
    triageNote?: string,
    snoozedUntil?: string | null,
  ) => Promise<PlaytestFinding>;
  markFixDispatched: (findingId: string) => Promise<PlaytestFinding>;
  onNewSession?: () => void;
}

export function FindingsExplorer({ sessions, getAllFindings, updateTriage, markFixDispatched, onNewSession }: FindingsExplorerProps) {
  const [allFindings, setAllFindings] = useState<PlaytestFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'all'>('all');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  // A rejected triage write used to vanish: the card simply never changed. Keep
  // the failed call so the banner can explain it and replay it verbatim.
  const [triageError, setTriageError] = useState<FailedTriage | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // One batch request returns every finding (replacing the per-completed-session
  // fan-out). We intentionally do NOT depend on `sessions` here: `useGameDirector`
  // hands back a fresh `sessions` reference after every triage `refresh()`, which
  // previously re-fired the whole N-request storm and clobbered the optimistic
  // update below. Completed-session scoping is applied client-side in `filtered`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const results = await getAllFindings();
      if (!cancelled) {
        setAllFindings(results);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getAllFindings]);

  /** Resolves `true` when the write landed — the card keeps its note editor open on failure. */
  const applyTriage = useCallback(async (
    finding: PlaytestFinding,
    triageStatus: TriageStatus,
    note?: string,
    snoozedUntil?: string | null,
  ): Promise<boolean> => {
    setBusyId(finding.id);
    setTriageError(null);
    try {
      const updated = await updateTriage(finding.id, triageStatus, note ?? finding.triageNote, snoozedUntil);
      setAllFindings(prev => prev.map(f => (f.id === updated.id ? updated : f)));
      setAnnouncement(`"${updated.title}" marked ${TRIAGE_TOKENS[triageStatus].label}.`);
      return true;
    } catch (err) {
      setTriageError({
        message: err instanceof Error ? err.message : 'Failed to save the triage change.',
        finding,
        triageStatus,
        note,
        snoozedUntil,
      });
      return false;
    } finally {
      setBusyId(prev => (prev === finding.id ? null : prev));
    }
  }, [updateTriage]);

  // Stamp the finding with its fix-dispatch time so the detect→fix link shows
  // immediately (best-effort — the repair task has already been dispatched).
  const handleFixDispatched = useCallback(async (finding: PlaytestFinding) => {
    try {
      const updated = await markFixDispatched(finding.id);
      setAllFindings(prev => prev.map(f => (f.id === updated.id ? updated : f)));
    } catch {
      // tracking is best-effort
    }
  }, [markFixDispatched]);

  // The batch endpoint returns findings for every session; the explorer only
  // ever showed findings from *completed* sessions (the old fan-out fetched only
  // those). Scope client-side to keep the displayed set byte-for-byte identical.
  const completedSessionIds = useMemo(
    () => new Set(sessions.filter(s => s.status === 'complete').map(s => s.id)),
    [sessions],
  );

  const visibleFindings = useMemo(
    () => allFindings.filter(f => completedSessionIds.has(f.sessionId)),
    [allFindings, completedSessionIds],
  );

  // Everything the triage filter + search allow, *before* the severity filter —
  // so each severity chip can state how many findings it would actually show.
  const preSeverity = useMemo(() => {
    let result = visibleFindings;
    if (triageFilter === 'open') {
      result = result.filter(f => f.triageStatus === 'active' || f.triageStatus === 'confirmed');
    } else if (triageFilter === 'triaged') {
      result = result.filter(f => f.triageStatus !== 'active');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.suggestedFix.toLowerCase().includes(q) ||
        f.triageNote.toLowerCase().includes(q)
      );
    }
    return result;
  }, [visibleFindings, searchQuery, triageFilter]);

  const filtered = useMemo(
    () => (severityFilter === 'all' ? preSeverity : preSeverity.filter(f => f.severity === severityFilter)),
    [preSeverity, severityFilter],
  );

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: preSeverity.length, critical: 0, high: 0, medium: 0, low: 0, positive: 0,
    };
    for (const f of preSeverity) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    return counts;
  }, [preSeverity]);

  const filtersActive = searchQuery.trim() !== '' || severityFilter !== 'all' || triageFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSeverityFilter('all');
    setTriageFilter('all');
  }, []);

  const triageCounts = useMemo(() => {
    let open = 0;
    let triaged = 0;
    for (const f of visibleFindings) {
      if (f.triageStatus === 'active' || f.triageStatus === 'confirmed') open += 1;
      if (f.triageStatus !== 'active') triaged += 1;
    }
    return { open, all: visibleFindings.length, triaged };
  }, [visibleFindings]);

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-20 text-xs text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Loading findings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <SurfaceCard className="flex items-center gap-2 flex-1 min-w-[14rem] px-3 py-2 focus-within:border-border-bright">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings or notes..."
            aria-label="Search findings"
            className="flex-1 bg-transparent text-sm text-text placeholder-text-muted outline-none"
          />
        </SurfaceCard>

        <div className="flex items-center gap-1" role="group" aria-label="Triage filter">
          {(['open', 'all', 'triaged'] as const).map((tf) => {
            const isActive = triageFilter === tf;
            return (
              <button
                key={tf}
                onClick={() => setTriageFilter(tf)}
                aria-pressed={isActive}
                className={`focus-ring px-2 py-1 rounded text-xs font-medium transition-all ${
                  isActive ? 'bg-border text-text' : 'text-text-muted hover:bg-surface'
                }`}
              >
                {TRIAGE_FILTER_LABELS[tf]}
                <span className="ml-1 text-2xs text-text-muted">({triageCounts[tf]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Severity filter">
          <Filter className="w-3 h-3 text-text-muted" aria-hidden="true" />
          {SEVERITY_FILTERS.map((sev) => {
            const isActive = severityFilter === sev;
            const color = sev === 'all' ? 'var(--text-muted)' : SEVERITY_TOKENS[sev].color;
            const count = severityCounts[sev] ?? 0;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                aria-pressed={isActive}
                // A chip that would show nothing reads as empty up front rather
                // than looking identical to one with results. The count stays in
                // the accessible name (same shape as the triage chips above).
                className={`focus-ring px-2 py-1 rounded text-xs font-medium capitalize transition-all ${
                  isActive ? 'bg-border' : 'hover:bg-surface'
                }${!isActive && count === 0 ? ' opacity-50' : ''}`}
                style={{ color: isActive ? color : 'var(--text-muted)' }}
              >
                {sev}
                <span className="ml-1 text-2xs text-text-muted">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <span role="status" aria-live="polite" className="block text-2xs text-text-muted">
        {filtered.length} finding{filtered.length !== 1 ? 's' : ''} across {sessions.filter(s => s.status === 'complete').length} session{sessions.filter(s => s.status === 'complete').length !== 1 ? 's' : ''}
        {triageFilter === 'open' && triageCounts.triaged > 0 && (
          <> · {triageCounts.triaged} hidden by triage</>
        )}
      </span>

      {/* Triage writes are the only destructive-ish action here; a failed one
          explains itself and can be replayed instead of silently no-op'ing. */}
      {triageError && (
        <InlineErrorRetry
          message={`Couldn't save triage for "${triageError.finding.title}": ${triageError.message}`}
          onRetry={() => {
            void applyTriage(
              triageError.finding,
              triageError.triageStatus,
              triageError.note,
              triageError.snoozedUntil,
            );
          }}
          onDismiss={() => setTriageError(null)}
        />
      )}

      {/* Success announcements for triage actions that only change a small badge. */}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      {visibleFindings.length > 0 && <SeverityLegend />}

      {/* Findings list */}
      {filtered.length === 0 ? (
        visibleFindings.length === 0 ? (
          <EmptyState
            icon={Target}
            iconColor={ACCENT}
            satelliteIcons={[FileSearch, Search]}
            title="No findings discovered yet"
            description="Findings are bugs, issues, and observations uncovered during AI playtests. Complete at least one playtest session to start collecting findings here."
            action={onNewSession ? { label: 'Go to New Session', onClick: onNewSession, icon: Plus } : undefined}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="w-5 h-5 text-border-bright mb-2" aria-hidden="true" />
            <p className="text-xs text-text-muted">
              None of the {visibleFindings.length} finding{visibleFindings.length !== 1 ? 's' : ''} match your current filters.
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
              >
                <FilterX className="w-3 h-3" aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((finding, idx) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              index={idx}
              busy={busyId === finding.id}
              onApply={applyTriage}
              onFixDispatched={handleFixDispatched}
            />
          ))}
        </div>
      )}
    </div>
  );
}
