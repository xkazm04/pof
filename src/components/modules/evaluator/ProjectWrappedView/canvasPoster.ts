import { roundRect } from '@/lib/canvas-poster';
import { formatDuration } from '@/lib/format';
import {
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_PINK, ACCENT_CYAN, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_INFO, OVERLAY_WHITE, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import type { ProjectWrapped } from '@/types/project-wrapped';
import { formatLongDate, spanCaption } from './helpers';

// ── Canvas PNG rendering (portrait 4:5 share poster) ──────────────────────────

export function renderWrappedToCanvas(canvas: HTMLCanvasElement, w: ProjectWrapped): void {
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
