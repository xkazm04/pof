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
  /** Current progress toward this milestone (0-100) */
  currentProgress: number;
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
}
