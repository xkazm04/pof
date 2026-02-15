'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Calendar, Copy, Check, Image, TrendingUp, TrendingDown,
  Minus, Flame, Clock, BarChart3, Zap, Loader2, RefreshCw,
} from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { SUB_MODULES, MODULE_LABELS } from '@/lib/module-registry';
import type { WeeklyDigest } from '@/types/weekly-digest';

// ── Precompute checklist item IDs (static) ──
const MODULE_ITEM_IDS: Record<string, string[]> = Object.fromEntries(
  SUB_MODULES
    .filter((m) => m.checklist && m.checklist.length > 0)
    .map((m) => [m.id, m.checklist!.map((c) => c.id)]),
);

const EMPTY_PROGRESS: Record<string, Record<string, boolean>> = {};

// ── Main component ──────────────────────────────────────────────────────────

export function WeeklyDigestView() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    try {
      const res = await fetch('/api/weekly-digest');
      const data = await res.json();
      if (data.ok) {
        const d = data.digest as WeeklyDigest;
        d.checklistCompleted = checklistCompleted;
        setDigest(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [checklistCompleted]);

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  // ── Copy as Markdown ──
  const handleCopy = useCallback(async () => {
    if (!digest) return;
    const md = formatDigestMarkdown(digest);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
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
          <Calendar className="w-5 h-5 text-[#a78bfa]" />
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
            {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
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
        <StatCard
          label="Sessions"
          value={digest.totalSessions.toString()}
          delta={sessionDelta}
          icon={BarChart3}
          color="#60a5fa"
        />
        <StatCard
          label="Success Rate"
          value={`${Math.round(digest.successRate * 100)}%`}
          delta={Math.round(rateDelta * 100)}
          suffix="%"
          icon={Zap}
          color="#00ff88"
        />
        <StatCard
          label="Checklist"
          value={`${digest.checklistCompleted}/${digest.checklistTotal}`}
          icon={Check}
          color="#a78bfa"
        />
        <StatCard
          label="Time Invested"
          value={formatDuration(digest.totalTimeMs)}
          icon={Clock}
          color="#f59e0b"
        />
      </div>

      {/* Streaks */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#f97316]" />
          <span className="text-xs text-text">Current streak</span>
          <span className="text-sm font-bold text-[#f97316] tabular-nums">{digest.currentStreak}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-text">Best streak</span>
          <span className="text-sm font-bold text-text tabular-nums">{digest.longestStreak}</span>
        </div>
      </div>

      {/* Daily activity sparkline */}
      <div className="px-4 py-3 rounded-lg bg-surface border border-border">
        <p className="text-2xs text-text-muted mb-2">Daily activity</p>
        <div className="flex items-end gap-1.5 h-12">
          {digest.dailySessions.map((d) => {
            const maxSessions = Math.max(...digest.dailySessions.map((x) => x.total), 1);
            const height = d.total > 0 ? Math.max(4, (d.total / maxSessions) * 48) : 2;
            const rate = d.total > 0 ? d.success / d.total : 0;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${height}px`,
                    backgroundColor: d.total === 0
                      ? 'var(--border)'
                      : rate >= 0.75 ? '#00ff88' : rate >= 0.5 ? '#f59e0b' : '#ef4444',
                    opacity: d.total === 0 ? 0.3 : 0.8,
                  }}
                  title={`${d.date}: ${d.total} sessions, ${d.success} successful`}
                />
                <span className="text-2xs text-text-muted">
                  {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
        <div className="px-4 py-3 rounded-lg bg-surface border border-border">
          <p className="text-2xs text-text-muted mb-2">Module activity</p>
          <div className="space-y-1.5">
            {digest.moduleActivity.slice(0, 8).map((m, i) => {
              const maxSessions = digest.moduleActivity[0].sessions;
              const barWidth = maxSessions > 0 ? (m.sessions / maxSessions) * 100 : 0;
              return (
                <div key={m.moduleId} className="flex items-center gap-2">
                  <span className="w-4 text-2xs text-text-muted text-right tabular-nums">{i + 1}</span>
                  <span className="text-xs text-text w-32 truncate">{m.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: m.successRate >= 0.75 ? '#00ff88' : m.successRate >= 0.5 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-2xs text-text-muted tabular-nums w-8 text-right">{m.sessions}</span>
                  <span className="text-2xs tabular-nums w-8 text-right" style={{
                    color: m.successRate >= 0.75 ? '#00ff88' : m.successRate >= 0.5 ? '#f59e0b' : '#ef4444',
                  }}>
                    {Math.round(m.successRate * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, delta, suffix, icon: Icon, color }: {
  label: string;
  value: string;
  delta?: number;
  suffix?: string;
  icon: typeof BarChart3;
  color: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-surface border border-border">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-2xs text-text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-text tabular-nums">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center gap-0.5 text-2xs ${delta > 0 ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>
            {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
            {delta > 0 ? '+' : ''}{delta}{suffix ?? ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  e.setDate(e.getDate() - 1); // end is exclusive
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en', opts)} — ${e.toLocaleDateString('en', opts)}, ${s.getFullYear()}`;
}

// ── Markdown export ──────────────────────────────────────────────────────────

function formatDigestMarkdown(d: WeeklyDigest): string {
  const lines: string[] = [];
  lines.push(`# POF Weekly Digest`);
  lines.push(`**${formatDateRange(d.periodStart, d.periodEnd)}**`);
  lines.push('');
  lines.push(`## Stats`);
  lines.push(`- **Sessions:** ${d.totalSessions} (${d.totalSessions - d.prevWeekSessions >= 0 ? '+' : ''}${d.totalSessions - d.prevWeekSessions} vs last week)`);
  lines.push(`- **Success Rate:** ${Math.round(d.successRate * 100)}%`);
  lines.push(`- **Checklist:** ${d.checklistCompleted}/${d.checklistTotal}`);
  lines.push(`- **Time Invested:** ${formatDuration(d.totalTimeMs)}`);
  lines.push(`- **Current Streak:** ${d.currentStreak} | **Best:** ${d.longestStreak}`);
  lines.push('');

  if (d.mostActiveModule) {
    lines.push(`## Most Active`);
    lines.push(`**${d.mostActiveModule.label}** — ${d.mostActiveModule.sessions} sessions`);
    lines.push('');
  }

  if (d.moduleActivity.length > 0) {
    lines.push(`## Module Activity`);
    for (const m of d.moduleActivity.slice(0, 8)) {
      lines.push(`- ${m.label}: ${m.sessions} sessions (${Math.round(m.successRate * 100)}% success)`);
    }
    lines.push('');
  }

  if (d.achievements.length > 0) {
    lines.push(`## Achievements`);
    for (const a of d.achievements) {
      lines.push(`- ${a.icon} **${a.title}** — ${a.description}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by POF*');

  return lines.join('\n');
}

// ── Canvas PNG rendering ─────────────────────────────────────────────────────

function renderDigestToCanvas(canvas: HTMLCanvasElement, d: WeeklyDigest): void {
  const W = 800;
  const H = 600;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);

  // Subtle gradient overlay
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'rgba(167, 139, 250, 0.06)');
  grad.addColorStop(1, 'rgba(0, 255, 136, 0.04)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  let y = 40;

  // Title
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('POF Weekly Digest', 40, y);
  y += 28;

  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText(formatDateRange(d.periodStart, d.periodEnd), 40, y);
  y += 40;

  // Stat boxes
  const stats = [
    { label: 'Sessions', value: d.totalSessions.toString(), color: '#60a5fa' },
    { label: 'Success Rate', value: `${Math.round(d.successRate * 100)}%`, color: '#00ff88' },
    { label: 'Checklist', value: `${d.checklistCompleted}/${d.checklistTotal}`, color: '#a78bfa' },
    { label: 'Time', value: formatDuration(d.totalTimeMs), color: '#f59e0b' },
  ];

  const boxW = (W - 80 - 30) / 4;
  for (let i = 0; i < stats.length; i++) {
    const x = 40 + i * (boxW + 10);
    // Box bg
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    roundRect(ctx, x, y, boxW, 60, 8);
    ctx.fill();

    // Label
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(stats[i].label, x + 12, y + 20);

    // Value
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = stats[i].color;
    ctx.fillText(stats[i].value, x + 12, y + 46);
  }
  y += 80;

  // Streak
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f97316';
  ctx.fillText(`\u{1F525} Streak: ${d.currentStreak}`, 40, y);
  ctx.fillStyle = '#888888';
  ctx.fillText(`  |  Best: ${d.longestStreak}`, 40 + ctx.measureText(`\u{1F525} Streak: ${d.currentStreak}`).width, y);
  y += 30;

  // Daily bars
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('Daily activity', 40, y);
  y += 16;

  const barAreaWidth = W - 80;
  const barW = (barAreaWidth - (d.dailySessions.length - 1) * 6) / d.dailySessions.length;
  const maxD = Math.max(...d.dailySessions.map((x) => x.total), 1);
  const barMaxH = 40;

  for (let i = 0; i < d.dailySessions.length; i++) {
    const dd = d.dailySessions[i];
    const x = 40 + i * (barW + 6);
    const h = dd.total > 0 ? Math.max(4, (dd.total / maxD) * barMaxH) : 2;
    const rate = dd.total > 0 ? dd.success / dd.total : 0;
    const color = dd.total === 0 ? 'rgba(255,255,255,0.1)' : rate >= 0.75 ? '#00ff88' : rate >= 0.5 ? '#f59e0b' : '#ef4444';

    ctx.fillStyle = color;
    roundRect(ctx, x, y + barMaxH - h, barW, h, 2);
    ctx.fill();

    // Day label
    const dayLabel = new Date(dd.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' });
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#666666';
    const labelW = ctx.measureText(dayLabel).width;
    ctx.fillText(dayLabel, x + (barW - labelW) / 2, y + barMaxH + 14);
  }
  y += barMaxH + 30;

  // Module leaderboard
  if (d.moduleActivity.length > 0) {
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('Module activity', 40, y);
    y += 16;

    const maxSessions = d.moduleActivity[0].sessions;
    for (const m of d.moduleActivity.slice(0, 5)) {
      const barW2 = maxSessions > 0 ? (m.sessions / maxSessions) * (W - 280) : 0;
      const color = m.successRate >= 0.75 ? '#00ff88' : m.successRate >= 0.5 ? '#f59e0b' : '#ef4444';

      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.fillText(m.label, 40, y + 12);

      ctx.fillStyle = color;
      roundRect(ctx, 200, y + 2, barW2, 12, 3);
      ctx.fill();

      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText(`${m.sessions}`, 200 + barW2 + 8, y + 12);
      ctx.fillStyle = color;
      ctx.fillText(`${Math.round(m.successRate * 100)}%`, W - 80, y + 12);

      y += 22;
    }
    y += 10;
  }

  // Achievements
  if (d.achievements.length > 0) {
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('Achievements', 40, y);
    y += 18;

    let ax = 40;
    for (const a of d.achievements) {
      const text = `${a.icon} ${a.title}`;
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      const tw = ctx.measureText(text).width + 20;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      roundRect(ctx, ax, y - 2, tw, 24, 12);
      ctx.fill();

      ctx.fillStyle = '#cccccc';
      ctx.fillText(text, ax + 10, y + 13);

      ax += tw + 8;
      if (ax > W - 100) { ax = 40; y += 30; }
    }
    y += 30;
  }

  // Footer
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#444444';
  ctx.fillText('Generated by POF', W - 130, H - 16);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
