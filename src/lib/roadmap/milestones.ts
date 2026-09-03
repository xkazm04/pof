/**
 * Canonical project roadmap milestones (ECW Phase 10-MC round 2). Mirrors the
 * legacy health-engine's milestone ladder (vertical slice → release) but drives
 * `progress` from real catalog/feature completion rather than the simulated
 * fallback. Pure — the RoadmapCard renders the output against live completion.
 *
 * The vertical slice is deliberately exempt from the scaling — see
 * `milestoneProgress` and `./milestone-progress` for the single wording of an
 * unmeasured milestone shared with the health-engine milestone surfaces.
 */
import { SLICE_UNMEASURED_NOTE } from './milestone-progress';

/** The one milestone a breadth percentage cannot answer. */
const UNMEASURABLE_FROM_BREADTH = 'vertical-slice';

export interface RoadmapMilestone {
  id: string;
  name: string;
  /** Overall completion % at which this milestone is considered done. */
  targetPct: number;
}

export interface MilestoneProgress extends RoadmapMilestone {
  /**
   * Progress toward this milestone, 0–100 (completion scaled to the target),
   * or `null` when this milestone is NOT MEASURABLE from a breadth percentage.
   * `null` is not zero and must never render as a 0, an empty bar, or a dash.
   */
  progress: number | null;
  /** Why `progress` is null, when it is. */
  progressNote?: string;
  reached: boolean;
}

export const ROADMAP_MILESTONES: RoadmapMilestone[] = [
  { id: 'vertical-slice', name: 'Playable Vertical Slice', targetPct: 30 },
  { id: 'feature-complete', name: 'Feature Complete', targetPct: 75 },
  { id: 'beta-ready', name: 'Beta Ready', targetPct: 90 },
  { id: 'release', name: 'Release Candidate', targetPct: 100 },
];

/**
 * Map an overall completion percentage (0–100) onto the milestone ladder.
 *
 * The three breadth milestones scale against their target. The vertical slice
 * does NOT: a slice is a depth property — one complete path through every layer
 * ending in something a player experiences — and scaling it against a
 * project-wide checklist percentage made "100% slice" reachable with no playable
 * path anywhere. It reports as unmeasured until a slice path is declared.
 */
export function milestoneProgress(completionPct: number): MilestoneProgress[] {
  const pct = Math.max(0, Math.min(100, completionPct));
  return ROADMAP_MILESTONES.map((m) => {
    if (m.id === UNMEASURABLE_FROM_BREADTH) {
      return { ...m, progress: null, progressNote: SLICE_UNMEASURED_NOTE, reached: false };
    }
    const progress = m.targetPct > 0 ? Math.min(100, Math.round((pct / m.targetPct) * 100)) : 100;
    return { ...m, progress, reached: progress >= 100 };
  });
}
