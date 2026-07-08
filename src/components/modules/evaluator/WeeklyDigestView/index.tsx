'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Calendar, Copy, Check, Image, Flame, Clock, BarChart3, Zap, Loader2, RefreshCw,
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
import { MODULE_ITEM_IDS, EMPTY_PROGRESS } from './constants';
import { formatDateRange, formatDigestMarkdown, renderDigestToCanvas } from './helpers';
import { DailyActivity } from './DailyActivity';
import { ModuleLeaderboard } from './ModuleLeaderboard';

// ── Main component ──────────────────────────────────────────────────────────

export function WeeklyDigestView() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useIsMounted();

  const checklistProgress = useModuleStore((s) => s.checklistProgress) || EMPTY_PROGRESS;

  // Compute checklist completed from client store
  const checklistCompleted = useMemo(() => {
    let completed = 0;
    for (const [moduleId, items] of Object.entries(MODULE_ITEM_IDS)) {
      const progress = checklistProgress[moduleId];
      if (!progress) continue;
      for (const id of items) {
        if (progress[id]) completed++;
      }
    }
    return completed;
  }, [checklistProgress]);

  // Fetch digest
  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ digest: WeeklyDigest }>('/api/weekly-digest');
      if (!isMounted()) return;
      const d = data.digest;
      d.checklistCompleted = checklistCompleted;
      setDigest(d);
    } catch (err) {
      if (!isMounted()) return;
      setError(err instanceof Error ? err.message : 'Failed to load weekly digest');
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [checklistCompleted, isMounted]);

  useEffect(() => { void fetchDigest(); }, [fetchDigest]);

  // ── Copy as Markdown ──
  const handleCopy = useCallback(async () => {
    if (!digest) return;
    const md = formatDigestMarkdown(digest);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [digest]);

  // ── Export as PNG ──
  const handleExportImage = useCallback(async () => {
    if (!digest || !canvasRef.current) return;
    setExporting(true);

    // Small delay to ensure canvas is available
    await new Promise((r) => setTimeout(r, 50));
    renderDigestToCanvas(canvasRef.current, digest);

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
  }, [digest]);

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
            <p className="text-2xs text-text-muted">
              {formatDateRange(digest.periodStart, digest.periodEnd)}
            </p>
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
          value={`${digest.checklistCompleted}/${digest.checklistTotal}`}
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
