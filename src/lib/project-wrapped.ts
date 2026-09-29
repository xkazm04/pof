import { getDb } from './db';
import { MODULE_LABELS } from './module-registry';
import { reportZone, dayKey, mondayOfKey, daysBetweenKeys } from '@/lib/analytics/report-window';
import type {
  ProjectWrapped,
  WrappedModule,
  WrappedWeek,
  WrappedMonth,
  WrappedMilestone,
  Achievement,
} from '@/types/project-wrapped';

/** Raw session row shape consumed by the pure aggregator. */
export interface WrappedSessionRow {
  module_id: string;
  success: number; // 0 | 1
  duration_ms: number;
  completed_at: string; // ISO datetime
}

const SESSION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const HOUR_MILESTONES = [1, 5, 10, 25, 50, 100, 250];
const MODULE_MILESTONES = [3, 5, 10];

// ── Pure aggregation ─────────────────────────────────────────────────────────

/**
 * Aggregate the full session history into a lifetime "Wrapped" recap.
 * Pure & DB-free so it can be unit-tested with fixture rows. `nowISO` is the
 * timestamp stamped onto the recap (injected to keep this resume/render safe).
 * Every day / week / month key is cut in `zone` by the report-window authority (the same
 * one the Weekly Digest uses) and the recap echoes that zone.
 */
