/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): with zero standing verdicts there is no
 * average. verdictTotals used to report avgScore 0, which the view painted red as "avg 0" and
 * which sorted a catalog of only superseded/stale rows ahead of every real catalog as "worst".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { JudgeVerdictsView } from '@/components/modules/evaluator/JudgeVerdictsView';
import { rollupVerdictsByCatalog, verdictTotals } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';
import type { ViewVerdict } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function v(partial: Partial<ViewVerdict>): ViewVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
    judge: 'llm-panel', verdict: 'pass', score: 92, findings: 'ok', model: 'opus', ...partial,
  };
}

describe('verdictRollup - no standing verdicts means no average', () => {
  it('verdictTotals reports avgScore null, not 0, when nothing is standing', () => {
    const t = verdictTotals([v({ verdict: 'fail', score: 30, provenance: 'superseded' })]);
    expect(t.standing).toBe(0);
    expect(t.avgScore).toBeNull();
  });

  it('a catalog with no standing verdicts does not sort ahead of a real one as "worst"', () => {
    const groups = rollupVerdictsByCatalog([
      v({ catalogId: 'archive', verdict: 'fail', score: 20, provenance: 'stale' }),
      v({ catalogId: 'items', verdict: 'pass', score: 60, provenance: 'current' }),
    ]);
    expect(groups.map((g) => g.catalogId)).toEqual(['items', 'archive']);
  });

  it('the view says "avg —" rather than "avg 0" for such a catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ success: true, data: [v({ catalogId: 'archive', verdict: 'fail', score: 20, provenance: 'stale' })] }),
    })) as unknown as typeof fetch);
    render(<JudgeVerdictsView />);
    await screen.findByTestId('judge-verdicts-view');
    const text = screen.getByTestId('judge-verdicts-view').textContent ?? '';
    expect(text).not.toMatch(/avg\s*0\b/);
    expect(text).toContain('avg —');
  });
});
