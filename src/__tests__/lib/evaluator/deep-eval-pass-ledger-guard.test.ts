/**
 * scan-sweep night 2026-11-08 (module-evaluator): the pass ledger replays recorded
 * findings into a resumed scan, so what it reads back must be the shape the engine
 * dedups. Before, `findings_json` was cast unchecked (`as EvalFinding[]`) and `pass`
 * cast to EvalPass: one recorded `done` row holding a non-finding (`{}`, `null`) made
 * deduplicateFindings throw on BOTH the engine's success and abort paths, so the
 * resumed run rejected and evaluated nothing.
 *
 * Contract: a recorded pass whose findings are not all findings is read as `error`
 * (unmeasured — re-run on resume), never replayed; a row with a pass outside the
 * vocabulary is not read at all.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn(() => 'exec-unused'),
  abortExecution: vi.fn(() => true),
  getExecution: vi.fn(() => undefined),
}));

import { getDb } from '@/lib/db';
import { readPassLedger, recordPassOutcome } from '@/lib/evaluator/deep-eval-pass-ledger';
import { startDeepEvalJob, getDeepEvalJob } from '@/lib/evaluator/deep-eval-job';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { PassExecutor } from '@/lib/evaluator/deep-eval-engine';

function finding(pass: EvalFinding['pass']): EvalFinding {
  return {
    id: `f-${pass}`, scanId: 'S', moduleId: 'audio', pass, category: 'General', severity: 'medium',
    file: 'Source/PoF/A.cpp', line: 1, description: `${pass} issue`, suggestedFix: 'fix', effort: 'small', timestamp: 0,
  };
}

describe('readPassLedger — reads back only what it can replay', () => {
  it('a done row with a non-finding element reads as error; a valid one replays', () => {
    recordPassOutcome('L1', 'C:/p', { moduleId: 'audio', pass: 'structure', status: 'done', findings: [finding('structure')], error: null });
    recordPassOutcome('L1', 'C:/p', { moduleId: 'audio', pass: 'quality', status: 'done', findings: [{} as EvalFinding], error: null });
    recordPassOutcome('L1', 'C:/p', { moduleId: 'audio', pass: 'performance', status: 'done', findings: [null as unknown as EvalFinding], error: null });

    const rows = readPassLedger('L1');
    const byPass = Object.fromEntries(rows.map((r) => [r.pass, r]));
    expect(byPass.structure.status).toBe('done');
    expect(byPass.structure.findings).toHaveLength(1);
    expect(byPass.quality.status).toBe('error');
    expect(byPass.quality.findings).toEqual([]);
    expect(byPass.quality.error).toMatch(/unreadable/);
    expect(byPass.performance.status).toBe('error');
  });

  it('a row whose pass is outside the vocabulary is not read', () => {
    getDb().prepare(
      "INSERT INTO deep_eval_passes (scan_id, project_id, module_id, pass, status, findings_json) VALUES ('L2', 'C:/p', 'audio', 'retired-pass', 'done', '[]')",
    ).run();
    recordPassOutcome('L2', 'C:/p', { moduleId: 'audio', pass: 'structure', status: 'done', findings: [], error: null });
    expect(readPassLedger('L2').map((r) => r.pass)).toEqual(['structure']);
  });

  it('a resumed job re-runs the unreadable pass and completes', async () => {
    recordPassOutcome('L3', 'C:/resume-bad', { moduleId: 'audio', pass: 'ground-truth', status: 'done', findings: [{} as EvalFinding], error: null });
    const executePass: PassExecutor = vi.fn(async () => '[]');
    const started = startDeepEvalJob({
      scanId: 'L3', projectPath: 'C:/resume-bad', moduleIds: ['audio'], executePass,
      projectContext: { projectName: 'PoF', projectPath: 'C:/resume-bad', ueVersion: '5.5' },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await started.data.done.catch(() => undefined);
    const snap = getDeepEvalJob('C:/resume-bad');
    expect(snap?.status).toBe('completed');
    expect(snap?.result?.failedModules).toEqual([]);
    expect(executePass).toHaveBeenCalledTimes(4);
  });
});

describe('resume is scoped to the project the ledger rows came from', () => {
  it('a scanId recorded under another project replays nothing into this one', async () => {
    recordPassOutcome('L4', 'C:/proj-a', { moduleId: 'audio', pass: 'structure', status: 'done', findings: [finding('structure')], error: null });
    expect(readPassLedger('L4', 'C:/proj-b')).toEqual([]);
    expect(readPassLedger('L4', 'C:/proj-a')).toHaveLength(1);

    const executePass: PassExecutor = vi.fn(async () => '[]');
    const started = startDeepEvalJob({
      scanId: 'L4', projectPath: 'C:/proj-b', moduleIds: ['audio'], executePass,
      projectContext: { projectName: 'PoF', projectPath: 'C:/proj-b', ueVersion: '5.5' },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const result = await started.data.done;
    expect(executePass).toHaveBeenCalledTimes(4);
    expect(result.findings.totalFindings).toBe(0);
  });
});
