/**
 * Deep Evaluation Engine — multi-pass orchestrator.
 *
 * Runs specialized analysis per module with 4 passes (ground-truth, structure,
 * quality, perf); arpg-combat adds a 5th combat-trace pass via getPassesForModule.
 * Each pass produces structured findings that are collected, deduplicated, and
 * aggregated into a comprehensive scan report.
 *
 * This engine runs client-side and calls the existing /api/claude-terminal/query
 * endpoint for each evaluation pass.
 */

import type { SubModuleId } from '@/types/modules';
import { buildEvalPrompt, PASS_LABELS, getEvaluableModuleIds, getPassesForModule } from './module-eval-prompts';
import type { EvalPass } from './module-eval-prompts';
import { parseFindings, deduplicateFindings, aggregateFindings } from './finding-collector';
import type { EvalFinding, ScanFindings } from './finding-collector';
import { buildProjectContextHeader } from '@/lib/prompt-context';
import type { ProjectContext } from '@/lib/prompt-context';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EvalStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled';

export interface EvalProgress {
  status: EvalStatus;
  currentModule: string | null;
  currentPass: EvalPass | null;
  completedSteps: number;
  totalSteps: number;
  /** Module -> pass -> status */
  passStatuses: Record<string, Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>>;
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
}

// ─── Engine ──────────────────────────────────────────────────────────────────

let abortController: AbortController | null = null;

/**
 * Cancel any running deep evaluation.
 */
export function cancelDeepEval(): void {
  abortController?.abort();
  abortController = null;
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
    onProgress,
  } = options;

  // When the caller doesn't pin specific passes, expand per module so that a
  // module with an extra pass (arpg-combat's combat-trace) runs it and others
  // are unchanged. An explicit `passes` override is honored verbatim.
  const passesFor = (moduleId: string): EvalPass[] => passes ?? getPassesForModule(moduleId);
  const passesRun: EvalPass[] = passes
    ? passes
    : Array.from(new Set(moduleIds.flatMap((m) => passesFor(m))));

  abortController = new AbortController();
  const signal = abortController.signal;

  const scanId = `deep-${Date.now()}`;
  const startTime = Date.now();
  const allFindings: EvalFinding[] = [];

  const moduleName = projectContext.projectName || 'MyProject';
  const sourcePath = `Source/${moduleName}/`;

  // Initialize progress
  const passStatuses: Record<string, Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>> = {};
  for (const moduleId of moduleIds) {
    passStatuses[moduleId] = {} as Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>;
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
  const workItems: WorkItem[] = [];
  for (const moduleId of moduleIds) {
    for (const pass of passesFor(moduleId)) {
      workItems.push({ index: workItems.length, moduleId, pass });
    }
  }
  // Per-work-item findings slots. Flattening these in `index` order reproduces
  // the exact `allFindings` sequence the serial loop produced, regardless of
  // which pass finishes first under concurrency — so dedup/aggregate output is
  // byte-identical to the sequential version.
  const findingsByIndex: EvalFinding[][] = workItems.map(() => []);

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
    if (signal.aborted) throw new DOMException('Evaluation cancelled', 'AbortError');

    progress.currentModule = moduleId;
    progress.currentPass = pass;
    passStatuses[moduleId][pass] = 'running';
    emitProgress();

    try {
      const prompt = buildEvalPrompt({
        moduleId: moduleId as SubModuleId,
        pass,
        projectName: projectContext.projectName,
        moduleName,
        sourcePath,
      });

      // Wrap with project context header for the CLI
      const fullPrompt = `${buildProjectContextHeader(projectContext, {
        includeBuildCommand: false,
        includeRules: true,
        extraRules: [
          'This is an EVALUATION task — do NOT modify any files.',
          'Read source files to analyze them, then output your findings.',
          'Do NOT use TodoWrite.',
        ],
      })}

${prompt}`;

      const response = await fetch('/api/claude-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          cwd: projectPath,
        }),
        signal,
      });

      if (!response.ok) {
        passStatuses[moduleId][pass] = 'error';
        completedSteps++;
        emitProgress();
        return;
      }

      // Collect streamed response
      const rawOutput = await collectStreamResponse(response, signal);

      // Parse findings from output — into this task's own slot.
      findingsByIndex[index] = parseFindings(rawOutput, scanId, moduleId as SubModuleId, pass);

      passStatuses[moduleId][pass] = 'done';
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      passStatuses[moduleId][pass] = 'error';
    }

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
        if (signal.aborted) throw new DOMException('Evaluation cancelled', 'AbortError');
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
      modulesEvaluated: moduleIds,
      passesRun,
      failedModules: modulesWithErroredPasses(moduleIds, passStatuses),
    };
  } finally {
    abortController = null;
  }
}

/** Modules whose evaluation is incomplete: any pass errored (or never ran). */
function modulesWithErroredPasses(
  moduleIds: string[],
  passStatuses: Record<string, Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>>,
): string[] {
  return moduleIds.filter((m) =>
    Object.values(passStatuses[m] ?? {}).some((s) => s === 'error' || s === 'pending' || s === 'running'),
  );
}

// ─── Stream collector ────────────────────────────────────────────────────────

async function collectStreamResponse(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let output = '';

  try {
    while (true) {
      if (signal.aborted) {
        reader.cancel();
        throw new DOMException('Evaluation cancelled', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Parse SSE events — extract text content
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text' || parsed.type === 'content') {
              output += parsed.text ?? parsed.content ?? '';
            } else if (parsed.type === 'result') {
              output += parsed.text ?? parsed.content ?? parsed.result ?? '';
            } else if (typeof parsed === 'string') {
              output += parsed;
            }
          } catch {
            // Not JSON, might be raw text
            if (data.trim() && data !== '[DONE]') {
              output += data;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return output;
}

/**
 * Run deep eval for a single module (convenience wrapper).
 */
export async function runSingleModuleEval(
  moduleId: SubModuleId,
  options: Omit<DeepEvalOptions, 'moduleIds'>,
): Promise<DeepEvalResult> {
  return runDeepEval({ ...options, moduleIds: [moduleId] });
}
