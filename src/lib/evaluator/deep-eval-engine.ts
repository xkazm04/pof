/**
 * Deep Evaluation Engine — multi-pass orchestrator.
 *
 * Runs specialized analysis per module with 4 passes (ground-truth, structure,
 * quality, perf); arpg-combat adds a 5th combat-trace pass via getPassesForModule.
 * Each pass produces structured findings that are collected, deduplicated, and
 * aggregated into a comprehensive scan report.
 *
 * The engine is transport-free: each pass goes through an injected
 * {@link PassExecutor}. The server job (`deep-eval-job.ts`, behind
 * `/api/evaluator/deep-eval`) supplies one that spawns the Claude CLI via
 * cli-service; tests supply a fake, so the orchestration is testable at zero
 * model cost. (It used to run in the browser and POST `{ prompt, cwd }` to
 * /api/claude-terminal/query, which requires `projectPath` and answered 400,
 * so every pass of every run landed 'error'.)
 */

import type { SubModuleId } from '@/types/modules';
import { buildEvalPrompt, getEvaluableModuleIds, getPassesForModule } from './module-eval-prompts';
import type { EvalPass } from './module-eval-prompts';
import { parseFindingsStrict, deduplicateFindings, aggregateFindings } from './finding-collector';
import type { EvalFinding, ScanFindings } from './finding-collector';
import { buildProjectContextHeader } from '@/lib/prompt-context';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import type { ProjectContext } from '@/lib/prompt-context';

/**
 * The composed prompt for ONE evaluation pass — header + eval body.
 *
 * Extracted from the run loop so the surface is pure and pinnable: it is a
 * prompt-assembly seam, and it was one of the callers that asked
 * `buildProjectContextHeader` for a header with NO knowledge routing, so every
 * pass hauled the conservative pitfall superset and got none of its module's
 * authored tips or known asset paths. It now routes through the same
 * {@link moduleKnowledge} seam the CLITask path uses.
 */
