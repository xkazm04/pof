export interface WeeklyDigest {
  /** ISO date string for period start (Monday) */
  periodStart: string;
  /** ISO date string for period end (Sunday) */
  periodEnd: string;

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
