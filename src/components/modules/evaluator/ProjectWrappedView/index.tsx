'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, Copy, Check, Image as ImageIcon, Clock, Flame, Trophy,
  Loader2, RefreshCw, Rocket, Target, CalendarDays, Layers,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { formatDuration } from '@/lib/format';
import { UI_TIMEOUTS } from '@/lib/constants';
import {
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_PINK, ACCENT_CYAN, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_INFO, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import type { ProjectWrapped } from '@/types/project-wrapped';
import { FetchError } from '../../shared/FetchError';
import { HeroStat, MiniStat, TimelineRow } from './SubComponents';
import { monthLabel, spanCaption } from './helpers';
import { formatWrappedMarkdown } from './markdownExport';
import { renderWrappedToCanvas } from './canvasPoster';

// ── Main component ────────────────────────────────────────────────────────────

export function ProjectWrappedView() {
  const [wrapped, setWrapped] = useState<ProjectWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useIsMounted();

  const fetchWrapped = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ wrapped: ProjectWrapped }>('/api/project-wrapped');
      if (!isMounted()) return;
      setWrapped(data.wrapped);
    } catch (err) {
      if (!isMounted()) return;
      setError(err instanceof Error ? err.message : 'Failed to load project recap');
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [isMounted]);

  useEffect(() => { void fetchWrapped(); }, [fetchWrapped]);

  const handleCopy = useCallback(async () => {
    if (!wrapped) return;
    await navigator.clipboard.writeText(formatWrappedMarkdown(wrapped));
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [wrapped]);

  const handleExportImage = useCallback(async () => {
    if (!wrapped || !canvasRef.current) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 50));
    renderWrappedToCanvas(canvasRef.current, wrapped);
    canvasRef.current.toBlob((blob) => {
      if (!blob) { setExporting(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pof-wrapped-${(wrapped.lastSessionDate ?? wrapped.generatedAt).slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 'image/png');
  }, [wrapped]);

  if (loading && !wrapped) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error && !wrapped) {
    return <FetchError message={error} onRetry={fetchWrapped} />;
  }

  if (!wrapped || wrapped.totalSessions === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: ACCENT_VIOLET }} aria-hidden="true" />
        <p className="text-sm text-text font-medium">No journey to wrap up yet</p>
        <p className="text-2xs text-text-muted mt-1">
          Run a few module sessions and your lifetime recap will appear here.
        </p>
        <button
          onClick={fetchWrapped}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text bg-surface border border-border hover:border-border-bright transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" style={{ color: ACCENT_VIOLET }} aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-text">Project Wrapped</h2>
            <p className="text-2xs text-text-muted">{spanCaption(wrapped)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchWrapped}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title="Refresh"
            aria-label="Refresh recap"
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
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            Share as Image
          </button>
        </div>
      </div>

      {/* Celebratory hero */}
      <div
        className="relative overflow-hidden rounded-xl border border-border px-6 py-7"
        style={{ background: `linear-gradient(135deg, ${ACCENT_VIOLET}${OPACITY_20}, ${ACCENT_CYAN}${OPACITY_10} 60%, transparent)` }}
      >
        <p className="text-2xs uppercase tracking-[0.2em] text-text-muted mb-3">Your build, wrapped</p>
        <div className="grid grid-cols-2 gap-5">
          <HeroStat
            icon={Clock}
            color={ACCENT_VIOLET}
            value={formatDuration(wrapped.totalTimeMs)}
            label="invested"
          />
          <HeroStat
            icon={Rocket}
            color={ACCENT_PINK}
            value={wrapped.totalSessions.toLocaleString()}
            label={`sessions over ${wrapped.activeDays} active day${wrapped.activeDays === 1 ? '' : 's'}`}
          />
        </div>
      </div>

      {/* Secondary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat icon={Target} color={STATUS_SUCCESS} value={`${Math.round(wrapped.successRate * 100)}%`} label="Success rate" />
        <MiniStat icon={Layers} color={STATUS_INFO} value={`${wrapped.modulesConquered}`} label={`Conquered · ${wrapped.modulesTouched} explored`} />
        <MiniStat icon={Flame} color={ACCENT_ORANGE} value={`${wrapped.longestStreak}`} label="Best streak" />
        <MiniStat
          icon={CalendarDays}
          color={MODULE_COLORS.content}
          value={wrapped.biggestWeek ? `${wrapped.biggestWeek.sessions}` : '—'}
          label="Biggest week"
        />
      </div>

      {/* Milestone timeline */}
      {wrapped.milestones.length > 0 && (
        <div className="px-4 py-4 rounded-lg bg-surface border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-3.5 h-3.5" style={{ color: ACCENT_VIOLET }} aria-hidden="true" />
            <p className="text-xs font-medium text-text">Milestone timeline</p>
          </div>
          <ol className="relative ml-1.5 border-l border-border space-y-3">
            {wrapped.milestones.map((m, i) => (
              <TimelineRow key={`${m.type}-${m.date}-${i}`} milestone={m} />
            ))}
          </ol>
        </div>
      )}

      {/* Top modules */}
      {wrapped.topModules.length > 0 && (
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-2">Modules conquered</p>
          <div className="space-y-1.5">
            {wrapped.topModules.map((m, i) => {
              const max = wrapped.topModules[0].sessions;
              const barWidth = max > 0 ? (m.sessions / max) * 100 : 0;
              const color = m.successRate >= 0.75 ? MODULE_COLORS.setup : m.successRate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;
              return (
                <div key={m.moduleId} className="flex items-center gap-2">
                  <span className="w-4 text-2xs text-text-muted text-right tabular-nums">{i + 1}</span>
                  <span className="text-xs text-text w-32 truncate" title={m.label}>{m.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-2xs text-text-muted tabular-nums w-10 text-right">{m.sessions}</span>
                  <span className="text-2xs tabular-nums w-10 text-right" style={{ color }}>{Math.round(m.successRate * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly activity arc */}
      {wrapped.monthlyActivity.length > 1 && (
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-2">Activity over time</p>
          <div className="flex items-end gap-1 h-14">
            {wrapped.monthlyActivity.map((mo) => {
              const max = Math.max(...wrapped.monthlyActivity.map((x) => x.sessions), 1);
              const height = mo.sessions > 0 ? Math.max(3, (mo.sessions / max) * 56) : 2;
              const rate = mo.sessions > 0 ? mo.success / mo.sessions : 0;
              const color = mo.sessions === 0 ? 'var(--border)' : rate >= 0.75 ? MODULE_COLORS.setup : rate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;
              return (
                <div
                  key={mo.month}
                  className="flex-1 rounded-sm"
                  style={{ height: `${height}px`, backgroundColor: color, opacity: mo.sessions === 0 ? 0.4 : 0.85 }}
                  role="img"
                  aria-label={`${monthLabel(mo.month)}: ${mo.sessions} sessions`}
                  title={`${monthLabel(mo.month)}: ${mo.sessions} sessions`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-2xs text-text-muted">
            <span>{monthLabel(wrapped.monthlyActivity[0].month)}</span>
            <span>{monthLabel(wrapped.monthlyActivity[wrapped.monthlyActivity.length - 1].month)}</span>
          </div>
        </div>
      )}

      {/* Achievements */}
      {wrapped.achievements.length > 0 && (
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-2">Top achievements</p>
          <div className="flex flex-wrap gap-2">
            {wrapped.achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-background border border-border text-xs"
                title={a.description}
              >
                <span aria-hidden="true">{a.icon}</span>
                <span className="text-text font-medium">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" width={800} height={1000} />
    </div>
  );
}
