/**
 * A scenario's run verdict is derived from UE's automation report, never from the
 * CLI's claim. The claim survives only as a note in the output text.
 */
import { describe, it, expect } from 'vitest';
import { deriveRunVerdicts } from '@/lib/ai-testing/run-verdict';

const SUITE = { targetClass: 'C' };

function byId(vs: ReturnType<typeof deriveRunVerdicts>, id: number) {
  const v = vs.find((x) => x.scenarioId === id);
  if (!v) throw new Error(`no verdict for scenario ${id}`);
  return v;
}

describe('deriveRunVerdicts', () => {
  it('matches by the S<id>_ prefix: S1_ never matches S12_, so an unmatched scenario is an error, not a pass', () => {
    const vs = deriveRunVerdicts(
      { tests: [{ fullTestPath: 'AI.BehaviorTests.C.S12_Chase', state: 'Success' }] },
      [1, 12],
      [{ scenarioId: 1, status: 'passed' }, { scenarioId: 12, status: 'passed' }],
      SUITE,
    );
    expect(vs).toHaveLength(2);
    expect(byId(vs, 12).status).toBe('passed');
    expect(byId(vs, 1).status).toBe('error');
    expect(byId(vs, 1).output).toContain('AI.BehaviorTests.C.S1_');
  });

  it('the report beats the claim; the claim text is kept in the output', () => {
    const vs = deriveRunVerdicts(
      { tests: [{ fullTestPath: 'AI.BehaviorTests.C.S1_Flee', state: 'Fail', errors: 2 }] },
      [1],
      [{ scenarioId: 1, status: 'passed', output: 'all green' }],
      SUITE,
    );
    expect(byId(vs, 1).status).toBe('failed');
    expect(byId(vs, 1).output).toContain('all green');
  });

  it('no report -> every scenario is an error; zero passed without report evidence', () => {
    const vs = deriveRunVerdicts(
      null,
      [1, 2],
      [{ scenarioId: 1, status: 'passed' }, { scenarioId: 2, status: 'passed' }],
      SUITE,
    );
    expect(vs.map((v) => v.status)).toEqual(['error', 'error']);
    for (const v of vs) expect(v.output.startsWith('no automation report')).toBe(true);
  });
});
