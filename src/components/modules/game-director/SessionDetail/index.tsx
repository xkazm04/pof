'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Play, Trash2, Loader2,
  Clock, Target,
  Gamepad2, Camera, BarChart3, Activity,
} from 'lucide-react';
import type { PlaytestFinding, DirectorEvent } from '@/types/game-director';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ACCENT_PURPLE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  OPACITY_10,
} from '@/lib/chart-colors';
import { formatDuration } from '@/lib/format';
import { NOT_MEASURED, resolveSessionSource } from '@/lib/game-director-styles';
import { ProvenanceNotice, sessionScoreRingLabel } from '../ProvenanceNotice';
import { ACCENT } from './constants';
import type { DetailTab, SessionDetailProps } from './types';
import { SummaryStat } from './SummaryStat';
import { FindingsList } from './FindingsList';
import { TimelineView } from './TimelineView';
import { CoverageView } from './CoverageView';

export function SessionDetail({
  session,
  onBack,
  onSimulate,
  onDelete,
  simulating,
  getFindings,
  getEvents,
  markFixDispatched,
}: SessionDetailProps) {
  const [findings, setFindings] = useState<PlaytestFinding[]>([]);
  const [events, setEvents] = useState<DirectorEvent[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('findings');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  // Deleting a session also drops its findings/events, and nothing restores it —
  // so the trash button opens a confirmation instead of firing immediately.
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      const [f, e] = await Promise.all([getFindings(session.id), getEvents(session.id)]);
      if (!cancelled) {
        setFindings(f);
        setEvents(e);
        setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
    // session.status / completedAt are in the deps so a playtest that finishes
    // (or a re-run, which restamps completedAt) refetches — session.id alone
    // never changes across a simulate, so the header showed "N findings" while
    // the Findings/Timeline tabs stayed empty until the user left and re-entered.
  }, [session.id, session.status, session.completedAt, getFindings, getEvents]);

  // After a one-click fix is dispatched, stamp the finding so the UI reflects
  // the detect→fix link (best-effort — the CLI task is already running).
  const handleFixDispatched = useCallback(async (finding: PlaytestFinding) => {
    try {
      const updated = await markFixDispatched(finding.id);
      setFindings(prev => prev.map(f => (f.id === updated.id ? updated : f)));
    } catch {
      // tracking is best-effort; the repair task has already been dispatched
    }
  }, [markFixDispatched]);

  const isComplete = session.status === 'complete';
  const canSimulate = session.status === 'configuring' || session.status === 'complete';
  const source = resolveSessionSource(session);

  // Group findings by severity
  const criticals = findings.filter(f => f.severity === 'critical');
  const highs = findings.filter(f => f.severity === 'high');
  const mediums = findings.filter(f => f.severity === 'medium');
  const lows = findings.filter(f => f.severity === 'low');
  const positives = findings.filter(f => f.severity === 'positive');

  const tabs: TabItem<DetailTab>[] = [
    { id: 'findings', label: 'Findings', icon: Target, badge: { count: findings.length } },
    { id: 'timeline', label: 'Timeline', icon: Activity, badge: { count: events.length } },
    { id: 'coverage', label: 'Coverage', icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            aria-label="Back to overview"
            className="focus-ring p-1.5 rounded-md hover:bg-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-text truncate">{session.name}</h1>
            <p className="text-xs text-text-muted">
              {new Date(session.createdAt).toLocaleString()}
              {/* `durationMs && …` leaked a bare "0" for a zero-length run, and a
                  raw seconds count read poorly past a minute — formatDuration owns both. */}
              {session.durationMs != null && session.durationMs > 0 && ` · ran for ${formatDuration(session.durationMs)}`}
            </p>
          </div>

          {/* Score badge */}
          {session.summary && (
            <div className="flex items-center gap-2">
              <ScoreRing
                value={session.summary.overallScore}
                size={40}
                strokeWidth={3}
                ariaLabel={sessionScoreRingLabel(session.summary.overallScore, session)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canSimulate && (
              <button
                onClick={onSimulate}
                disabled={simulating}
                className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${ACCENT}15`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}30`,
                }}
              >
                {simulating ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Play className="w-3 h-3" aria-hidden="true" />}
                {/* This button runs the simulator, not a playtest. It says so. */}
                {simulating ? 'Simulating…' : isComplete ? 'Re-simulate' : 'Simulate Playtest'}
              </button>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete session"
              className="focus-ring p-1.5 rounded-md text-text-muted transition-colors group/del"
              style={{ ['--del-color' as string]: STATUS_ERROR }}
              onMouseEnter={(e) => { e.currentTarget.style.color = STATUS_ERROR; e.currentTarget.style.backgroundColor = `${STATUS_ERROR}${OPACITY_10}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.backgroundColor = ''; }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Provenance banner — above the numbers, not tucked under them. */}
        {session.summary && (
          <ProvenanceNotice
            source={source}
            findingsCount={source === 'simulated' ? session.findingsCount : undefined}
            className="mb-3"
          />
        )}

        {/* Summary strip */}
        {session.summary && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 px-3.5 py-2.5 bg-surface border border-border rounded-lg mb-4"
          >
            <SummaryStat icon={Target} label="Findings" value={session.findingsCount} color={STATUS_INFO} />
            <SummaryStat icon={Gamepad2} label="Systems" value={session.systemsTestedCount} color={ACCENT} />
            {/* Null means the figure was never measured — it renders as words, not
                as a plausible-looking count. */}
            <SummaryStat
              icon={Camera}
              label="Screenshots"
              value={session.summary.totalScreenshotsAnalyzed ?? NOT_MEASURED}
              muted={session.summary.totalScreenshotsAnalyzed == null}
              color={ACCENT_PURPLE}
            />
            <SummaryStat
              icon={Clock}
              label="Playtime"
              value={
                session.summary.playtimeSeconds != null
                  ? `${Math.floor(session.summary.playtimeSeconds / 60)}m`
                  : NOT_MEASURED
              }
              muted={session.summary.playtimeSeconds == null}
              color={STATUS_WARNING}
            />
            <div className="ml-auto flex items-center gap-3 text-2xs">
              {criticals.length > 0 && (
                <span style={{ color: STATUS_ERROR }}>{criticals.length} critical</span>
              )}
              {positives.length > 0 && (
                <span style={{ color: STATUS_SUCCESS }}>{positives.length} positive</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Sub-tabs */}
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          layoutId="session-detail-tab-indicator"
          accent={ACCENT}
          ariaLabel="Session detail views"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loadingData ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-xs text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Loading findings and timeline…
          </div>
        ) : (
          <>
            {activeTab === 'findings' && (
              <FindingsList
                findings={findings}
                expandedId={expandedFindingId}
                onToggle={(id) => setExpandedFindingId(expandedFindingId === id ? null : id)}
                onFixDispatched={handleFixDispatched}
              />
            )}
            {activeTab === 'timeline' && <TimelineView events={events} onSimulate={canSimulate ? onSimulate : undefined} />}
            {activeTab === 'coverage' && <CoverageView session={session} findings={findings} onSimulate={canSimulate ? onSimulate : undefined} />}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { void onDelete(); }}
        title="Delete this playtest session?"
        description={`This permanently deletes "${session.name}" along with its ${session.findingsCount} finding${session.findingsCount !== 1 ? 's' : ''} and timeline events. This cannot be undone.`}
        confirmLabel="Delete session"
      />
    </div>
  );
}