export function aggregateProjectWrapped(
  rows: WrappedSessionRow[],
  nowISO: string,
  zone: string = reportZone(),
): ProjectWrapped {
  const sorted = [...rows].sort((a, b) => a.completed_at.localeCompare(b.completed_at));

  if (sorted.length === 0) return emptyWrapped(nowISO, zone);

  // One zone-true day key per row, parallel to `sorted` (derived once, reused below).
  const days = sorted.map((r) => dayKey(r.completed_at, zone));

  const totalSessions = sorted.length;
  const successCount = sorted.filter((r) => r.success === 1).length;
  const successRate = successCount / totalSessions;
  const totalTimeMs = sorted.reduce((s, r) => s + (r.duration_ms || 0), 0);

  const firstSessionDate = days[0];
  const lastSessionDate = days[days.length - 1];
  const spanDays = daysBetweenKeys(firstSessionDate, lastSessionDate) + 1;

  // ── Per-module ──
  const moduleMap = new Map<string, { sessions: number; success: number; timeMs: number }>();
  for (const r of sorted) {
    const e = moduleMap.get(r.module_id) ?? { sessions: 0, success: 0, timeMs: 0 };
    e.sessions++;
    if (r.success === 1) e.success++;
    e.timeMs += r.duration_ms || 0;
    moduleMap.set(r.module_id, e);
  }
  const allModules: WrappedModule[] = Array.from(moduleMap.entries())
    .map(([moduleId, d]) => ({
      moduleId,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      sessions: d.sessions,
      successRate: d.sessions > 0 ? d.success / d.sessions : 0,
      timeMs: d.timeMs,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.timeMs - a.timeMs);

  const modulesTouched = allModules.length;
  const modulesConquered = allModules.filter((m) => m.sessions >= 3 && m.successRate >= 0.7).length;
  const topModules = allModules.slice(0, 8);

  // ── Per-day ──
  const dayMap = new Map<string, number>();
  for (const day of days) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  const activeDays = dayMap.size;
  let biggestDay: { date: string; sessions: number } | null = null;
  for (const [date, sessions] of dayMap) {
    if (!biggestDay || sessions > biggestDay.sessions) biggestDay = { date, sessions };
  }

  // ── Per-week ──
  const weekMap = new Map<string, { sessions: number; success: number; timeMs: number }>();
  sorted.forEach((r, i) => {
    const wk = mondayOfKey(days[i]);
    const e = weekMap.get(wk) ?? { sessions: 0, success: 0, timeMs: 0 };
    e.sessions++;
    if (r.success === 1) e.success++;
    e.timeMs += r.duration_ms || 0;
    weekMap.set(wk, e);
  });
  let biggestWeek: WrappedWeek | null = null;
  for (const [weekStart, d] of weekMap) {
    const w: WrappedWeek = {
      weekStart,
      sessions: d.sessions,
      timeMs: d.timeMs,
      successRate: d.sessions > 0 ? d.success / d.sessions : 0,
    };
    if (!biggestWeek || w.sessions > biggestWeek.sessions ||
        (w.sessions === biggestWeek.sessions && w.timeMs > biggestWeek.timeMs)) {
      biggestWeek = w;
    }
  }

  // ── Streaks ──
  let longestStreak = 0;
  let run = 0;
  let bestStreakEndDate: string | null = null;
  sorted.forEach((r, i) => {
    if (r.success === 1) {
      run++;
      if (run > longestStreak) { longestStreak = run; bestStreakEndDate = days[i]; }
    } else {
      run = 0;
    }
  });

  const sortedDays = Array.from(dayMap.keys()).sort();
  let longestActiveDayStreak = sortedDays.length > 0 ? 1 : 0;
  let dayRun = longestActiveDayStreak;
  for (let i = 1; i < sortedDays.length; i++) {
    dayRun = daysBetweenKeys(sortedDays[i - 1], sortedDays[i]) === 1 ? dayRun + 1 : 1;
    if (dayRun > longestActiveDayStreak) longestActiveDayStreak = dayRun;
  }

  return {
    generatedAt: nowISO,
    zone,
    firstSessionDate,
    lastSessionDate,
    activeDays,
    spanDays,
    totalSessions,
    successCount,
    successRate,
    totalTimeMs,
    biggestWeek,
    modulesTouched,
    modulesConquered,
    topModules,
    longestStreak,
    longestActiveDayStreak,
    biggestDay,
    milestones: buildMilestones(sorted, days, { firstSessionDate, biggestWeek, longestStreak, bestStreakEndDate }),
    achievements: computeLifetimeAchievements({ totalSessions, successRate, longestStreak, modulesTouched, totalTimeMs, activeDays }),
    monthlyActivity: buildMonthlyArc(sorted, days),
  };
}

// ── Milestone timeline ───────────────────────────────────────────────────────

function buildMilestones(
  sorted: WrappedSessionRow[],
  days: string[],
  ctx: {
    firstSessionDate: string;
    biggestWeek: WrappedWeek | null;
    longestStreak: number;
    bestStreakEndDate: string | null;
  },
): WrappedMilestone[] {
  const ms: WrappedMilestone[] = [];

  ms.push({
    date: ctx.firstSessionDate,
    type: 'first-session',
    title: 'The journey began',
    description: 'First session recorded',
    icon: '🌱', // 🌱
  });

  // Session-count thresholds — dated at the moment the Nth session landed.
  for (const t of SESSION_MILESTONES) {
    if (sorted.length >= t) {
      ms.push({
        date: days[t - 1],
        type: 'sessions',
        title: `${t.toLocaleString()} sessions`,
        description: `Reached ${t.toLocaleString()} total sessions`,
        icon: '🚀', // 🚀
      });
    }
  }

  // Cumulative-time thresholds + module-diversity, in one chronological pass.
  let cumMs = 0;
  const timeClaimed = new Set<number>();
  const seenModules = new Set<string>();
  const moduleClaimed = new Set<number>();
  sorted.forEach((r, i) => {
    cumMs += r.duration_ms || 0;
    const hrs = cumMs / 3600000;
    for (const t of HOUR_MILESTONES) {
      if (!timeClaimed.has(t) && hrs >= t) {
        timeClaimed.add(t);
        ms.push({
          date: days[i],
          type: 'time',
          title: `${t}h invested`,
          description: `Crossed ${t} hour${t === 1 ? '' : 's'} of build time`,
          icon: '⏳', // ⏳
        });
      }
    }
    if (!seenModules.has(r.module_id)) {
      seenModules.add(r.module_id);
      for (const t of MODULE_MILESTONES) {
        if (seenModules.size === t && !moduleClaimed.has(t)) {
          moduleClaimed.add(t);
          ms.push({
            date: days[i],
            type: 'module',
            title: `${t} modules explored`,
            description: `Worked across ${t} different modules`,
            icon: '🧭', // 🧭
          });
        }
      }
    }
  });

  if (ctx.biggestWeek && ctx.biggestWeek.sessions >= 5) {
    ms.push({
      date: ctx.biggestWeek.weekStart,
      type: 'biggest-week',
      title: 'Biggest week',
      description: `${ctx.biggestWeek.sessions} sessions in one week`,
      icon: '🔥', // 🔥
    });
  }

  if (ctx.longestStreak >= 5 && ctx.bestStreakEndDate) {
    ms.push({
      date: ctx.bestStreakEndDate,
      type: 'streak',
      title: `${ctx.longestStreak}-session streak`,
      description: `${ctx.longestStreak} consecutive successes`,
      icon: '⚡', // ⚡
    });
  }

  // Sort chronologically, but always lead with "the journey began" — a week-anchored
  // milestone can otherwise sort ahead of the very first session.
  const first = ms.find((m) => m.type === 'first-session');
  const rest = ms.filter((m) => m.type !== 'first-session').sort((a, b) => a.date.localeCompare(b.date));
  return first ? [first, ...rest] : rest;
}

// ── Monthly activity arc (continuous, gap-filled) ────────────────────────────

/** `days` are the rows' zone-true day keys; a month key is the day key's YYYY-MM. */
function buildMonthlyArc(sorted: WrappedSessionRow[], days: string[]): WrappedMonth[] {
  if (sorted.length === 0) return [];

  const map = new Map<string, { sessions: number; success: number }>();
  sorted.forEach((r, i) => {
    const key = days[i].slice(0, 7); // YYYY-MM in the recap's zone
    const e = map.get(key) ?? { sessions: 0, success: 0 };
    e.sessions++;
    if (r.success === 1) e.success++;
    map.set(key, e);
  });

  const [ly, lmo] = days[days.length - 1].slice(0, 7).split('-').map(Number);
  let [y, mo] = days[0].slice(0, 7).split('-').map(Number);
  const out: WrappedMonth[] = [];
  let guard = 0;
  while ((y < ly || (y === ly && mo <= lmo)) && guard < 600) {
    const key = `${y}-${String(mo).padStart(2, '0')}`;
    const e = map.get(key) ?? { sessions: 0, success: 0 };
    out.push({ month: key, sessions: e.sessions, success: e.success });
    if (++mo > 12) { mo = 1; y++; }
    guard++;
  }
  return out;
}

// ── Lifetime achievements (larger thresholds than the weekly tier) ───────────

function computeLifetimeAchievements(data: {
  totalSessions: number;
  successRate: number;
  longestStreak: number;
  modulesTouched: number;
  totalTimeMs: number;
  activeDays: number;
}): Achievement[] {
  const a: Achievement[] = [];

  if (data.totalSessions >= 1000) a.push({ id: 'lifetime-legend', title: 'Legend', description: '1,000+ lifetime sessions', icon: '👑' });
  else if (data.totalSessions >= 500) a.push({ id: 'lifetime-veteran', title: 'Veteran', description: '500+ lifetime sessions', icon: '🏆' });
  else if (data.totalSessions >= 100) a.push({ id: 'lifetime-centurion', title: 'Centurion', description: '100+ lifetime sessions', icon: '💯' });
  else if (data.totalSessions >= 25) a.push({ id: 'lifetime-committed', title: 'Committed', description: '25+ lifetime sessions', icon: '🔨' });

  if (data.successRate >= 0.9 && data.totalSessions >= 20) a.push({ id: 'lifetime-marksman', title: 'Marksman', description: '90%+ lifetime success rate', icon: '🎯' });
  else if (data.successRate >= 0.75 && data.totalSessions >= 20) a.push({ id: 'lifetime-reliable', title: 'Reliable', description: '75%+ lifetime success rate', icon: '✅' });

  const hrs = data.totalTimeMs / 3600000;
  if (hrs >= 100) a.push({ id: 'lifetime-master', title: 'Master Craftsman', description: `${Math.round(hrs)}h invested`, icon: '⚒️' });
  else if (hrs >= 25) a.push({ id: 'lifetime-artisan', title: 'Artisan', description: `${Math.round(hrs)}h invested`, icon: '⏰' });
  else if (hrs >= 5) a.push({ id: 'lifetime-dedicated', title: 'Dedicated', description: `${Math.round(hrs)}h invested`, icon: '🕯️' });

  if (data.longestStreak >= 25) a.push({ id: 'lifetime-unstoppable', title: 'Unstoppable', description: `${data.longestStreak}-session streak`, icon: '🔥' });
  else if (data.longestStreak >= 10) a.push({ id: 'lifetime-onroll', title: 'On a Roll', description: `${data.longestStreak}-session streak`, icon: '🚀' });

  if (data.modulesTouched >= 10) a.push({ id: 'lifetime-polymath', title: 'Polymath', description: `Active across ${data.modulesTouched} modules`, icon: '🌐' });
  else if (data.modulesTouched >= 5) a.push({ id: 'lifetime-versatile', title: 'Versatile', description: `Active across ${data.modulesTouched} modules`, icon: '🧭' });

  if (data.activeDays >= 30) a.push({ id: 'lifetime-marathoner', title: 'Marathoner', description: `${data.activeDays} active days`, icon: '📅' });
  else if (data.activeDays >= 7) a.push({ id: 'lifetime-regular', title: 'Regular', description: `${data.activeDays} active days`, icon: '🗓️' });

  return a;
}

// ── Empty state ──────────────────────────────────────────────────────────────

function emptyWrapped(nowISO: string, zone: string): ProjectWrapped {
  return {
    generatedAt: nowISO,
    zone,
    firstSessionDate: null,
    lastSessionDate: null,
    activeDays: 0,
    spanDays: 0,
    totalSessions: 0,
    successCount: 0,
    successRate: 0,
    totalTimeMs: 0,
    biggestWeek: null,
    modulesTouched: 0,
    modulesConquered: 0,
    topModules: [],
    longestStreak: 0,
    longestActiveDayStreak: 0,
    biggestDay: null,
    milestones: [],
    achievements: [],
    monthlyActivity: [],
  };
}

// ── DB-bound entry point ─────────────────────────────────────────────────────

export function generateProjectWrapped(nowISO?: string, zone: string = reportZone()): ProjectWrapped {
  const db = getDb();
  const rows = db.prepare(`
    SELECT module_id, success, duration_ms, completed_at
    FROM session_analytics
    ORDER BY completed_at ASC
  `).all() as WrappedSessionRow[];
  return aggregateProjectWrapped(rows, nowISO ?? new Date().toISOString(), zone);
}
