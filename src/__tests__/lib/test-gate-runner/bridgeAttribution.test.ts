import { describe, it, expect } from 'vitest';
import { interpretAutomationResult, automationOutcome, makeBridgeExecutor } from '@/lib/test-gate-runner/bridgeExecutor';
import { attributeUniquely, ambiguousMatchDetail, AMBIGUOUS_MATCH_DETAIL } from '@/lib/ue-automation/abslog';

/**
 * The bridge executor correlates a plugin results array to the gate that requested it by
 * matching the requested name against recorded testIds. Without a uniqueness guard, a name
 * that is a substring of an UNRELATED registered test path attributes that test's pass/fail
 * to this gate — the only false-verdict path in the runner. These pin the guard.
 */

function resp(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

describe('attributeUniquely — the ONE shared attribution rule', () => {
  it('resolves a single candidate', () => {
    expect(attributeUniquely(['A'])).toEqual({ kind: 'unique', id: 'A' });
  });

  it('treats duplicate spellings of the SAME id as one identity, not a collision', () => {
    expect(attributeUniquely(['A', 'A', 'A'])).toEqual({ kind: 'unique', id: 'A' });
  });

  it('refuses two distinct candidates', () => {
    expect(attributeUniquely(['A', 'B'])).toMatchObject({ kind: 'ambiguous', ids: ['A', 'B'] });
  });

  it('is `none` for an empty / blank candidate set', () => {
    expect(attributeUniquely([]).kind).toBe('none');
    expect(attributeUniquely(['', '   ']).kind).toBe('none');
  });

  it('names the collision (bounded) in the shared vocabulary', () => {
    const detail = ambiguousMatchDetail('VSItemsTest', ['X.VSItemsTest', 'Y.VSItemsTestExtended']);
    expect(detail).toContain(AMBIGUOUS_MATCH_DETAIL);
    expect(detail).toContain('X.VSItemsTest');
    expect(detail).toContain('Y.VSItemsTestExtended');
    expect(ambiguousMatchDetail('n', ['a', 'b', 'c', 'd', 'e'])).toContain('…');
  });
});

describe('interpretAutomationResult — colliding testIds attribute NOTHING', () => {
  const colliding = {
    results: [
      { testId: 'Project.Functional Tests.Maps.Arena.VSItemsTest', status: 'passed' },
      { testId: 'Project.Functional Tests.Maps.Vault.VSItemsTestExtended', status: 'failed' },
    ],
  };

  it('does not attribute a pass or a fail when two recorded tests match the name', () => {
    const r = interpretAutomationResult(colliding, 'VSItemsTest');
    expect(r.ambiguous).toBe(true);
    expect(r.terminal).toBe(false);
    expect(r.status).toBeUndefined();
    expect(r.detail).toContain('VSItemsTestExtended');
  });

  it('would previously have inherited the sibling FAIL — now it inherits nothing', () => {
    // Both directions of the false verdict are covered: a colliding PASS is not a pass either.
    const bothPassing = {
      results: [
        { testId: 'A.VSItemsTest', status: 'passed' },
        { testId: 'B.VSItemsTestExtended', status: 'passed' },
      ],
    };
    expect(interpretAutomationResult(bothPassing, 'VSItemsTest')).toMatchObject({ ambiguous: true, terminal: false });
  });

  it('keeps working unchanged for an unambiguous match (and reports WHICH id it credited)', () => {
    const payload = {
      results: [
        { testId: 'Project.Functional Tests.PoF.VSItemsTest', status: 'failed' },
        { testId: 'Other.Test', status: 'passed' },
      ],
    };
    expect(interpretAutomationResult(payload, 'VSItemsTest')).toMatchObject({
      terminal: true,
      status: 'fail',
      testId: 'Project.Functional Tests.PoF.VSItemsTest',
    });
  });

  it('the SAME testId recorded twice is still one test (not a collision)', () => {
    const payload = { results: [{ testId: 'A.VSItemsTest', status: 'passed' }, { testId: 'A.VSItemsTest', status: 'passed' }] };
    expect(interpretAutomationResult(payload, 'VSItemsTest')).toMatchObject({ terminal: true, status: 'pass' });
  });

  it('the no-matchName batch aggregate is untouched by the guard', () => {
    expect(interpretAutomationResult({ results: [{ testId: 'a', status: 'passed' }, { testId: 'b', status: 'passed' }] }))
      .toMatchObject({ terminal: true, status: 'pass' });
  });
});

describe('automationOutcome — ambiguity degrades to DEFERRED, never fail', () => {
  const colliding = {
    results: [
      { testId: 'A.NPCConfig', status: 'failed' },
      { testId: 'B.NPCConfigLegacy', status: 'passed' },
    ],
  };

  it('returns a terminal deferred verdict naming the collision', () => {
    const out = automationOutcome('NPCConfig', colliding);
    expect(out.kind).toBe('verdict');
    if (out.kind !== 'verdict') return;
    expect(out.verdict.status).toBe('deferred');
    expect(out.verdict.detail).toContain('NPCConfigLegacy');
    expect(out.verdict.evidence).toMatchObject({ kind: 'bridge' });
  });
});

describe('makeBridgeExecutor — a colliding results array parks the gate deferred', () => {
  const job = { catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3' as const, testName: 'VSItemsTest' };

  it('does not burn the poll budget and does not fail the gate', async () => {
    let polls = 0;
    const fetchImpl = ((url: string) => {
      if (/run-automation$/.test(url)) return resp({ status: 'accepted' });
      polls++;
      return resp({
        results: [
          { testId: 'Maps.Arena.VSItemsTest', status: 'passed' },
          { testId: 'Maps.Vault.VSItemsTestExtended', status: 'failed' },
        ],
      });
    }) as unknown as typeof fetch;
    const ex = makeBridgeExecutor({ fetchImpl, pollMs: 1, maxPolls: 5 });
    const v = await ex.run(job);
    expect(v.status).toBe('deferred');
    expect(v.detail).toContain('VSItemsTest');
    expect(v.detail).toContain(AMBIGUOUS_MATCH_DETAIL);
    // Ambiguity is terminal — polling cannot break a name collision.
    expect(polls).toBe(1);
  });
});
