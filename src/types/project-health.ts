/* ------------------------------------------------------------------ */
/*  Holistic Project Health Dashboard Types                           */
/* ------------------------------------------------------------------ */

/** Module health status for heatmap */
export type ModuleHealthStatus = 'healthy' | 'warning' | 'critical' | 'not-started';

/** A single module's aggregated health */
export interface ModuleHealthSummary {
  moduleId: string;
  label: string;
  status: ModuleHealthStatus;
  /** Checklist completion 0-100 */
  checklistCompletion: number;
  /** Evaluator quality score 0-100 (null if never scanned) */
  qualityScore: number | null;
  /** Number of critical/high eval findings */
  issueCount: number;
  /** Combined health score 0-100 */
  healthScore: number;
}

/** A velocity data point (features/items per week) */
export interface VelocityPoint {
  weekLabel: string;
  /** ISO start of week */
  weekStart: string;
  itemsCompleted: number;
  cumulativeCompleted: number;
}

/** Quality trend data point */
export interface QualityPoint {
  timestamp: string;
  label: string;
  overallScore: number;
  criticalIssues: number;
  highIssues: number;
}

/** Milestone definition */
export interface Milestone {
  id: string;
  name: string;
  /** Target completion percentage */
  targetCompletion: number;
  /** Predicted date (ISO) based on velocity */
  predictedDate: string | null;
  /** Predicted weeks from now */
  predictedWeeks: number | null;
  /**
   * Current progress toward this milestone (0-100), or `null` when the
   * milestone's progress has NOT been measured.
   *
   * `null` is not zero and must never be rendered as one — no 0%, no empty
   * bar, no dash. Consumers project it through `milestoneProgressDisplay()`
   * (`@/lib/roadmap/milestone-progress`), which is the single owner of the
   * "not measured" wording.
   *
   * The vertical slice is `null` by construction: a slice is a DEPTH property
   * (one complete path through every layer, ending in something a player
   * experiences) and the only completion metric this app holds is a
   * project-wide BREADTH percentage. Reporting one on the other made "100%
   * vertical slice" reachable with no playable path anywhere in the game.
   */
  currentProgress: number | null;
  /**
   * Why `currentProgress` is null, when it is. Rendered beside the
   * "not measured" label so the absence is explained, never merely blank.
   */
  progressNote?: string | null;
  /** Color for chart rendering */
  color: string;
}

/** Burndown/burnup chart point */
export interface BurnChartPoint {
  weekLabel: string;
  weekStart: string;
  /** Items remaining (burndown) */
  remaining: number;
  /** Items completed (burnup) */
  completed: number;
  /** Ideal burndown line */
  idealRemaining: number;
}

/** Overall project health summary */
export interface ProjectHealthSummary {
  /** Overall completion percentage (checklist + features combined) */
  overallCompletion: number;
  /** Total checklist items across all modules */
  totalChecklistItems: number;
  /** Completed checklist items */
  completedChecklistItems: number;
  /** Current quality score from latest evaluator scan */
  currentQualityScore: number | null;
  /**
   * Performance score 0-100 fused from the latest profiling triage
   * (`TriageResult.overallScore`), or null when no trace has been triaged.
   */
  performanceScore: number | null;
  /** Quality trend direction */
  qualityTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  /** Average velocity (items per week) */
  avgVelocity: number;
  /** Module health summaries for heatmap */
  moduleHealth: ModuleHealthSummary[];
  /** Velocity data for chart */
  velocityHistory: VelocityPoint[];
  /** Quality data for chart */
  qualityHistory: QualityPoint[];
  /** Milestone predictions */
  milestones: Milestone[];
  /** Burndown/burnup chart data */
  burnChart: BurnChartPoint[];
  /** Subsystem health signals */
  subsystemSignals: SubsystemSignal[];
}

/** Health signal from a specialist subsystem */
export interface SubsystemSignal {
  subsystem: string;
  label: string;
  status: 'healthy' | 'warning' | 'critical' | 'inactive';
  metric: string;
  detail: string;
  /**
   * Optional evaluator tab id this signal drills into when clicked
   * (e.g. `'perf'`, `'crashes'`). Omitted for signals with no source view.
   */
  linkTab?: string;
}

/**
 * Latest performance-triage snapshot fed into the holistic health fusion.
 * Sourced client-side from `usePerformanceProfilingStore` (the triage is held
 * in-memory per session — there is no server-side "latest triage" record).
 */
export interface PerfHealthInput {
  /** Triage overall score 0-100 (higher = better performance). */
  overallScore: number;
  /** Dominant bottleneck from the triage (frame-budget category or 'balanced'). */
  bottleneck: string;
  /** Average FPS of the profiled session, if known. */
  avgFPS: number | null;
  /** Number of triage findings. */
  findingCount: number;
  /** Profiling session name for context, if known. */
  sessionName: string | null;
}

/**
 * Crash-analyzer snapshot fed into the holistic health fusion.
 * Derived from `CrashStats` (server-persisted via `/api/crash-analyzer`).
 */
export interface CrashHealthInput {
  totalCrashes: number;
  /** Crashes seen in the last 24 hours. */
  recentCrashes: number;
  /** Count of critical-severity crashes. */
  criticalCrashes: number;
  /** Number of systemic (recurring) crash patterns. */
  systemicIssues: number;
  /** Module with the most crashes ('none' when empty). */
  mostAffectedModule: string;
}
