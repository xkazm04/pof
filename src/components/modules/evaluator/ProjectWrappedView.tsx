'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, Copy, Check, Image as ImageIcon, Clock, Flame, Trophy,
  Loader2, RefreshCw, Rocket, Target, CalendarDays, Layers,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { roundRect } from '@/lib/canvas-poster';
import { formatDuration } from '@/lib/format';
import { UI_TIMEOUTS } from '@/lib/constants';
import {
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_PINK, ACCENT_CYAN, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_INFO, OVERLAY_WHITE, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import type { ProjectWrapped, WrappedMilestone } from '@/types/project-wrapped';
import { FetchError } from '../shared/FetchError';

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function HeroStat({ icon: Icon, color, value, label }: {
  icon: typeof Clock; color: string; value: string; label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="text-3xl font-bold text-text tabular-nums leading-none" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted mt-1.5">{label}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, color, value, label }: {
  icon: typeof Clock; color: string; value: string; label: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-surface border border-border">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} aria-hidden="true" />
        <span className="text-2xs text-text-muted truncate">{label}</span>
      </div>
      <div className="text-lg font-bold text-text tabular-nums">{value}</div>
    </div>
  );
}

function TimelineRow({ milestone }: { milestone: WrappedMilestone }) {
  return (
    <li className="ml-4">
      <span
        className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full border-2 border-background"
        style={{ backgroundColor: ACCENT_VIOLET }}
        aria-hidden="true"
      />
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true">{milestone.icon}</span>
        <span className="text-xs font-medium text-text">{milestone.title}</span>
        <span className="text-2xs text-text-muted ml-auto tabular-nums">{formatLongDate(milestone.date)}</span>
      </div>
      <p className="text-2xs text-text-muted mt-0.5">{milestone.description}</p>
    </li>
  );
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function formatLongDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

function spanCaption(w: ProjectWrapped): string {
  if (!w.firstSessionDate || !w.lastSessionDate) return 'Lifetime recap';
  const first = monthLabel(w.firstSessionDate.slice(0, 7));
  const last = monthLabel(w.lastSessionDate.slice(0, 7));
  const range = first === last ? first : `${first} — ${last}`;
  return `${range} · ${w.spanDays} day${w.spanDays === 1 ? '' : 's'}`;
}

// ── Markdown export ────────────────────────────────────────────────────────────

function formatWrappedMarkdown(w: ProjectWrapped): string {
  const lines: string[] = [];
  lines.push('# POF Project Wrapped');
  lines.push(`**${spanCaption(w)}**`);
  lines.push('');
  lines.push('## Lifetime');
  lines.push(`- **Time invested:** ${formatDuration(w.totalTimeMs)}`);
  lines.push(`- **Sessions:** ${w.totalSessions.toLocaleString()} across ${w.activeDays} active days`);
  lines.push(`- **Success rate:** ${Math.round(w.successRate * 100)}%`);
  lines.push(`- **Modules conquered:** ${w.modulesConquered} (of ${w.modulesTouched} explored)`);
  lines.push(`- **Best streak:** ${w.longestStreak} consecutive successes`);
  if (w.biggestWeek) {
    lines.push(`- **Biggest week:** ${w.biggestWeek.sessions} sessions (week of ${formatLongDate(w.biggestWeek.weekStart)})`);
  }
  lines.push('');

  if (w.milestones.length > 0) {
    lines.push('## Milestones');
    for (const m of w.milestones) {
      lines.push(`- ${m.icon} **${m.title}** — ${m.description} _(${formatLongDate(m.date)})_`);
    }
    lines.push('');
  }

  if (w.topModules.length > 0) {
    lines.push('## Modules');
    for (const m of w.topModules) {
      lines.push(`- ${m.label}: ${m.sessions} sessions (${Math.round(m.successRate * 100)}% success)`);
    }
    lines.push('');
  }

  if (w.achievements.length > 0) {
    lines.push('## Achievements');
    for (const a of w.achievements) {
      lines.push(`- ${a.icon} **${a.title}** — ${a.description}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by POF*');
  return lines.join('\n');
}

// ── Canvas PNG rendering (portrait 4:5 share poster) ──────────────────────────

function renderWrappedToCanvas(canvas: HTMLCanvasElement, w: ProjectWrapped): void {
  const W = 800;
  const H = 1000;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const SANS = 'system-ui, -apple-system, sans-serif';

  // Background + celebratory gradient
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `${ACCENT_VIOLET}${OPACITY_20}`);
  grad.addColorStop(0.5, `${ACCENT_PINK}${OPACITY_8}`);
  grad.addColorStop(1, `${ACCENT_CYAN}${OPACITY_10}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `${OVERLAY_WHITE}${OPACITY_8}`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Confetti accents (deterministic — index-derived, no RNG)
  const confetti = [ACCENT_VIOLET, ACCENT_PINK, ACCENT_CYAN, ACCENT_ORANGE, STATUS_SUCCESS];
  for (let i = 0; i < 24; i++) {
    const cx = ((i * 137) % (W - 80)) + 40;
    const cy = 24 + ((i * 53) % 90);
    ctx.fillStyle = `${confetti[i % confetti.length]}${OPACITY_20}`;
    ctx.beginPath();
    ctx.arc(cx, cy, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  let y = 130;

  // Title
  ctx.textAlign = 'center';
  ctx.font = `bold 44px ${SANS}`;
  ctx.fillStyle = OVERLAY_WHITE;
  ctx.fillText('PROJECT WRAPPED', W / 2, y);
  y += 30;
  ctx.font = `15px ${SANS}`;
  ctx.fillStyle = '#9aa0aa';
  ctx.fillText(spanCaption(w), W / 2, y);
  y += 46;

  // Hero numbers (two columns)
  const heroes = [
    { value: formatDuration(w.totalTimeMs), label: 'TIME INVESTED', color: ACCENT_VIOLET },
    { value: w.totalSessions.toLocaleString(), label: 'SESSIONS', color: ACCENT_PINK },
  ];
  for (let i = 0; i < heroes.length; i++) {
    const cx = i === 0 ? W * 0.3 : W * 0.7;
    ctx.font = `bold 52px ${SANS}`;
    ctx.fillStyle = heroes[i].color;
    ctx.fillText(heroes[i].value, cx, y);
    ctx.font = `12px ${SANS}`;
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText(heroes[i].label, cx, y + 24);
  }
  y += 70;

  // Secondary stat boxes (4 across)
  ctx.textAlign = 'left';
  const stats = [
    { label: 'Success rate', value: `${Math.round(w.successRate * 100)}%`, color: STATUS_SUCCESS },
    { label: 'Conquered', value: `${w.modulesConquered}`, color: STATUS_INFO },
    { label: 'Best streak', value: `${w.longestStreak}`, color: ACCENT_ORANGE },
    { label: 'Biggest week', value: w.biggestWeek ? `${w.biggestWeek.sessions}` : '—', color: MODULE_COLORS.content },
  ];
  const boxW = (W - 80 - 36) / 4;
  for (let i = 0; i < stats.length; i++) {
    const x = 40 + i * (boxW + 12);
    ctx.fillStyle = `${OVERLAY_WHITE}${OPACITY_5}`;
    roundRect(ctx, x, y, boxW, 64, 10);
    ctx.fill();
    ctx.font = `11px ${SANS}`;
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText(stats[i].label, x + 12, y + 22);
    ctx.font = `bold 22px ${SANS}`;
    ctx.fillStyle = stats[i].color;
    ctx.fillText(stats[i].value, x + 12, y + 50);
  }
  y += 96;

  // Milestones (top 5)
  if (w.milestones.length > 0) {
    ctx.font = `13px ${SANS}`;
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText('MILESTONES', 40, y);
    y += 22;
    for (const m of w.milestones.slice(0, 5)) {
      ctx.font = `16px ${SANS}`;
      ctx.fillStyle = OVERLAY_WHITE;
      ctx.fillText(m.icon, 40, y + 4);
      ctx.font = `13px ${SANS}`;
      ctx.fillStyle = '#dddddd';
      ctx.fillText(m.title, 70, y + 4);
      ctx.fillStyle = '#777777';
      ctx.textAlign = 'right';
      ctx.fillText(formatLongDate(m.date), W - 40, y + 4);
      ctx.textAlign = 'left';
      y += 28;
    }
    y += 14;
  }

  // Top modules (top 5 bars)
  if (w.topModules.length > 0) {
    ctx.font = `13px ${SANS}`;
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText('MODULES CONQUERED', 40, y);
    y += 22;
    const max = w.topModules[0].sessions;
    for (const m of w.topModules.slice(0, 5)) {
      const barW = max > 0 ? (m.sessions / max) * (W - 320) : 0;
      const color = m.successRate >= 0.75 ? MODULE_COLORS.setup : m.successRate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;
      ctx.font = `13px ${SANS}`;
      ctx.fillStyle = '#cccccc';
      ctx.fillText(truncate(ctx, m.label, 200), 40, y + 12);
      ctx.fillStyle = color;
      roundRect(ctx, 250, y + 2, Math.max(2, barW), 13, 3);
      ctx.fill();
      ctx.fillStyle = '#9aa0aa';
      ctx.fillText(`${m.sessions}`, 250 + Math.max(2, barW) + 8, y + 13);
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(m.successRate * 100)}%`, W - 40, y + 13);
      ctx.textAlign = 'left';
      y += 24;
    }
    y += 14;
  }

  // Achievements pills (top 8, wrapping)
  if (w.achievements.length > 0) {
    ctx.font = `13px ${SANS}`;
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText('TOP ACHIEVEMENTS', 40, y);
    y += 20;
    let ax = 40;
    for (const a of w.achievements.slice(0, 8)) {
      const text = `${a.icon} ${a.title}`;
      ctx.font = `13px ${SANS}`;
      const tw = ctx.measureText(text).width + 22;
      if (ax + tw > W - 40) { ax = 40; y += 32; }
      ctx.fillStyle = `${OVERLAY_WHITE}${OPACITY_5}`;
      roundRect(ctx, ax, y - 4, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#dddddd';
      ctx.fillText(text, ax + 11, y + 13);
      ax += tw + 8;
    }
    y += 30;
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.font = `11px ${SANS}`;
  ctx.fillStyle = '#555555';
  ctx.fillText(`Generated by POF · ${formatLongDate(w.generatedAt.slice(0, 10))}`, W / 2, H - 24);
  ctx.textAlign = 'left';
}

/** Truncate a label with an ellipsis to fit `maxW` px in the current ctx font. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
