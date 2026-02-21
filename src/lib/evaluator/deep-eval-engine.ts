/**
 * Deep Evaluation Engine — multi-pass orchestrator.
 *
 * Runs specialized analysis per module with 3 passes (structure, quality, perf).
 * Each pass produces structured findings that are collected, deduplicated, and
 * aggregated into a comprehensive scan report.
 *
 * This engine runs client-side and calls the existing /api/claude-terminal/query
 * endpoint for each evaluation pass.
 */

import type { SubModuleId } from '@/types/modules';
import { buildEvalPrompt, EVAL_PASSES, PASS_LABELS, getEvaluableModuleIds } from './module-eval-prompts';
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
    passes = EVAL_PASSES,
    projectContext,
    projectPath,
    onProgress,
  } = options;

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
    for (const pass of passes) {
      passStatuses[moduleId][pass] = 'pending';
    }
  }

  const totalSteps = moduleIds.length * passes.length;
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
    onProgress?.({ ...progress, passStatuses: JSON.parse(JSON.stringify(passStatuses)) });
  };

  emitProgress();

  try {
    // Sequential per-module, sequential per-pass
    for (const moduleId of moduleIds) {
      if (signal.aborted) throw new DOMException('Evaluation cancelled', 'AbortError');

      for (const pass of passes) {
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
            continue;
          }

          // Collect streamed response
          const rawOutput = await collectStreamResponse(response, signal);

          // Parse findings from output
          const findings = parseFindings(rawOutput, scanId, moduleId as SubModuleId, pass);
          allFindings.push(...findings);

          passStatuses[moduleId][pass] = 'done';
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err;
          passStatuses[moduleId][pass] = 'error';
        }

        completedSteps++;
        emitProgress();
      }
    }

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
      passesRun: passes,
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

    // Still return what we have
    const deduplicated = deduplicateFindings(allFindings);
    const aggregated = aggregateFindings(deduplicated, scanId);
    return {
      scanId,
      findings: aggregated,
      duration: Date.now() - startTime,
      modulesEvaluated: moduleIds,
      passesRun: passes,
    };
  } finally {
    abortController = null;
  }
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
