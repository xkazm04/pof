'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Filter, Search, Loader2, Target, FileSearch, Plus,
  ShieldCheck, BellOff, EyeOff, Clock, RotateCcw, Check, X,
} from 'lucide-react';
import { ACCENT_ORANGE, STATUS_BLOCKER, STATUS_INFO, OPACITY_12, OPACITY_20 } from '@/lib/chart-colors';
import type {
  PlaytestSession, PlaytestFinding, FindingSeverity, TriageStatus,
} from '@/types/game-director';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  SEVERITY_TOKENS, CATEGORY_LABELS, TRIAGE_TOKENS, severitySurface,
} from '@/lib/game-director-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeverityLegend } from './SeverityLegend';
import { FindingFixButton } from './FindingFixButton';

const ACCENT = ACCENT_ORANGE;

interface FindingsExplorerProps {
  sessions: PlaytestSession[];
  getFindings: (sessionId: string) => Promise<PlaytestFinding[]>;
  updateTriage: (
    findingId: string,
    triageStatus: TriageStatus,
    triageNote?: string,
    snoozedUntil?: string | null,
  ) => Promise<PlaytestFinding>;
  markFixDispatched: (findingId: string) => Promise<PlaytestFinding>;
  onNewSession?: () => void;
}

type TriageFilter = 'open' | 'all' | 'triaged';

const TRIAGE_FILTER_LABELS: Record<TriageFilter, string> = {
  open: 'Open',
  all: 'All',
  triaged: 'Triaged',
};

