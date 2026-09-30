import { describe, it, expect, vi } from 'vitest';
import { runDeepEval } from '@/lib/evaluator/deep-eval-engine';
import type { PassExecutor } from '@/lib/evaluator/deep-eval-engine';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';

/**
 * Regression pin for scan 2026-07-16 quality-evaluation-engine finding #1:
 * a cancelled deep eval must never claim modules it did not finish as
 * "evaluated" — otherwise applyScanResult's baseline merge would treat them
 * as evaluated-clean and report their real prior findings as falsely RESOLVED
 * (and persist that corruption server-side).
 *
 * Contract under test (the abort path of runDeepEval):
 *  - `modulesEvaluated` contains ONLY modules whose every pass completed;
 *  - every module cut short by the abort appears in `failedModules`;
 *  - therefore scope = modulesEvaluated \ failedModules can never include an
 *    unfinished module, for any consumer — even one that forgets the subtraction.
 *
 * Cancellation arrives through the run's `signal` (the server deep-eval job aborts it
 * and kills the in-flight CLI executions); passes go through an injected executor.
 */
describe('runDeepEval — cancellation honesty', () => {
  // Every eval pass hangs until its abort signal fires, then rejects with
  // AbortError — simulating in-flight CLI passes at the moment of Cancel.
  const hangingExecutor: PassExecutor = vi.fn((_prompt: string, _path: string, signal: AbortSignal) =>
    new Promise<string>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Evaluation cancelled', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () =>
        reject(new DOMException('Evaluation cancelled', 'AbortError')),
      );
    }),
  );

  it('a cancelled run claims no unfinished module as evaluated', async () => {
    const moduleIds = getEvaluableModuleIds().slice(0, 3);
    expect(moduleIds.length).toBeGreaterThan(0);

    const controller = new AbortController();
    const resultPromise = runDeepEval({
      moduleIds,
      projectContext: { projectName: 'TestProj', projectPath: 'C:/tmp/test', ueVersion: '5.4' },
      projectPath: 'C:/tmp/test',
      executePass: hangingExecutor,
      signal: controller.signal,
    });

    // Let the worker pool dispatch its first in-flight passes, then cancel.
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();

    const result = await resultPromise;

    // Nothing completed, so nothing may be claimed as evaluated…
    expect(result.modulesEvaluated).toEqual([]);
    // …and every requested module is reported as failed/incomplete.
    expect([...result.failedModules].sort()).toEqual([...moduleIds].sort());
    // The scope every consumer derives (evaluated minus failed) is empty —
    // the baseline merge keeps ALL prior findings, resolving nothing falsely.
    const scope = result.modulesEvaluated.filter((m) => !result.failedModules.includes(m));
    expect(scope).toEqual([]);
    expect(result.findings.totalFindings).toBe(0);
  });
});
