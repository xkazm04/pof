/**
 * run-trend: a scenario's retained run history (newest first) classified into
 * what changed since the previous run. No 'flaky' kind - a pass/fail flip on an
 * unchanged scenario definition is not evidence of non-determinism, because the
 * BT/C++ under test is not fingerprinted.
 */
import { describe, it, expect } from 'vitest';
import { classifyTrend, summarizeTrends, scenarioDefinitionHash } from '@/lib/ai-testing/run-trend';
import type { ScenarioRunRecord, TestScenario } from '@/types/ai-testing';

let n = 0;
function run(status: ScenarioRunRecord['status'], definitionHash: string): ScenarioRunRecord {
  n += 1;
  return { runId: `r-${String(n).padStart(8, '0')}`, status, ranAt: `2026-09-30T10:00:${String(60 - n).padStart(2, '0')}.000Z`, definitionHash };
}

function scenario(history: ScenarioRunRecord[]): TestScenario {
  n += 1;
  return {
    id: n, suiteId: 1, name: `S${n}`, description: '', stimuli: [], expectedActions: [],
    status: history[0]?.status ?? 'draft', lastRunOutput: '', lastRunAt: history[0]?.ranAt ?? null,
    createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', history,
  };
}

describe('classifyTrend (case 4)', () => {
  it('names a regression, a fix after an edit, a steady pass and a never-run scenario', () => {
    expect(classifyTrend([run('failed', 'h1'), run('passed', 'h1')])).toEqual({ kind: 'regressed', afterEdit: false });
    expect(classifyTrend([run('passed', 'h2'), run('failed', 'h1')])).toEqual({ kind: 'fixed', afterEdit: true });
    expect(classifyTrend([run('passed', 'h1'), run('passed', 'h1')]).kind).toBe('steady-pass');
    expect(classifyTrend([]).kind).toBe('never-run');
  });

  it('an error run counts as not-passing: passed -> error regresses, error -> failed stays failing', () => {
    expect(classifyTrend([run('error', 'h1'), run('passed', 'h1')]).kind).toBe('regressed');
    expect(classifyTrend([run('failed', 'h1'), run('error', 'h1')]).kind).toBe('steady-fail');
  });

  it('never calls a scenario flaky, however often it flipped on one definition', () => {
    const t = classifyTrend([run('passed', 'h1'), run('failed', 'h1'), run('passed', 'h1'), run('failed', 'h1')]);
    expect(t.kind).toBe('fixed');
    expect(JSON.stringify(t)).not.toMatch(/flak/i);
  });
});

describe('summarizeTrends (case 6, revised: no flaky count)', () => {
  it('{regressed x2, fixed x1, steady x3} -> {regressed:2, fixed:1}', () => {
    const scenarios = [
      scenario([run('failed', 'h'), run('passed', 'h')]),
      scenario([run('error', 'h'), run('passed', 'h')]),
      scenario([run('passed', 'h'), run('failed', 'h')]),
      scenario([run('passed', 'h'), run('passed', 'h')]),
      scenario([run('failed', 'h'), run('failed', 'h')]),
      scenario([run('passed', 'h')]),
    ];
    expect(summarizeTrends(scenarios)).toEqual({ regressed: 2, fixed: 1 });
  });

  it('a scenario with no history field (older payload) is never-run, not a crash', () => {
    const s = scenario([]);
    delete s.history;
    expect(summarizeTrends([s])).toEqual({ regressed: 0, fixed: 0 });
  });
});

describe('scenarioDefinitionHash', () => {
  it('is stable for the same definition and changes when description, stimuli or expected actions change', () => {
    const base = { description: 'd', stimuli: [], expectedActions: [] };
    const h = scenarioDefinitionHash(base);
    expect(scenarioDefinitionHash({ ...base })).toBe(h);
    expect(scenarioDefinitionHash({ ...base, description: 'e' })).not.toBe(h);
    expect(scenarioDefinitionHash({ ...base, expectedActions: [{ id: 'x', action: 'Chase', btNode: '', timeoutSeconds: 5 }] })).not.toBe(h);
  });
});