export function buildDeepEvalPassPrompt(
  projectContext: ProjectContext,
  moduleId: SubModuleId,
  pass: EvalPass,
): string {
  const moduleName = projectContext.projectName || 'MyProject';
  const body = buildEvalPrompt({
    moduleId,
    pass,
    projectName: projectContext.projectName,
    moduleName,
    sourcePath: `Source/${moduleName}/`,
  });
  const header = buildProjectContextHeader(projectContext, {
    // Same knowledge routing the CLITask path uses — an evaluation pass reads the
    // module's own domain, so it must see that module's pitfalls/tips, not the superset.
    ...moduleKnowledge(moduleId),
    includeBuildCommand: false,
    includeRules: true,
    extraRules: [
      'This is an EVALUATION task — do NOT modify any files.',
      'Read source files to analyze them, then output your findings.',
      'Do NOT use TodoWrite.',
    ],
  });
  return `${header}

${body}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type EvalStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled';

export type PassStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

/**
 * Runs ONE evaluation pass and resolves with the model's raw text output. Rejects
 * with the failure (its message becomes the pass's `cli-error: ...` reason), or
 * with an `AbortError` when `signal` fires.
 */
export type PassExecutor = (
  prompt: string,
  projectPath: string,
  signal: AbortSignal,
  /** Which cell this pass is, for attribution and logging. */
  cell: { moduleId: string; pass: EvalPass },
) => Promise<string>;

/** A pass that ended: what the ledger persists and a resumed run replays. */
export interface PassOutcome {
  moduleId: string;
  pass: EvalPass;
  status: 'done' | 'error';
  findings: EvalFinding[];
  /** Why the pass failed (`unparseable-output`, `cli-error: ...`); null when done. */
  error: string | null;
}

export interface EvalProgress {
  status: EvalStatus;
  currentModule: string | null;
  currentPass: EvalPass | null;
  completedSteps: number;
  totalSteps: number;
  /** Module -> pass -> status */
  passStatuses: Record<string, Record<EvalPass, PassStatus>>;
  /** Intermediate results as they come in */
  findings: EvalFinding[];
  error: string | null;
}

export interface DeepEvalOptions {
  /** Specific modules to evaluate (default: all evaluable modules) */
  moduleIds?: string[];
  /** Specific passes to run (default: all 3) */
  passes?: EvalPass[];
  /** Project context for prompt building */
  projectContext: ProjectContext;
  /** Project CWD for CLI execution */
  projectPath: string;
  /** Runs each pass (the server job's CLI executor, or a test fake). */
  executePass: PassExecutor;
  /** Scan id to stamp findings with (default `deep-<now>`); a resumed job reuses its own. */
  scanId?: string;
  /** Cancels the run; in-flight passes see it through their executor's signal. */
  signal?: AbortSignal;
  /** Passes an earlier run of this scan already finished: `done` ones are not re-run. */
  resumeFrom?: PassOutcome[];
  /** Called as each pass ends (done or error): the per-pass persistence hook. */
  onPassEnd?: (outcome: PassOutcome) => void;
  /** Callback for progress updates */
  onProgress?: (progress: EvalProgress) => void;
}

export interface DeepEvalResult {
  scanId: string;
  findings: ScanFindings;
  duration: number;
  modulesEvaluated: string[];
  passesRun: EvalPass[];
  /**
   * Modules where at least one pass errored. Their zero/partial findings mean
   * "evaluation incomplete", NOT "clean" — baseline merges must exclude them
   * or prior findings get dropped and falsely reported as RESOLVED.
   */
  failedModules: string[];
  /** Final status of every (module, pass) cell. */
  passStatuses: Record<string, Record<EvalPass, PassStatus>>;
  /**
   * Why each failed pass failed, per module: `unparseable-output` (the pass ran but
   * returned no JSON findings array, so it is unmeasured, never "clean") or
   * `cli-error: <message>`. Empty for a module whose passes all finished.
   */
  passErrors: Record<string, Partial<Record<EvalPass, string>>>;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

function abortError(): DOMException {
  return new DOMException('Evaluation cancelled', 'AbortError');
}

/**
 * Run a deep evaluation across modules and passes.
 */
export async function runDeepEval(options: DeepEvalOptions): Promise<DeepEvalResult> {
  const {
    moduleIds = getEvaluableModuleIds(),
    passes,
    projectContext,
    projectPath,
    executePass,
    resumeFrom = [],
    onPassEnd,
    onProgress,
  } = options;

  // When the caller doesn't pin specific passes, expand per module so that a
  // module with an extra pass (arpg-combat's combat-trace) runs it and others
  // are unchanged. An explicit `passes` override is honored verbatim.
  const passesFor = (moduleId: string): EvalPass[] => passes ?? getPassesForModule(moduleId);
  const passesRun: EvalPass[] = passes
    ? passes
    : Array.from(new Set(moduleIds.flatMap((m) => passesFor(m))));

  const signal = options.signal ?? new AbortController().signal;

  const scanId = options.scanId ?? `deep-${Date.now()}`;
  const startTime = Date.now();
  const allFindings: EvalFinding[] = [];

  // Initialize progress
  const passStatuses: Record<string, Record<EvalPass, PassStatus>> = {};
  const passErrors: Record<string, Partial<Record<EvalPass, string>>> = {};
  for (const moduleId of moduleIds) {
    passStatuses[moduleId] = {} as Record<EvalPass, PassStatus>;
    passErrors[moduleId] = {};
    for (const pass of passesFor(moduleId)) {
      passStatuses[moduleId][pass] = 'pending';
    }
  }

  const totalSteps = moduleIds.reduce((sum, m) => sum + passesFor(m).length, 0);
  let completedSteps = 0;

  const progress: EvalProgress = {
    status: 'running',
    currentModule: null,
    currentPass: null,
    completedSteps: 0,
    totalSteps,
    passStatuses,
    findings: [],
    error: null,
  };

  const emitProgress = () => {
    progress.completedSteps = completedSteps;
    progress.findings = [...allFindings];
    // Snapshot passStatuses with a shallow structural copy instead of a full
    // JSON deep clone. The engine mutates `passStatuses[module][pass]` in place
    // between emits, so each consumer snapshot must own its own outer object and
    // per-module rows; the leaf values are immutable strings and can be shared.
    // This is content-identical to the deep clone but avoids serializing the
    // whole nested record (~17×4 cells) on every one of ~140 emits per scan.
    const passStatusesSnapshot: typeof passStatuses = {};
    for (const m in passStatuses) {
      passStatusesSnapshot[m] = { ...passStatuses[m] };
    }
    onProgress?.({ ...progress, passStatuses: passStatusesSnapshot });
  };

  emitProgress();

  // Flatten module × pass into an ordered work list. The index is the work
  // item's position in strict (module, pass) order — identical to the old
  // nested-loop traversal. Each task writes its findings into its own slot so
  // the final aggregate is order-independent of completion order (see below).
  interface WorkItem {
    index: number;
    moduleId: string;
    pass: EvalPass;
  }
  // Per-work-item findings slots. Flattening these in `index` order reproduces
  // the exact `allFindings` sequence the serial loop produced, regardless of
  // which pass finishes first under concurrency — so dedup/aggregate output is
  // byte-identical to the sequential version.
  const findingsByIndex: EvalFinding[][] = [];
  const workItems: WorkItem[] = [];
  // Resume: a pass an earlier run of this scan already finished ('done') is
  // replayed from its recorded findings into its own slot, never re-run.
  const resumed = new Map(
    resumeFrom.filter((o) => o.status === 'done').map((o) => [`${o.moduleId}::${o.pass}`, o.findings]),
  );
  for (const moduleId of moduleIds) {
    for (const pass of passesFor(moduleId)) {
      const index = findingsByIndex.length;
      const prior = resumed.get(`${moduleId}::${pass}`);
      findingsByIndex.push(prior ?? []);
      if (prior) {
        passStatuses[moduleId][pass] = 'done';
        completedSteps++;
      } else {
        workItems.push({ index, moduleId, pass });
      }
    }
  }
  if (resumed.size > 0) emitProgress();

  // Bounded concurrency. Claude CLI passes are slow (30-120s) and rate-limited,
  // so we cap in-flight passes at a small pool rather than firing all ~69 at
  // once. N=4 roughly quarters wall-clock time while staying resource-safe.
  const CONCURRENCY = 4;

  // Run a single pass. Concurrency-safe because each task touches only its own
  // `passStatuses[moduleId][pass]` cell and its own `findingsByIndex[index]`
  // slot — no two tasks ever write the same cell, so the shared snapshot taken
  // by emitProgress cannot be corrupted. `completedSteps++` is a synchronous
  // statement with no `await` between read and write, so JS's single-threaded
  // execution makes the increment atomic across tasks. `currentModule`/
  // `currentPass` become "latest started/finished" hints (last-writer-wins),
  // which is acceptable for a progress indicator.
  const runPass = async (item: WorkItem): Promise<void> => {
    const { index, moduleId, pass } = item;
    if (signal.aborted) throw abortError();

    progress.currentModule = moduleId;
    progress.currentPass = pass;
    passStatuses[moduleId][pass] = 'running';
    emitProgress();

    let error: string | null = null;
    try {
      const fullPrompt = buildDeepEvalPassPrompt(projectContext, moduleId as SubModuleId, pass);
      const rawOutput = await executePass(fullPrompt, projectPath, signal, { moduleId, pass });
      if (signal.aborted) throw abortError();

      // Parse findings from output — into this task's own slot. A pass that ran
      // but returned no findings array is UNMEASURED, not clean: it errors with a
      // named reason instead of reading as zero findings.
      const parsed = parseFindingsStrict(rawOutput, scanId, moduleId as SubModuleId, pass);
      if (parsed.ok) findingsByIndex[index] = parsed.data;
      else error = parsed.error;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      error = `cli-error: ${err instanceof Error ? err.message : String(err)}`;
    }

    passStatuses[moduleId][pass] = error ? 'error' : 'done';
    if (error) passErrors[moduleId][pass] = error;
    onPassEnd?.({ moduleId, pass, status: error ? 'error' : 'done', findings: findingsByIndex[index], error });
    completedSteps++;
    emitProgress();
  };

  // Fixed-size worker pool: each worker pulls the next item off a shared cursor
  // until the list is drained, keeping at most CONCURRENCY passes in flight.
  // An AbortError from any worker rejects Promise.all and propagates to the
  // catch below, mirroring the serial loop's cancellation behavior.
  const runPool = async (): Promise<void> => {
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < workItems.length) {
        if (signal.aborted) throw abortError();
        const item = workItems[cursor++];
        await runPass(item);
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, workItems.length) }, () => worker());
    await Promise.all(workers);
  };

  try {
    await runPool();

    // Collect findings in deterministic (module, pass) order, independent of
    // task completion order.
    for (const slot of findingsByIndex) allFindings.push(...slot);

    // Deduplicate and aggregate
    const deduplicated = deduplicateFindings(allFindings);
    const aggregated = aggregateFindings(deduplicated, scanId);

    progress.status = 'completed';
    progress.currentModule = null;
    progress.currentPass = null;
    progress.findings = deduplicated;
    emitProgress();

    return {
      scanId,
      findings: aggregated,
      duration: Date.now() - startTime,
      modulesEvaluated: moduleIds,
      passesRun,
      failedModules: modulesWithErroredPasses(moduleIds, passStatuses),
      passStatuses: snapshotStatuses(passStatuses),
      passErrors,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      progress.status = 'cancelled';
      progress.error = 'Evaluation was cancelled';
    } else {
      progress.status = 'error';
      progress.error = (err as Error).message;
    }
    progress.currentModule = null;
    progress.currentPass = null;
    emitProgress();

    // Still return what we have. The try-block flatten never ran (runPool
    // threw), so gather whatever slots completed before the abort/error, in
    // deterministic (module, pass) order.
    allFindings.length = 0;
    for (const slot of findingsByIndex) allFindings.push(...slot);
    const deduplicated = deduplicateFindings(allFindings);
    const aggregated = aggregateFindings(deduplicated, scanId);
    return {
      scanId,
      findings: aggregated,
      duration: Date.now() - startTime,
      // Honest contract on the abort/error path: only modules whose every pass
      // actually finished count as evaluated. Modules cut short by the abort
      // (pending/running passes) are ALSO in failedModules — the baseline-merge
      // scope in applyScanResult subtracts failedModules, so this keeps a
      // cancelled run from ever reading as "evaluated clean, zero findings"
      // even for a consumer that forgets to subtract.
      modulesEvaluated: modulesFullyCompleted(moduleIds, passStatuses),
      passesRun,
      failedModules: modulesWithErroredPasses(moduleIds, passStatuses),
      passStatuses: snapshotStatuses(passStatuses),
      passErrors,
    };
  }
}

/** Per-module row copies, so a returned result never aliases the live cells. */
function snapshotStatuses(
  passStatuses: Record<string, Record<EvalPass, PassStatus>>,
): Record<string, Record<EvalPass, PassStatus>> {
  const out: Record<string, Record<EvalPass, PassStatus>> = {};
  for (const m in passStatuses) out[m] = { ...passStatuses[m] };
  return out;
}

/** Modules whose evaluation is incomplete: any pass errored (or never ran). */
function modulesWithErroredPasses(
  moduleIds: string[],
  passStatuses: Record<string, Record<EvalPass, PassStatus>>,
): string[] {
  return moduleIds.filter((m) =>
    Object.values(passStatuses[m] ?? {}).some((s) => s === 'error' || s === 'pending' || s === 'running'),
  );
}

/** Modules whose every pass fully completed (done/skipped) — the only ones an
 *  aborted run may honestly claim as evaluated. */
function modulesFullyCompleted(
  moduleIds: string[],
  passStatuses: Record<string, Record<EvalPass, PassStatus>>,
): string[] {
  return moduleIds.filter((m) =>
    Object.values(passStatuses[m] ?? {}).every((s) => s === 'done' || s === 'skipped'),
  );
}
