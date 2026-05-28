/**
 * Harness types — shared across orchestrator, planner, executor, verifier, and guide generator.
 *
 * Design principles (from Anthropic's harness research):
 * - JSON for state files, not Markdown (models corrupt JSON less often)
 * - One module-area per executor session (large scope, 1M context)
 * - External memory artifacts bridge context windows
 * - Quality gates enforce verification before advancing
 */

import type { SubModuleId } from '@/types/modules';
import type { EvalPass } from '@/lib/evaluator/module-eval-prompts';

// ── Game Plan (master state) ────────────────────────────────────────────────

export type FeatureStatus = 'pending' | 'in-progress' | 'pass' | 'fail' | 'skipped';
export type AreaStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';

export interface PlannedFeature {
  id: string;
  name: string;
  status: FeatureStatus;
  quality: number | null;
  /** Session iteration that last touched this feature */
  lastSession: number | null;
  /** Failure reason if status === 'fail' */
  failReason?: string;
}

/**
 * A module area groups related features into a single executor session scope.
 * Larger than individual checklist items, smaller than entire modules.
 * Examples: "AbilitySpellbook", "project-setup", "DodgeTimelineEditor"
 */
export interface ModuleArea {
  id: string;
  /** Module this area belongs to */
  moduleId: SubModuleId;
  /** Human-readable label */
  label: string;
  /** Description of what this area covers */
  description: string;
  /** Checklist item IDs from module-registry that this area encompasses */
  checklistItemIds: string[];
  /** Feature names from feature-definitions this area covers */
  featureNames: string[];
  /** Areas that must be completed before this one */
  dependsOn: string[];
  status: AreaStatus;
  features: PlannedFeature[];
  /** Session iteration that completed this area */
  completedAt?: number;
}

export interface GamePlan {
  /** Project name */
  game: string;
  /** UE5 project path */
  projectPath: string;
  /** UE version */
  ueVersion: string;
  /** Ordered list of module areas to build */
  areas: ModuleArea[];
  /** Current iteration counter */
  iteration: number;
  /** Total features across all areas */
  totalFeatures: number;
  /** Features currently passing */
  passingFeatures: number;
  /** Timestamp of plan creation */
  createdAt: string;
  /** Timestamp of last update */
  updatedAt: string;
}

// ── Progress Log ────────────────────────────────────────────────────────────

export interface ProgressEntry {
  iteration: number;
  timestamp: string;
  areaId: string;
  moduleId: SubModuleId;
  action: 'plan' | 'execute' | 'verify' | 'fix' | 'skip';
  outcome: 'success' | 'failure' | 'partial';
  summary: string;
  /** Duration in ms */
  durationMs: number;
  /** Features touched */
  featuresChanged: string[];
  /** Errors encountered */
  errors?: string[];
  /** Lessons learned (fed into AGENTS.md) */
  learnings?: string[];
}

// ── Verification ────────────────────────────────────────────────────────────

export interface VerificationGate {
  name: string;
  type: 'typecheck' | 'lint' | 'test' | 'build' | 'playtest' | 'visual' | 'custom';
  /** Whether this gate is required (blocks progress) or advisory */
  required: boolean;
  /** Command to run or function key */
  command?: string;
}

export interface VerificationResult {
  gate: string;
  passed: boolean;
  output: string;
  durationMs: number;
  /** Structured errors if available */
  errors?: Array<{ file?: string; line?: number; message: string }>;
}

export interface VerificationReport {
  iteration: number;
  areaId: string;
  timestamp: string;
  gates: VerificationResult[];
  allPassed: boolean;
  /** Count of required gates that failed */
  requiredFailures: number;
}

// ── Executor ────────────────────────────────────────────────────────────────

export interface ExecutorConfig {
  /** Max time per executor session (ms) */
  sessionTimeoutMs: number;
  /** Max iterations before giving up on an area */
  maxRetriesPerArea: number;
  /** Allowed tools for the Claude -p invocation */
  allowedTools: string[];
  /** Whether to use --dangerously-skip-permissions */
  skipPermissions: boolean;
  /** Whether to run in --bare mode (faster startup, no hooks/skills) */
  bareMode: boolean;
  /** Max concurrent executor sessions (default 1 = sequential) */
  maxConcurrent?: number;
  /** Min feature pass % to accept an area as completed (0-100, default: use targetPassRate) */
  areaPassThreshold?: number;
}

export interface ExecutorResult {
  /** Whether the session completed without error */
  completed: boolean;
  /** Session ID from Claude Code */
  sessionId?: string;
  /** Duration in ms */
  durationMs: number;
  /** Full text output from the assistant */
  assistantOutput: string;
  /** Whether C++ files were touched */
  touchedCpp: boolean;
  /** Whether gameplay-related files were changed */
  touchedGameplay: boolean;
  /** Whether PoF UI files were changed */
  touchedUI: boolean;
  /** Exit code of the claude process */
  exitCode: number | null;
  /** Cost in USD if reported */
  costUsd?: number;
  /** Errors from the execution */
  errors?: string[];
}

