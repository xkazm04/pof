export interface WeeklyDigest {
  /** Day key (YYYY-MM-DD, in `zone`) of the Monday that starts the period. */
  periodStart: string;
  /** Day key of the following Monday — the EXCLUSIVE end of the half-open week. */
  periodEnd: string;
  /** IANA zone the week and its daily keys were cut in (see lib/analytics/report-window). */
  zone: string;

  // ── Core metrics ──
  checklistCompleted: number;
  checklistTotal: number;
  checklistDelta: number; // vs previous week
  totalSessions: number;
  successRate: number; // 0-1
  totalTimeMs: number;

  // ── Module breakdown ──
  mostActiveModule: { moduleId: string; label: string; sessions: number } | null;
  moduleActivity: { moduleId: string; label: string; sessions: number; successRate: number }[];

  // ── Streaks & achievements ──
  longestStreak: number; // consecutive successful sessions
  currentStreak: number;
  achievements: Achievement[];

  // ── Daily breakdown for sparkline ──
  dailySessions: { date: string; total: number; success: number }[];

  // ── Previous week comparison ──
  prevWeekSessions: number;
  prevWeekSuccessRate: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
}