export function FindingsExplorer({ sessions, getFindings, updateTriage, markFixDispatched, onNewSession }: FindingsExplorerProps) {
  const [allFindings, setAllFindings] = useState<PlaytestFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'all'>('all');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const completedSessions = sessions.filter(s => s.status === 'complete');
      const allResults = await Promise.all(completedSessions.map(s => getFindings(s.id)));
      if (!cancelled) {
        setAllFindings(allResults.flat());
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessions, getFindings]);

  const applyTriage = useCallback(async (
    finding: PlaytestFinding,
    triageStatus: TriageStatus,
    note?: string,
    snoozedUntil?: string | null,
  ) => {
    setBusyId(finding.id);
    try {
      const updated = await updateTriage(finding.id, triageStatus, note ?? finding.triageNote, snoozedUntil);
      setAllFindings(prev => prev.map(f => (f.id === updated.id ? updated : f)));
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

  const filtered = useMemo(() => {
    let result = allFindings;
    if (triageFilter === 'open') {
      result = result.filter(f => f.triageStatus === 'active' || f.triageStatus === 'confirmed');
    } else if (triageFilter === 'triaged') {
      result = result.filter(f => f.triageStatus !== 'active');
    }
    if (severityFilter !== 'all') {
      result = result.filter(f => f.severity === severityFilter);
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
  }, [allFindings, severityFilter, searchQuery, triageFilter]);

  const triageCounts = useMemo(() => {
    let open = 0;
    let triaged = 0;
    for (const f of allFindings) {
      if (f.triageStatus === 'active' || f.triageStatus === 'confirmed') open += 1;
      if (f.triageStatus !== 'active') triaged += 1;
    }
    return { open, all: allFindings.length, triaged };
  }, [allFindings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
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

        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          {(['all', 'critical', 'high', 'medium', 'low', 'positive'] as const).map((sev) => {
            const isActive = severityFilter === sev;
            const color = sev === 'all' ? 'var(--text-muted)' : SEVERITY_TOKENS[sev].color;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                aria-pressed={isActive}
                className={`focus-ring px-2 py-1 rounded text-xs font-medium capitalize transition-all ${
                  isActive ? 'bg-border' : 'hover:bg-surface'
                }`}
                style={{ color: isActive ? color : 'var(--text-muted)' }}
              >
                {sev}
              </button>
            );
          })}
        </div>
      </div>

      <span className="text-2xs text-text-muted">
        {filtered.length} finding{filtered.length !== 1 ? 's' : ''} across {sessions.filter(s => s.status === 'complete').length} session{sessions.filter(s => s.status === 'complete').length !== 1 ? 's' : ''}
        {triageFilter === 'open' && triageCounts.triaged > 0 && (
          <> · {triageCounts.triaged} hidden by triage</>
        )}
      </span>

      {allFindings.length > 0 && <SeverityLegend />}

      {/* Findings list */}
      {filtered.length === 0 ? (
        allFindings.length === 0 ? (
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
            <Filter className="w-5 h-5 text-border-bright mb-2" />
            <p className="text-xs text-text-muted">No findings match your current filters.</p>
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

function FindingCard({
  finding,
  index,
  busy,
  onApply,
  onFixDispatched,
}: {
  finding: PlaytestFinding;
  index: number;
  busy: boolean;
  onApply: (
    finding: PlaytestFinding,
    triageStatus: TriageStatus,
    note?: string,
    snoozedUntil?: string | null,
  ) => Promise<void>;
  onFixDispatched: (finding: PlaytestFinding) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [draftNote, setDraftNote] = useState(finding.triageNote);
  const [pendingStatus, setPendingStatus] = useState<TriageStatus | null>(null);

  const token = SEVERITY_TOKENS[finding.severity];
  const Icon = token.icon;
  const catLabel = CATEGORY_LABELS[finding.category] ?? finding.category;
  const triageToken = TRIAGE_TOKENS[finding.triageStatus];
  const TriageIcon = triageToken.icon;
  const dimmed = finding.triageStatus === 'false-positive' || finding.triageStatus === 'ignore';

  const submit = async () => {
    if (!pendingStatus) return;
    let snoozedUntil: string | null | undefined;
    if (pendingStatus === 'snooze') {
      // Snooze for 7 days by default. The note field can be used to track intent.
      snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      snoozedUntil = null;
    }
    await onApply(finding, pendingStatus, draftNote, snoozedUntil);
    setShowNote(false);
    setPendingStatus(null);
  };

  const requestTriage = (status: TriageStatus) => {
    // For destructive states (false-positive / ignore / snooze), open the
    // note prompt so the user can record *why* before committing.
    if (status === 'confirmed' && !finding.triageNote && finding.triageStatus !== 'confirmed') {
      // Confirmed doesn't need a note prompt — apply immediately.
      void onApply(finding, status, finding.triageNote, null);
      return;
    }
    if (status === 'active') {
      void onApply(finding, status, '', null);
      return;
    }
    setPendingStatus(status);
    setDraftNote(finding.triageNote);
    setShowNote(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.4) }}
      className={`rounded-lg border px-3.5 py-3 ${dimmed ? 'opacity-60' : ''}`}
      style={severitySurface(finding.severity)}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-text">{finding.title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{catLabel}</span>
            {finding.relatedModule && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted-hover">{finding.relatedModule}</span>
            )}
            {finding.triageStatus !== 'active' && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded"
                style={{ color: triageToken.color, backgroundColor: `${triageToken.color}${OPACITY_12}`, border: `1px solid ${triageToken.color}${OPACITY_20}` }}
              >
                <TriageIcon className="w-2.5 h-2.5" aria-hidden="true" />
                {triageToken.label}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted-hover leading-relaxed mb-1.5">{finding.description}</p>
          {finding.suggestedFix && (
            <p className="text-sm text-text-muted leading-relaxed italic">
              Fix: {finding.suggestedFix}
            </p>
          )}
          {finding.triageNote && !showNote && (
            <p className="mt-1.5 text-xs text-text-muted bg-background border border-border rounded px-2 py-1">
              <span className="font-semibold text-text-muted-hover">Triage note:</span> {finding.triageNote}
            </p>
          )}
        </div>
        <span className="text-2xs text-text-muted flex-shrink-0">{finding.confidence}%</span>
      </div>

      {showNote ? (
        <div className="mt-2.5 flex items-end gap-2">
          <label className="flex-1 min-w-0">
            <span className="block text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">
              Note ({pendingStatus ? TRIAGE_TOKENS[pendingStatus].label : 'Triage'})
            </span>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Why is this triaged? (optional)"
              rows={2}
              className="focus-ring-inset w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-text outline-none focus:border-border-bright resize-none"
            />
          </label>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { void submit(); }}
              disabled={busy}
              aria-label="Save triage"
              className="focus-ring flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: `${STATUS_BLOCKER}${OPACITY_12}`, color: STATUS_BLOCKER, border: `1px solid ${STATUS_BLOCKER}${OPACITY_20}` }}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={() => { setShowNote(false); setPendingStatus(null); }}
              disabled={busy}
              aria-label="Cancel triage"
              className="focus-ring flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-text-muted hover:bg-surface transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap" role="group" aria-label="Triage actions">
          <TriageButton
            label="Confirm"
            icon={ShieldCheck}
            active={finding.triageStatus === 'confirmed'}
            color={STATUS_BLOCKER}
            disabled={busy}
            onClick={() => requestTriage('confirmed')}
          />
          <TriageButton
            label="False positive"
            icon={BellOff}
            active={finding.triageStatus === 'false-positive'}
            color={STATUS_INFO}
            disabled={busy}
            onClick={() => requestTriage('false-positive')}
          />
          <TriageButton
            label="Ignore"
            icon={EyeOff}
            active={finding.triageStatus === 'ignore'}
            color={'var(--text-muted)'}
            disabled={busy}
            onClick={() => requestTriage('ignore')}
          />
          <TriageButton
            label="Snooze 7d"
            icon={Clock}
            active={finding.triageStatus === 'snooze'}
            color={TRIAGE_TOKENS.snooze.color}
            disabled={busy}
            onClick={() => requestTriage('snooze')}
          />
          {finding.triageStatus !== 'active' && (
            <TriageButton
              label="Reset"
              icon={RotateCcw}
              active={false}
              color={'var(--text-muted)'}
              disabled={busy}
              onClick={() => requestTriage('active')}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

function TriageButton({
  label,
  icon: Icon,
  active,
  color,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ShieldCheck;
  active: boolean;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="focus-ring inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all disabled:opacity-40"
      style={
        active
          ? { backgroundColor: `${color}${OPACITY_20}`, color, border: `1px solid ${color}${OPACITY_20}` }
          : { color: 'var(--text-muted)', border: '1px solid transparent' }
      }
    >
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </button>
  );
}
