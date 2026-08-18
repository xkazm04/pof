/**
 * Wire types for `GET /api/harness` (the status summary) and the `POST` bodies
 * the operator controls dispatch. Mirrors the route's response shape exactly —
 * this panel is a control surface over the EXISTING API and adds no engine
 * capability of its own.
 */

export type HarnessRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface HarnessPlanSummary {
  game: string;
  iteration: number;
  totalFeatures: number;
  passingFeatures: number;
  verifiedFeatures: number;
  /** Legacy alias of `selfReportedPassRate`, kept by the route for back-compat. */
  passRate: number;
  selfReportedPassRate: number;
  verifiedPassRate: number;
  totalAreas: number;
  completedAreas: number;
  failedAreas: number;
  gappedAreas: number;
  currentArea: string | null;
}

export interface HarnessCostSummary {
  spentUsd: number;
  budgetUsd: number | null;
  sessions: number;
  /** True once the budget governor has halted new sessions. */
  paused: boolean;
  byArea: Record<string, number>;
  remainingUsd: number | null;
}

export interface HarnessEventSummary {
  type: string;
  [key: string]: unknown;
}

export interface HarnessStatusResponse {
  status: HarnessRunStatus;
  runId: string | null;
  plan: HarnessPlanSummary | null;
  guide: { totalSteps: number; totalDurationMs: number; lastStep: string | null } | null;
  cost: HarnessCostSummary | null;
  checkpoints: { branch: string; count: number; lastGreenSha: string | null } | null;
  recentEvents: HarnessEventSummary[];
}

/** The subset of the start body this panel exposes. Free-text fields stay strings until dispatch. */
export interface StartFormValues {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  statePath: string;
  maxIterations: string;
  targetPassRate: string;
  budgetUsd: string;
  scenario: string;
  themeDirective: string;
  checkpoint: boolean;
  unlimited: boolean;
}

export const EMPTY_START_FORM: StartFormValues = {
  projectPath: '',
  projectName: '',
  ueVersion: '',
  statePath: '',
  maxIterations: '',
  targetPassRate: '',
  budgetUsd: '',
  scenario: '',
  themeDirective: '',
  checkpoint: false,
  unlimited: false,
};
