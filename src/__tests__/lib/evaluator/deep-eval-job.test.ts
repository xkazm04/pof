/**
 * Deep eval as a server job — the executor seam, strict parse, per-pass ledger and resume.
 *
 * Before this change the engine ran in the browser and POSTed every pass to
 * /api/claude-terminal/query with `{ prompt, cwd }`; the route requires `projectPath`
 * and answered 400, so 65 of 65 passes of a full run landed 'error' and no finding was
 * ever produced. An unparseable pass output was also indistinguishable from a clean one
 * (`parseFindings` returned [] for both), and findings lived only in the tab's memory
 * until the whole run ended.
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card code-quality-evaluation/A.
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

import { runDeepEval, buildDeepEvalPassPrompt } from '@/lib/evaluator/deep-eval-engine';
import type { PassExecutor } from '@/lib/evaluator/deep-eval-engine';
import { startDeepEvalJob } from '@/lib/evaluator/deep-eval-job';
import { readPassLedger, recordPassOutcome } from '@/lib/evaluator/deep-eval-pass-ledger';
import type { ProjectContext } from '@/lib/prompt-context';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.5' };

/** One fenced JSON finding whose description names the pass, so the line-inclusive
 *  dedup (which has no pass component) keeps one finding per pass. */
function fencedFinding(pass: string, description = `issue seen by the ${pass} pass`): string {
  return 'Here is what I found:\n```json\n' + JSON.stringify([
    { category: 'General', severity: 'medium', file: 'Source/PoF/A.cpp', line: 10, description, suggestedFix: 'fix', effort: 'small' },
  ]) + '\n```';
}

const flush = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe('runDeepEval — every pass reaches an injected executor', () => {
  it('case 1: arpg-combat runs 5 passes through executePass with projectPath and the eval prompt', async () => {
    const calls: { prompt: string; projectPath: string }[] = [];
    const executePass: PassExecutor = vi.fn(async (prompt: string, projectPath: string) => {
      calls.push({ prompt, projectPath });
      return fencedFinding(`call-${calls.length}`);
    });

    const result = await runDeepEval({ moduleIds: ['arpg-combat'], projectPath: 'C:/p', projectContext: CTX, executePass });

    expect(executePass).toHaveBeenCalledTimes(5);
    for (const c of calls) {
      expect(c.projectPath).toBe('C:/p');
      expect(c.prompt).toContain('EVALUATION task');
    }
    expect(result.failedModules).toEqual([]);
    expect(result.findings.totalFindings).toBe(5);
  });

  it('[guard] an identical finding from all 5 passes dedups to 1 (dedup is pass-agnostic, unchanged)', async () => {
    const executePass: PassExecutor = vi.fn(async () => fencedFinding('x', 'the same issue'));
    const result = await runDeepEval({ moduleIds: ['arpg-combat'], projectPath: 'C:/p', projectContext: CTX, executePass });
    expect(executePass).toHaveBeenCalledTimes(5);
    expect(result.findings.totalFindings).toBe(1);
  });

  it('case 2: an unparseable pass is an error with a named reason; [] is a clean pass', async () => {
    const m = 'audio';
    const qualityPrompt = buildDeepEvalPassPrompt(CTX, m as never, 'quality');
    const executePass: PassExecutor = vi.fn(async (prompt: string) =>
      prompt === qualityPrompt ? 'Looked at the code, all fine.' : '[]');
    const bad = await runDeepEval({ moduleIds: [m], projectPath: 'C:/p', projectContext: CTX, executePass });
    expect(bad.passStatuses[m].quality).toBe('error');
    expect(bad.passErrors[m]?.quality).toBe('unparseable-output');
    expect(bad.failedModules).toContain(m);

    const clean = await runDeepEval({
      moduleIds: [m], projectPath: 'C:/p', projectContext: CTX, executePass: vi.fn(async () => '[]'),
    });
    expect(Object.values(clean.passStatuses[m]).every((s) => s === 'done')).toBe(true);
    expect(clean.failedModules).toEqual([]);
    expect(clean.findings.totalFindings).toBe(0);
  });

  it('case 3: a CLI failure on one pass fails only that module, with the reason', async () => {
    const A = 'audio';
    const B = 'arpg-loot';
    const structurePromptA = buildDeepEvalPassPrompt(CTX, A as never, 'structure');
    const executePass: PassExecutor = vi.fn(async (prompt: string) => {
      if (prompt === structurePromptA) throw new Error('Process exited with code 1');
      return '[]';
    });

    const result = await runDeepEval({ moduleIds: [A, B], projectPath: 'C:/p', projectContext: CTX, executePass });
    expect(result.failedModules).toEqual([A]);
    expect(result.passErrors[A]?.structure).toBe('cli-error: Process exited with code 1');
    expect(result.modulesEvaluated).toContain(B);
    expect(result.failedModules).not.toContain(B);
  });
});