// ── Guide ───────────────────────────────────────────────────────────────────

export interface GuideStep {
  phase: number;
  areaId: string;
  moduleId: SubModuleId;
  label: string;
  description: string;
  /** PoF actions used (checklist IDs, quick action IDs) */
  pofActions: string[];
  /** UE5 files created or modified */
  ue5Files: string[];
  /** Key decisions and their rationale */
  decisions: Array<{ decision: string; rationale: string }>;
  /** Gotchas discovered during implementation */
  gotchas: string[];
  /** Verification results summary */
  verification: string;
  /** Duration of this step */
  durationMs: number;
}

export interface GameBuildGuide {
  title: string;
  game: string;
  generatedAt: string;
  totalIterations: number;
  totalDurationMs: number;
  /** Module build order (dependency-sorted) */
  buildOrder: Array<{ moduleId: SubModuleId; areas: string[] }>;
  /** Step-by-step instructions */
  steps: GuideStep[];
  /** Accumulated learnings */
  learnings: string[];
  /** Prerequisites and setup instructions */
  prerequisites: string[];
  /**
   * Snapshot of the cost governor at the time the guide was last written.
   * Optional so legacy guides without cost tracking still parse.
   */
  cost?: HarnessCostTotals;
}

// ── Harness Config ──────────────────────────────────────────────────────────

export interface HarnessConfig {
  /** Path to the UE5 project */
  projectPath: string;
  /** Project name */
  projectName: string;
  /** UE version string */
  ueVersion: string;
  /** Where to store harness state files */
  statePath: string;
  /** Executor configuration */
  executor: ExecutorConfig;
  /** Verification gates to run */
  gates: VerificationGate[];
  /** Maximum total iterations across all areas */
  maxIterations: number;
  /** Module areas to build (if empty, auto-generate from registry) */
  areas?: ModuleArea[];
  /** Whether to auto-generate the guide */
  generateGuide: boolean;
  /** Whether to update AGENTS.md with learnings */
  updateAgentsMd: boolean;
  /** Eval passes to run during verification */
  evalPasses: EvalPass[];
  /** Stop condition: minimum passing percentage to consider "done" */
  targetPassRate: number;
  /**
   * Creative direction injected into every executor prompt.
   * E.g. "Star Wars ARPG: lightsabers, Force abilities, Stormtroopers"
   * When set, the executor tells Claude to apply this theme to all implementations.
   */
  themeDirective?: string;
  /**
   * Optional hard ceiling on accumulated executor spend in USD. When the running
   * total reaches the cap (or projected next-session spend would cross it), the
   * orchestrator emits `harness:paused` and stops launching new pool sessions.
   * Unset = no cap (legacy behaviour).
   */
  budgetUsd?: number;
  /**
   * Opt-in git checkpointing. When true, the orchestrator commits the working
   * tree onto a dedicated `harness/<runId>` branch (tagged per areaId) after an
   * area passes its required gates, and `git reset --hard`s back to the last
   * green checkpoint before promoting-with-gaps. Default false. Assumes
   * sequential execution (maxConcurrent = 1) — a hard reset would clobber a
   * concurrent area's in-flight work.
   */
  checkpoint?: boolean;
}

/**
 * Running spend tally written to `cost.json` alongside the plan, so a paused
 * run resumes with its previous cumulative total instead of restarting at zero.
 */
export interface HarnessCostTotals {
  /** Sum of all executor session `costUsd` values reported so far. */
  spentUsd: number;
  /** Per-area attribution — sums of costUsd grouped by `areaId`. */
  byArea: Record<string, number>;
  /** Number of sessions that contributed to `spentUsd`. */
  sessions: number;
  /** Configured ceiling (mirrored here so reloads + the guide are self-describing). */
  budgetUsd: number | null;
  /** Whether the governor has stopped launches because the cap was hit. */
  paused: boolean;
}

// ── Orchestrator Events ─────────────────────────────────────────────────────

export type HarnessEvent =
  | { type: 'harness:started'; config: HarnessConfig; plan: GamePlan }
  | { type: 'harness:iteration'; iteration: number; areaId: string }
  | { type: 'harness:planning'; iteration: number }
  | { type: 'harness:executing'; iteration: number; areaId: string }
  | { type: 'harness:verifying'; iteration: number; areaId: string }
  | { type: 'harness:area-completed'; areaId: string; iteration: number }
  | { type: 'harness:area-failed'; areaId: string; iteration: number; reason: string }
  | { type: 'harness:checkpoint'; areaId: string; iteration: number; sha: string }
  | { type: 'harness:rollback'; areaId: string; iteration: number; toSha: string }
  | { type: 'harness:guide-updated'; step: GuideStep }
  | { type: 'harness:learning'; learning: string }
  | { type: 'harness:completed'; plan: GamePlan; guide: GameBuildGuide }
  | { type: 'harness:error'; error: string; fatal: boolean }
  | { type: 'harness:paused'; reason: string }
  | { type: 'harness:progress'; plan: GamePlan };
