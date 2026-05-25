/**
 * Canonical project roadmap milestones (ECW Phase 10-MC round 2). Mirrors the
 * legacy health-engine's milestone ladder (vertical slice → release) but drives
 * `progress` from real catalog/feature completion rather than the simulated
 * fallback. Pure — the RoadmapCard renders the output against live completion.
 */

export interface RoadmapMilestone {
  id: string;
  name: string;
  /** Overall completion % at which this milestone is considered done. */
  targetPct: number;
}

export interface MilestoneProgress extends RoadmapMilestone {
  /** Progress toward this milestone, 0–100 (completion scaled to the target). */
  progress: number;
  reached: boolean;
}

export const ROADMAP_MILESTONES: RoadmapMilestone[] = [
  { id: 'vertical-slice', name: 'Playable Vertical Slice', targetPct: 30 },
  { id: 'feature-complete', name: 'Feature Complete', targetPct: 75 },
  { id: 'beta-ready', name: 'Beta Ready', targetPct: 90 },
  { id: 'release', name: 'Release Candidate', targetPct: 100 },
];

/** Map an overall completion percentage (0–100) onto the milestone ladder. */
export function milestoneProgress(completionPct: number): MilestoneProgress[] {
  const pct = Math.max(0, Math.min(100, completionPct));
  return ROADMAP_MILESTONES.map((m) => {
    const progress = m.targetPct > 0 ? Math.min(100, Math.round((pct / m.targetPct) * 100)) : 100;
    return { ...m, progress, reached: progress >= 100 };
  });
}
