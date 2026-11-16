import { describe, it, expect } from 'vitest';
import { createABTest, recordTrial, forceConclude, type JudgeScores } from '@/lib/prompt-evolution/ab-testing';
import type { ABTest } from '@/types/prompt-evolution';

/** Decide-now: where an item is judged, the floor is on judged verdicts, not serves. */
function served(n = 3): ABTest {
  let t = createABTest('arpg-combat', 'combat-hit-detect', 'var-a', 'var-b', 3);
  for (let i = 0; i < n; i++) {
    t = recordTrial(t, 'A', true, 1000);
    t = recordTrial(t, 'B', i === 0, 1000);
  }
  return t;
}

function scores(aVerdicts: number, bVerdicts: number): JudgeScores {
  return {
    'var-a': { avgScore: 80, passRate: 0.8, verdicts: aVerdicts, judgedArtifacts: aVerdicts },
    'var-b': { avgScore: 40, passRate: 0.4, verdicts: bVerdicts, judgedArtifacts: bVerdicts },
  };
}

describe('forceConclude judged floor', () => {
  it('refuses while a judged item has fewer than 3 verdicts on an arm', () => {
    const r = forceConclude(served(), scores(5, 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/judge verdicts/i);
  });

  it('refuses when only one arm has been judged at all', () => {
    expect(forceConclude(served(), scores(4, 0)).ok).toBe(false);
  });

  it('concludes once both arms clear the judged floor', () => {
    const r = forceConclude(served(), scores(3, 3));
    expect(r.ok).toBe(true);
  });

  it('keeps the serve floor alone for an item no judge has scored', () => {
    expect(forceConclude(served()).ok).toBe(true);
    expect(forceConclude(served(), {}).ok).toBe(true);
  });
});
