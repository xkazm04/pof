'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Calendar, Copy, Check, Image, Flame, Clock, BarChart3, Zap, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { MetricCard } from '@/components/ui/MetricCard';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import type { WeeklyDigest } from '@/types/weekly-digest';
import { UI_TIMEOUTS } from '@/lib/constants';
import { formatDuration } from '@/lib/format';
import { STATUS_INFO, MODULE_COLORS, ACCENT_VIOLET, STATUS_SUCCESS, ACCENT_ORANGE } from '@/lib/chart-colors';
import { FetchError } from '@/components/modules/shared/FetchError';
import type { CompletionLedger } from '@/lib/roadmap/completion-ledger';
import { EMPTY_PROGRESS } from './constants';
import { formatDateRange, formatDigestMarkdown, renderDigestToCanvas } from './helpers';
import { weekLanded, digestWindows } from './weekLanded';
import { DailyActivity } from './DailyActivity';
import { ModuleLeaderboard } from './ModuleLeaderboard';
import { LandedList } from './LandedList';

const EMPTY_LEDGER: CompletionLedger = {};
/** Furthest week back the stepper goes (the route accepts weeksAgo 0-52). */
const MAX_WEEKS_AGO = 52;
const STEP_BTN = 'p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:pointer-events-none';

// ── Main component ──────────────────────────────────────────────────────────

export function WeeklyDigestView() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useIsMounted();
  /** 0 = the current week; N = N weeks back. */
  const [weeksAgo, setWeeksAgo] = useState(0);
  const requestSeq = useRef(0);

  const checklistProgress = useModuleStore((s) => s.checklistProgress) || EMPTY_PROGRESS;
  const completionLedger = useModuleStore((s) => s.checklistCompletedAt) || EMPTY_LEDGER;

  // What landed in the viewed week, from the dated completion ledger (never the
  // all-time done count stamped onto whatever week is shown).
  const landed = useMemo(() => {
    if (!digest) return null;
    const { window, prevWindow } = digestWindows(digest);
    return weekLanded(checklistProgress, completionLedger, window, prevWindow);
  }, [digest, checklistProgress, completionLedger]);

  // Fetch digest - the latest request wins, so fast stepping never shows a stale week.
  const fetchDigest = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const url = weeksAgo === 0 ? '/api/weekly-digest' : `/api/weekly-digest?weeksAgo=${weeksAgo}`;
      const data = await apiFetch<{ digest: WeeklyDigest }>(url);
      if (!isMounted() || seq !== requestSeq.current) return;
      setDigest(data.digest);
    } catch (err) {
      if (!isMounted() || seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load weekly digest');
    } finally {
      if (isMounted() && seq === requestSeq.current) setLoading(false);
    }
  }, [weeksAgo, isMounted]);

  useEffect(() => { void fetchDigest(); }, [fetchDigest]);

  // ── Copy as Markdown ──
  const handleCopy = useCallback(async () => {
    if (!digest) return;
    const md = formatDigestMarkdown(digest, landed ?? undefined);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [digest, landed]);

  // ── Export as PNG ──
  const handleExportImage = useCallback(async () => {
    if (!digest || !canvasRef.current) return;
    setExporting(true);

    // Small delay to ensure canvas is available
    await new Promise((r) => setTimeout(r, 50));
    renderDigestToCanvas(canvasRef.current, digest, landed ?? undefined);

    canvasRef.current.toBlob((blob) => {
      if (!blob) { setExporting(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pof-weekly-${digest.periodStart}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 'image/png');
  }, [digest, landed]);

  if (loading && !digest) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error && !digest) {
    return <FetchError message={error} onRetry={fetchDigest} />;
  }

  if (!digest) {
    return (
      <div className="text-center py-20 text-text-muted text-sm">
        Could not load digest data.
      </div>
    );
  }

  const sessionDelta = digest.totalSessions - digest.prevWeekSessions;
  const rateDelta = digest.successRate - digest.prevWeekSuccessRate;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5" style={{ color: ACCENT_VIOLET }} />
          <div>
            <h2 className="text-base font-semibold text-text">Weekly Progress Digest</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeeksAgo((w) => Math.min(MAX_WEEKS_AGO, w + 1))}
                disabled={weeksAgo >= MAX_WEEKS_AGO}
                className={STEP_BTN}
                aria-label="Previous week"
                title="Previous week"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <p className="text-2xs text-text-muted tabular-nums">
                {formatDateRange(digest.periodStart, digest.periodEnd)}
                {weeksAgo > 0 && ` · ${weeksAgo === 1 ? 'last week' : `${weeksAgo} weeks ago`}`}
              </p>
              <button
                onClick={() => setWeeksAgo((w) => Math.max(0, w - 1))}
                disabled={weeksAgo === 0}
                className={STEP_BTN}
                aria-label="Next week"
                title="Next week"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchDigest}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text bg-surface border border-border hover:border-border-bright transition-colors"
          >
            {copied ? <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text bg-surface border border-border hover:border-border-bright transition-colors disabled:opacity-40"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
            Share as Image
          </button>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Sessions"
          value={digest.totalSessions.toString()}
          delta={sessionDelta}
          icon={BarChart3}
          accent={STATUS_INFO}
        />
        <MetricCard
          label="Success Rate"
          value={`${Math.round(digest.successRate * 100)}%`}
          delta={Math.round(rateDelta * 100)}
          deltaSuffix="%"
          icon={Zap}
          accent={MODULE_COLORS.setup}
        />
        <MetricCard
          label="Checklist"
          value={`${landed?.count ?? 0} landed`}
          delta={landed?.delta ?? undefined}
          icon={Check}
          accent={ACCENT_VIOLET}
        />
        <MetricCard
          label="Time Invested"
          value={formatDuration(digest.totalTimeMs)}
          icon={Clock}
          accent={MODULE_COLORS.content}
        />
      </div>

      {/* Streaks */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: ACCENT_ORANGE }} />
          <span className="text-xs text-text">Current streak</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT_ORANGE }}>{digest.currentStreak}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-text">Best streak</span>
          <span className="text-sm font-bold text-text tabular-nums">{digest.longestStreak}</span>
        </div>
      </div>

      {/* What landed in the viewed week */}
      {landed && <LandedList landed={landed} checklistTotal={digest.checklistTotal} zone={digest.zone} />}

      {/* Daily activity sparkline */}
      <DailyActivity dailySessions={digest.dailySessions} />

      {/* Most active module */}
      {digest.mostActiveModule && (
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-1">Most active module</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">{digest.mostActiveModule.label}</span>
            <span className="text-xs text-text-muted tabular-nums">{digest.mostActiveModule.sessions} sessions</span>
          </div>
        </div>
      )}

      {/* Module leaderboard */}
      {digest.moduleActivity.length > 1 && (
        <ModuleLeaderboard moduleActivity={digest.moduleActivity} />
      )}

      {/* Achievements */}
      {digest.achievements.length > 0 && (
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-2">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {digest.achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-background border border-border text-xs"
                title={a.description}
              >
                <span>{a.icon}</span>
                <span className="text-text font-medium">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" width={800} height={600} />
    </div>
  );
}
