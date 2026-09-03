/**
 * Milestone progress presentation — the ONE place that says what an unmeasured
 * milestone is called, so the four surfaces that render `Milestone` cannot
 * drift into four different words for the same absence.
 *
 * Background: `Milestone.currentProgress` is `number | null`. `null` means the
 * milestone's progress has NOT been measured — it is not zero, and it must
 * never be rendered as a 0, an empty bar, or a dash that reads as zero.
 *
 * The case that forced this is the vertical slice. A slice is a DEPTH property
 * — one complete path through every layer, ending in something a player
 * actually experiences — and the project-wide checklist percentage is a
 * BREADTH measure. Reporting one on the other made "100% vertical slice"
 * reachable with no playable path anywhere in the game.
 *
 * Standard: game-production ▸ production-governance ▸
 * production-work-prioritization ▸ vertical-slice-as-the-first-milestone:
 * "When the only available completion metric is a percentage across systems,
 * do not report the slice on it at all."
 */

/** The single word every surface uses for `currentProgress === null`. */
export const MILESTONE_NOT_MEASURED_LABEL = 'Not measured';

/**
 * Why the vertical slice reports no progress. Travels on the milestone as
 * `progressNote` so the absence is explained where it is rendered, rather than
 * leaving the reader to guess whether it is a bug or a zero.
 */
export const SLICE_UNMEASURED_NOTE =
  'A vertical slice is depth, not breadth: one complete path through every layer '
  + 'ending in something a player experiences. No slice path is declared for this '
  + 'project, so there is nothing to measure it against — the project-wide '
  + 'checklist percentage would answer a different question.';

/**
 * How a surface should present a milestone's progress.
 *
 * `pct === null` is the instruction NOT to print a number and NOT to draw a
 * bar; `label` is what to print instead.
 */
export interface MilestoneProgressDisplay {
  /** Whole-number percentage, or `null` when the milestone is unmeasured. */
  pct: number | null;
  /** Text for the badge / inline reading — a percentage or "Not measured". */
  label: string;
  /** True when a progress bar may be drawn at all. */
  measured: boolean;
  /** The milestone's own explanation of the absence, when it carries one. */
  note: string | null;
}

/** Project a milestone's raw progress into its display contract. */
export function milestoneProgressDisplay(
  currentProgress: number | null,
  progressNote?: string | null,
): MilestoneProgressDisplay {
  if (currentProgress === null) {
    return {
      pct: null,
      label: MILESTONE_NOT_MEASURED_LABEL,
      measured: false,
      note: progressNote ?? null,
    };
  }
  const pct = Math.max(0, Math.min(100, Math.round(currentProgress)));
  return { pct, label: `${pct}%`, measured: true, note: progressNote ?? null };
}
