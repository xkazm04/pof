// ── AI Behavior Testing Sandbox types ──

export type ScenarioStatus = 'draft' | 'ready' | 'running' | 'passed' | 'failed' | 'error';

export type StimulusType =
  | 'perception_sight'
  | 'perception_hearing'
  | 'perception_damage'
  | 'damage_event'
  | 'gameplay_tag'
  | 'custom';

export interface MockStimulus {
  id: string;
  type: StimulusType;
  /** Human-readable label, e.g. "Player enters sight at 50m" */
  label: string;
  /** Natural-language description — drives C++ mock generation */
  description: string;
  /** Stimulus parameters (free-form key/value) */
  params: Record<string, string>;
}

export interface ExpectedAction {
  id: string;
  /** What the BT should do, e.g. "Enter Chase state" */
  action: string;
  /** Optional: specific BT node/task/service that should execute */
  btNode: string;
  /** Tolerance window in seconds (how long to wait for the action) */
  timeoutSeconds: number;
}

export interface TestScenario {
  id: number;
  suiteId: number;
  name: string;
  description: string;
  /** Ordered stimuli that simulate the game situation */
  stimuli: MockStimulus[];
  /** Expected actions/outcomes from the behavior tree */
  expectedActions: ExpectedAction[];
  /** Last run status */
  status: ScenarioStatus;
  /** Last run output/message */
  lastRunOutput: string;
  /** Last run timestamp */
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestSuite {
  id: number;
  name: string;
  description: string;
  /** The BT / AI controller class being tested */
  targetClass: string;
  scenarios: TestScenario[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSuiteSummary {
  totalSuites: number;
  totalScenarios: number;
  passedCount: number;
  failedCount: number;
  draftCount: number;
}

/** Aggregate counts + pass-rate derived from a flat list of scenarios. */
export interface ScenarioSummary {
  total: number;
  passed: number;
  /** Both `failed` and `error` statuses count as failed. */
  failed: number;
  draft: number;
  /** Rounded 0–100; 0 when there are no scenarios. */
  passRate: number;
}

/**
 * Single source of truth for scenario status aggregation. Used by both the DB
 * summary (`getTestingSummary`) and the sandbox UI so the counting semantics —
 * notably that `error` is grouped with `failed` — stay in lockstep.
 */
export function summarizeScenarios(scenarios: TestScenario[]): ScenarioSummary {
  const total = scenarios.length;
  const passed = scenarios.filter((s) => s.status === 'passed').length;
  const failed = scenarios.filter((s) => s.status === 'failed' || s.status === 'error').length;
  const draft = scenarios.filter((s) => s.status === 'draft').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { total, passed, failed, draft, passRate };
}

// ── API payloads ──

export interface CreateSuitePayload {
  name: string;
  description: string;
  targetClass: string;
}

export interface UpdateSuitePayload {
  id: number;
  name?: string;
  description?: string;
  targetClass?: string;
}

export interface CreateScenarioPayload {
  suiteId: number;
  name: string;
  description: string;
  stimuli?: MockStimulus[];
  expectedActions?: ExpectedAction[];
}

export interface UpdateScenarioPayload {
  id: number;
  name?: string;
  description?: string;
  stimuli?: MockStimulus[];
  expectedActions?: ExpectedAction[];
  status?: ScenarioStatus;
  lastRunOutput?: string;
  lastRunAt?: string | null;
}
