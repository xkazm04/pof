import type { Achievement } from './weekly-digest';

export type { Achievement };

/** A single module's lifetime contribution. */
export interface WrappedModule {
  moduleId: string;
  label: string;
  sessions: number;
  successRate: number; // 0-1
  timeMs: number;
}

/** Aggregated activity for one ISO week (Monday-anchored). */
export interface WrappedWeek {
  /** ISO date string for the Monday that starts the week. */
  weekStart: string;
  sessions: number;
  timeMs: number;
  successRate: number; // 0-1
}

export type WrappedMilestoneType =
  | 'first-session'
  | 'sessions'
  | 'time'
  | 'module'
  | 'streak'
  | 'biggest-week';

/** A notable event on the lifetime journey, placed on a timeline. */
export interface WrappedMilestone {
  /** ISO date string (YYYY-MM-DD) the milestone was reached. */
  date: string;
  type: WrappedMilestoneType;
  title: string;
  description: string;
  icon: string; // emoji
}

/** Monthly bucket for the activity arc. */
export interface WrappedMonth {
  /** YYYY-MM */
  month: string;
  sessions: number;
  success: number;
}

/**
 * A full-project "Wrapped" recap — lifetime aggregation of session_analytics,
 * the celebratory complement to the single-week {@link import('./weekly-digest').WeeklyDigest}.
 */
export interface ProjectWrapped {
  /** ISO timestamp the recap was generated (drives the share-image caption). */
  generatedAt: string;
  /** ISO date (YYYY-MM-DD) of the first ever session, or null when there's no data. */
  firstSessionDate: string | null;
  /** ISO date (YYYY-MM-DD) of the most recent session, or null when there's no data. */
  lastSessionDate: string | null;
  /** Distinct calendar days with at least one session. */
  activeDays: number;
  /** Calendar days spanned from first to last session, inclusive (>= 1 when data exists). */
  spanDays: number;

  // ── Core lifetime metrics ──
  totalSessions: number;
  successCount: number;
  successRate: number; // 0-1
  totalTimeMs: number;

  // ── Biggest week ──
  biggestWeek: WrappedWeek | null;

  // ── Modules ──
  /** Distinct modules touched at least once. */
  modulesTouched: number;
  /** Modules with a meaningful, mostly-successful body of work (>= 3 sessions, >= 70% success). */
  modulesConquered: number;
  /** Top modules by session count (capped). */
  topModules: WrappedModule[];

  // ── Streaks ──
  /** Longest run of consecutive successful sessions. */
  longestStreak: number;
  /** Longest run of consecutive calendar days with at least one session. */
  longestActiveDayStreak: number;

  // ── Best single day ──
  biggestDay: { date: string; sessions: number } | null;

  // ── Milestone timeline (chronological, ascending by date) ──
  milestones: WrappedMilestone[];

  // ── Lifetime achievements ──
  achievements: Achievement[];

  // ── Monthly activity arc (continuous from first to last month) ──
  monthlyActivity: WrappedMonth[];
}
