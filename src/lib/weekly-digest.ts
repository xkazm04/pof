import { getDb } from './db';
import { ensureSessionAnalyticsTable } from './session-analytics-db';
import { MODULE_LABELS, SUB_MODULES } from './module-registry';
import type { WeeklyDigest, Achievement } from '@/types/weekly-digest';

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Get Monday 00:00 of the given date's week. */
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Main aggregation ─────────────────────────────────────────────────────────

export function generateWeeklyDigest(referenceDate?: Date): WeeklyDigest {
  ensureSessionAnalyticsTable();
  const db = getDb();

  const now = referenceDate ?? new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const periodStartStr = toISODate(weekStart);
  const periodEndStr = toISODate(weekEnd);
  const prevStartStr = toISODate(prevWeekStart);
  const weekStartISO = weekStart.toISOString();
  const weekEndISO = weekEnd.toISOString();
  const prevStartISO = prevWeekStart.toISOString();

  // ── Current week sessions ──
  const thisWeekRows = db.prepare(`
    SELECT module_id, success, duration_ms, completed_at
    FROM session_analytics
    WHERE completed_at >= ? AND completed_at < ?
    ORDER BY completed_at ASC
  `).all(weekStartISO, weekEndISO) as {
    module_id: string; success: number; duration_ms: number; completed_at: string;
  }[];

  // ── Previous week sessions ──
  const prevWeekRows = db.prepare(`
    SELECT module_id, success, duration_ms
    FROM session_analytics
    WHERE completed_at >= ? AND completed_at < ?
  `).all(prevStartISO, weekStartISO) as {
    module_id: string; success: number; duration_ms: number;
  }[];

  // ── Aggregate current week ──
  const totalSessions = thisWeekRows.length;
  const successCount = thisWeekRows.filter((r) => r.success === 1).length;
  const successRate = totalSessions > 0 ? successCount / totalSessions : 0;
  const totalTimeMs = thisWeekRows.reduce((s, r) => s + r.duration_ms, 0);

  // ── Module activity ──
  const moduleMap = new Map<string, { sessions: number; success: number }>();
  for (const row of thisWeekRows) {
    const entry = moduleMap.get(row.module_id) ?? { sessions: 0, success: 0 };
    entry.sessions++;
    if (row.success === 1) entry.success++;
    moduleMap.set(row.module_id, entry);
  }

  const moduleActivity = Array.from(moduleMap.entries())
    .map(([moduleId, data]) => ({
      moduleId,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      sessions: data.sessions,
      successRate: data.sessions > 0 ? data.success / data.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const mostActiveModule = moduleActivity.length > 0
    ? moduleActivity[0]
    : null;

  // ── Daily breakdown ──
  const dailyMap = new Map<string, { total: number; success: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dailyMap.set(toISODate(d), { total: 0, success: 0 });
  }
  for (const row of thisWeekRows) {
    const day = row.completed_at.slice(0, 10);
    const entry = dailyMap.get(day);
    if (entry) {
      entry.total++;
      if (row.success === 1) entry.success++;
    }
  }
  const dailySessions = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }));

  // ── Streaks ──
  const allRecent = db.prepare(`
    SELECT success FROM session_analytics
    ORDER BY completed_at DESC
    LIMIT 200
  `).all() as { success: number }[];

  let currentStreak = 0;
  for (const r of allRecent) {
    if (r.success === 1) currentStreak++;
    else break;
  }

  let longestStreak = 0;
  let streak = 0;
  for (const r of allRecent) {
    if (r.success === 1) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 0;
    }
  }

  // ── Checklist progress ──
  // We can't easily access Zustand from server, so compute total from static data
  const checklistTotal = SUB_MODULES.reduce((sum, m) => sum + (m.checklist?.length ?? 0), 0);
  // checklistCompleted and checklistDelta will be computed client-side from moduleStore
  // For server-side, return 0 — the UI enriches this

  // ── Previous week comparison ──
  const prevWeekSessions = prevWeekRows.length;
  const prevWeekSuccess = prevWeekRows.filter((r) => r.success === 1).length;
  const prevWeekSuccessRate = prevWeekSessions > 0 ? prevWeekSuccess / prevWeekSessions : 0;

  // ── Achievements ──
  const achievements = computeAchievements({
    totalSessions,
    successRate,
    currentStreak,
    longestStreak,
    moduleActivity,
    totalTimeMs,
  });

  return {
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    checklistCompleted: 0, // enriched client-side
    checklistTotal,
    checklistDelta: 0, // enriched client-side
    totalSessions,
    successRate,
    totalTimeMs,
    mostActiveModule,
    moduleActivity,
    longestStreak,
    currentStreak,
    achievements,
    dailySessions,
    prevWeekSessions,
    prevWeekSuccessRate,
  };
}

// ── Achievement computation ──────────────────────────────────────────────────

function computeAchievements(data: {
  totalSessions: number;
  successRate: number;
  currentStreak: number;
  longestStreak: number;
  moduleActivity: { moduleId: string; sessions: number; successRate: number }[];
  totalTimeMs: number;
}): Achievement[] {
  const achievements: Achievement[] = [];

  if (data.totalSessions >= 50) {
    achievements.push({ id: 'sessions-50', title: 'Power User', description: '50+ sessions this week', icon: '\u26A1' });
  } else if (data.totalSessions >= 20) {
    achievements.push({ id: 'sessions-20', title: 'Consistent Builder', description: '20+ sessions this week', icon: '\uD83D\uDD28' });
  } else if (data.totalSessions >= 10) {
    achievements.push({ id: 'sessions-10', title: 'Getting Started', description: '10+ sessions this week', icon: '\uD83C\uDF31' });
  }

  if (data.successRate >= 0.9 && data.totalSessions >= 5) {
    achievements.push({ id: 'accuracy-90', title: 'Sharp Shooter', description: '90%+ success rate', icon: '\uD83C\uDFAF' });
  } else if (data.successRate >= 0.75 && data.totalSessions >= 5) {
    achievements.push({ id: 'accuracy-75', title: 'On Target', description: '75%+ success rate', icon: '\u2705' });
  }

  if (data.currentStreak >= 10) {
    achievements.push({ id: 'streak-10', title: 'Unstoppable', description: `${data.currentStreak} consecutive successes`, icon: '\uD83D\uDD25' });
  } else if (data.currentStreak >= 5) {
    achievements.push({ id: 'streak-5', title: 'On a Roll', description: `${data.currentStreak} consecutive successes`, icon: '\uD83D\uDE80' });
  }

  if (data.moduleActivity.length >= 5) {
    achievements.push({ id: 'versatile', title: 'Versatile', description: `Active across ${data.moduleActivity.length} modules`, icon: '\uD83C\uDF10' });
  }

  const perfectModules = data.moduleActivity.filter((m) => m.successRate === 1 && m.sessions >= 3);
  if (perfectModules.length > 0) {
    achievements.push({ id: 'perfect-module', title: 'Flawless Module', description: `100% success in ${perfectModules[0].moduleId}`, icon: '\uD83D\uDC8E' });
  }

  const hoursSpent = data.totalTimeMs / 3600000;
  if (hoursSpent >= 5) {
    achievements.push({ id: 'dedicated', title: 'Dedicated', description: `${Math.round(hoursSpent)}h invested this week`, icon: '\u23F0' });
  }

  return achievements;
}
