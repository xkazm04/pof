import { describe, it, expect } from 'vitest';
import { explainAcceptance } from '@/lib/catalog/acceptance/explainAcceptance';
import { resolveStepAcceptance } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * `explainAcceptance` answers "why is this step this colour?" across the three grading
 * layers. These pin the three shapes the answer must cover — a plain checker pass, a
 * server-overlaid deferred, and a judge-bridged fail — and, above all, that explaining
 * NEVER changes the verdict.
 */

const res = (over: Partial<AcceptanceResult> = {}): AcceptanceResult => ({
  label: 'Shape', status: 'pass', tier: 'L0', detail: '', ...over,
});

const checkerOf = (r: AcceptanceResult): Checker => () => r;

const verdict = (over: Partial<JudgeVerdict> = {}): JudgeVerdict => ({
  catalogId: 'items', entityId: 'e1', step: 'Economy',
  judge: 'llm', verdict: 'fail', score: 41, findings: 'prices are incoherent with the power curve',
  rubricVersion: RUBRIC_VERSION, judgedAt: '2026-07-20 10:00:00', ...over,
} as JudgeVerdict);

describe('explainAcceptance — the acceptance chain', () => {
  it('a plain checker pass: the checker decided it, and no later layer acted', () => {
    const local = res({ status: 'pass', tier: 'L0' });
    const e = explainAcceptance({ step: 'Economy', local, data: { price: 10 } });

    expect(e.decidedBy).toBe('checker');
    expect(e.final.status).toBe('pass');
    expect(e.layers.map((l) => l.id)).toEqual(['checker', 'server-overlay', 'judge-bridge']);
    expect(e.layers.map((l) => l.won)).toEqual([true, false, false]);
    expect(e.layers[0].output).toBe('pass · L0');
    // The precedence rule is STATED, not implied.
    expect(e.layers[1].note).toMatch(/wins ONLY over a local "deferred"/);
    expect(e.layers[2].note).toMatch(/No judge verdict/);
  });

  it('names the allOf MEMBER that produced the reported status and tier', () => {
    const shape = checkerOf(res({ label: 'Fields populated', status: 'pass', tier: 'L0' }));
    const budget = checkerOf(res({ label: 'Budget within cap', status: 'fail', tier: 'L2', reason: 'price/power 1.43x' }));
    const composed = allOf(shape, budget);
    const data = { price: 143 };
    const local = composed(data);

    const e = explainAcceptance({ step: 'Economy', local, checker: composed, data });
    const members = e.layers[0].members!;
    expect(members.map((m) => m.label)).toEqual(['Fields populated', 'Budget within cap']);
    expect(members.map((m) => m.spoke)).toEqual([false, true]);
    expect(members[1].reason).toBe('price/power 1.43x');
    expect(e.layers[0].note).toContain('"Budget within cap" produced the reported fail · L2');
  });

  it('a server-overlaid deferred: the overlay WON, and says why it was allowed to', () => {
    const local = res({ status: 'deferred', tier: 'L3', reason: 'needs a live UE run' });
    const persisted = { status: 'pass', tier: 'L3', reason: 'gate passed in PIE' };
    const e = explainAcceptance({ step: 'Test Gate', local, persisted, data: {} });

    expect(e.decidedBy).toBe('server-overlay');
    expect(e.final.status).toBe('pass');
    const overlay = e.layers[1];
    expect(overlay.won).toBe(true);
    expect(overlay.input).toBe('deferred · L3');
    expect(overlay.output).toBe('pass · L3');
    expect(overlay.note).toMatch(/supersedes a local deferred/);
    expect(e.layers[0].won).toBe(false);
  });

  it('a judge-bridged fail: the judge WON over a checker pass, with its provenance', () => {
    const data = { price: 10 };
    const local = res({ status: 'pass', tier: 'L0' });
    const v = verdict({ contentHash: stepContentHash(data) } as Partial<JudgeVerdict>);

    const e = explainAcceptance({ step: 'Economy', local, data, verdicts: [v], judgeClass: 'llm' });

    expect(e.decidedBy).toBe('judge-bridge');
    expect(e.final.status).toBe('fail');
    expect(e.final.judge?.provenance).toBe('current');
    const judge = e.layers[2];
    expect(judge.won).toBe(true);
    expect(judge.input).toBe('pass · L0');
    expect(judge.output).toBe('fail · L0');
    expect(judge.note).toContain('provenance current');
  });

  it('reports a verdict whose provenance cannot be confirmed as UNVERIFIED, still applied', () => {
    const local = res({ status: 'pass', tier: 'L0' });
    // No contentHash and no way to date it against the content → `unknown`.
    const e = explainAcceptance({ step: 'Economy', local, verdicts: [verdict()], judgeClass: 'llm' });
    expect(e.final.status).toBe('fail');
    expect(e.final.judge?.provenance).toBe('unknown');
    expect(e.layers[2].note).toContain('provenance unknown');
  });
});

describe('explainAcceptance — display only', () => {
  const cases: { name: string; args: Parameters<typeof explainAcceptance>[0] }[] = [
    { name: 'checker pass', args: { step: 'Economy', local: res(), data: {} } },
    {
      name: 'server-overlaid deferred',
      args: { step: 'Test Gate', local: res({ status: 'deferred', tier: 'L3' }), persisted: { status: 'fail', tier: 'L3', reason: 'gate failed' }, data: {} },
    },
    {
      name: 'judge-bridged fail',
      args: { step: 'Economy', local: res(), data: { price: 10 }, verdicts: [verdict()], judgeClass: 'llm' },
    },
    {
      name: 'wrong judge class (never speaks)',
      args: { step: 'Economy', local: res(), data: { price: 10 }, verdicts: [verdict()], judgeClass: 'vlm' },
    },
  ];

  for (const c of cases) {
    it(`final verdict is byte-identical to resolveStepAcceptance — ${c.name}`, () => {
      const explained = explainAcceptance(c.args);
      const resolved = resolveStepAcceptance({
        step: c.args.step,
        local: c.args.local,
        ...(c.args.persisted ? { persisted: c.args.persisted } : {}),
        ...(c.args.verdicts ? { verdicts: c.args.verdicts } : {}),
        ...(c.args.judgeClass ? { judgeClass: c.args.judgeClass } : {}),
        ...(c.args.data ? { data: c.args.data } : {}),
        ...(c.args.updatedAt ? { updatedAt: c.args.updatedAt } : {}),
      });
      expect(explained.final).toEqual(resolved);
    });
  }

  it('running the explanation does not mutate the local result it was given', () => {
    const local = res({ status: 'pass', tier: 'L0' });
    const snapshot = JSON.stringify(local);
    explainAcceptance({ step: 'Economy', local, data: { price: 10 }, verdicts: [verdict()], judgeClass: 'llm' });
    expect(JSON.stringify(local)).toBe(snapshot);
  });
});
