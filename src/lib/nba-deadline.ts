/**
 * Deadline pressure for the Next Best Action engine.
 *
 * `milestone_deadlines` has existed in `db.ts` since the calendar roadmap was
 * built, is served by `/api/milestone-deadlines`, and is written every time
 * someone drags a deadline marker — and until now NOTHING read it back into a
 * decision. `nba-engine.ts` contained zero occurrences of "deadline", so a
 * milestone due next week and one due next quarter ranked identically.
 * Declaring an input is not consuming it.
 *
 * This module is the consumption, and it is deliberately small:
 *
 * - **No declared deadline ⇒ no contribution.** Not a default, not a neutral
 *   middle value. With the store empty the engine's output is byte-identical
 *   to what it was before this file existed.
 * - **Bounded.** At most {@link DEADLINE_URGENCY_MAX} points, folded into the
 *   existing urgency factor rather than added as a sixth weight — the scoring
 *   model is not redesigned to accommodate it.
 * - **Beyond the horizon is zero.** A date three months out is a real
 *   commitment and not a reason to work differently today.
 *
 * It is a soft signal by design. The governing subject is explicit that a
 * ranking instrument "cannot know a publisher deadline… the output is an input
 * to a decision, never the decision" (game-production ▸
 * production-work-prioritization). A deadline nudges the order of startable
 * work; it never reorders around work that cannot be started.
 */

/** One row of the deadline store, as `/api/milestone-deadlines` returns it. */
export interface MilestoneDeadline {
  /** ISO date the milestone is committed to. */
  targetDate: string;
  /** Operator-authored name for the commitment (may be empty). */
  label?: string;
}

/** milestoneId → deadline, exactly the shape the API GET returns. */
export type MilestoneDeadlineMap = Readonly<Record<string, MilestoneDeadline>>;

/**
 * Maximum urgency points a deadline may contribute — roughly a quarter of the
 * urgency weight (30). Large enough to break ties among startable work, far
 * too small to outvote a real dependency fan-out, which is the ordering this
 * engine is actually built on.
 */
export const DEADLINE_URGENCY_MAX = 8;

/**
 * How far ahead a deadline starts to register, in days. Beyond this the
 * contribution is exactly zero: a commitment a quarter away is not a reason to
 * reorder today's work, and pretending otherwise would make every project with
 * any date on file permanently "urgent".
 */
export const DEADLINE_HORIZON_DAYS = 90;

const MS_PER_DAY = 86_400_000;

/** What a deadline contributed, and what it was computed from. */
export interface DeadlinePressure {
  /** Which milestone's deadline this is (the soonest declared one). */
  milestoneId: string;
  /** Its operator-authored label, or the milestone id when unlabelled. */
  label: string;
  /** The declared target date, verbatim. */
  targetDate: string;
  /** Whole days until the target — negative when the deadline has passed. */
  daysRemaining: number;
  /** Points contributed to urgency, 0…{@link DEADLINE_URGENCY_MAX}. */
  points: number;
  /** One sentence naming the commitment and its remaining time. */
  note: string;
}

/** Days from `now` to `target`, rounded up so "later today" reads as 0. */
function daysBetween(now: Date, target: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Ramp time-to-deadline onto 0…{@link DEADLINE_URGENCY_MAX}.
 *
 * Overdue or due today saturates; the horizon and beyond contributes nothing;
 * in between it rises linearly. Monotonic by construction, so a nearer
 * deadline can never score lower than a farther one.
 */
function pointsFor(daysRemaining: number): number {
  if (daysRemaining <= 0) return DEADLINE_URGENCY_MAX;
  if (daysRemaining >= DEADLINE_HORIZON_DAYS) return 0;
  const share = (DEADLINE_HORIZON_DAYS - daysRemaining) / DEADLINE_HORIZON_DAYS;
  return Math.round(DEADLINE_URGENCY_MAX * share);
}

/**
 * The urgency contribution of the declared milestone deadlines.
 *
 * Returns `null` — never a zero-valued object — when nothing is declared or
 * nothing parses, so a caller cannot accidentally treat "no deadline" as a
 * measured one. The SOONEST declared deadline wins: it is the first commitment
 * the project can miss, and an overdue one is the most pressing of all.
 *
 * @param deadlines the deadline store, or `null`/`undefined` when unread.
 * @param now       injected so callers (and tests) are deterministic.
 */
export function deadlinePressure(
  deadlines: MilestoneDeadlineMap | null | undefined,
  now: Date = new Date(),
): DeadlinePressure | null {
  if (!deadlines) return null;

  let best: { id: string; row: MilestoneDeadline; date: Date } | null = null;
  for (const [id, row] of Object.entries(deadlines)) {
    if (!row?.targetDate) continue;
    const date = new Date(row.targetDate);
    // A row whose date does not parse is a defect in the store, not a
    // deadline — it is skipped rather than defaulted to "now" (which would
    // manufacture maximum urgency out of bad data).
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date.getTime() < best.date.getTime()) best = { id, row, date };
  }

  if (!best) return null;

  const daysRemaining = daysBetween(now, best.date);
  const label = best.row.label?.trim() || best.id;
  const when = daysRemaining < 0
    ? `${Math.abs(daysRemaining)} days overdue`
    : daysRemaining === 0
      ? 'due today'
      : `in ${daysRemaining} days`;

  return {
    milestoneId: best.id,
    label,
    targetDate: best.row.targetDate,
    daysRemaining,
    points: pointsFor(daysRemaining),
    note: `Deadline "${label}" ${when}`,
  };
}