describe('deep-eval job — each pass is persisted as it ends, and a resumed job skips recorded passes', () => {
  it('case 4: the ledger holds a finished pass while another is still in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let n = 0;
    const executePass: PassExecutor = vi.fn(async () => {
      n++;
      if (n === 1) return fencedFinding('first');
      await gate;
      return '[]';
    });

    const started = startDeepEvalJob({
      projectPath: 'C:/ledger-proj',
      projectContext: { ...CTX, projectPath: 'C:/ledger-proj' },
      moduleIds: ['audio', 'arpg-loot', 'materials'],
      executePass,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const { scanId, done } = started.data;

    await flush();
    const mid = readPassLedger(scanId);
    expect(mid).toHaveLength(1);
    expect(mid[0]).toMatchObject({ moduleId: 'audio', pass: 'ground-truth', status: 'done' });
    expect(mid[0].findings).toHaveLength(1);

    release();
    const result = await done;
    expect(readPassLedger(scanId)).toHaveLength(12);
    expect(result.failedModules).toEqual([]);
  });

  it('case 5: resume runs only the passes the ledger has not recorded, and reports all 4 in (module, pass) order', async () => {
    const S = 'deep-resume-1';
    const m = 'audio';
    const prior = (pass: 'ground-truth' | 'structure'): EvalFinding => ({
      id: `${S}-${m}-${pass}-0`, scanId: S, moduleId: m as EvalFinding['moduleId'], pass,
      category: 'General', severity: 'low', file: `${pass}.cpp`, line: 1,
      description: `${pass} finding`, suggestedFix: '', effort: 'small', timestamp: 1,
    });
    recordPassOutcome(S, 'C:/resume-proj', { moduleId: m, pass: 'ground-truth', status: 'done', findings: [prior('ground-truth')], error: null });
    recordPassOutcome(S, 'C:/resume-proj', { moduleId: m, pass: 'structure', status: 'done', findings: [prior('structure')], error: null });

    const prompts: string[] = [];
    const ctx = { ...CTX, projectPath: 'C:/resume-proj' };
    const executePass: PassExecutor = vi.fn(async (prompt: string) => {
      prompts.push(prompt);
      const pass = prompt === buildDeepEvalPassPrompt(ctx, m as never, 'quality') ? 'quality' : 'performance';
      return fencedFinding(pass, `${pass} finding`);
    });

    const started = startDeepEvalJob({ scanId: S, moduleIds: [m], projectPath: 'C:/resume-proj', projectContext: ctx, executePass });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const result = await started.data.done;

    expect(executePass).toHaveBeenCalledTimes(2);
    expect(prompts).toEqual([
      buildDeepEvalPassPrompt(ctx, m as never, 'quality'),
      buildDeepEvalPassPrompt(ctx, m as never, 'performance'),
    ]);
    const mod = result.findings.modules.find((x) => x.moduleId === m);
    expect(mod?.findings.map((f) => f.pass)).toEqual(['ground-truth', 'structure', 'quality', 'performance']);
    expect(result.failedModules).toEqual([]);
    expect(readPassLedger(S)).toHaveLength(4);
  });

  it('a second start for the same project while running is refused', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const executePass: PassExecutor = vi.fn(async () => { await gate; return '[]'; });
    const first = startDeepEvalJob({ projectPath: 'C:/busy', moduleIds: ['audio'], executePass });
    expect(first.ok).toBe(true);
    const second = startDeepEvalJob({ projectPath: 'C:/busy', moduleIds: ['audio'], executePass });
    expect(second).toEqual({ ok: false, error: 'already-running' });
    release();
    if (first.ok) await first.data.done;
  });
});
