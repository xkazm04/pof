import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { JudgeVerdictsView } from '@/components/modules/evaluator/JudgeVerdictsView';
import { rollupVerdictsByCatalog, verdictTotals } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';
import type { ViewVerdict } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function v(partial: Partial<ViewVerdict>): ViewVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
    judge: 'llm-panel', verdict: 'pass', score: 92, findings: 'Clean silhouette.',
    model: 'opus', ...partial,
  };
}

function mockVerdicts(list: ViewVerdict[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data: list }) })) as unknown as typeof fetch);
}

describe('verdictRollup (pure)', () => {
  it('groups by catalog with pass/fail/avg stats, worst catalog first', () => {
    const groups = rollupVerdictsByCatalog([
      v({ catalogId: 'items', verdict: 'pass', score: 90 }),
      v({ catalogId: 'items', step: 'Economy', verdict: 'pass', score: 80 }),
      v({ catalogId: 'loot-tables', step: 'Drop Rates', verdict: 'fail', score: 40 }),
    ]);
    // loot-tables has a fail → leads.
    expect(groups[0].catalogId).toBe('loot-tables');
    expect(groups[0].failCount).toBe(1);
    expect(groups[1].catalogId).toBe('items');
    expect(groups[1].total).toBe(2);
    expect(groups[1].passCount).toBe(2);
    expect(groups[1].avgScore).toBe(85);
  });

  it('sorts fail verdicts ahead of pass within a group', () => {
    const [group] = rollupVerdictsByCatalog([
      v({ step: 'A', verdict: 'pass', score: 95 }),
      v({ step: 'B', verdict: 'fail', score: 60 }),
    ]);
    expect(group.verdicts[0].verdict).toBe('fail');
  });

  it('verdictTotals aggregates across every verdict', () => {
    const t = verdictTotals([v({ score: 100 }), v({ verdict: 'fail', score: 50 })]);
    expect(t).toEqual({
      total: 2, standing: 2, passCount: 1, failCount: 1, avgScore: 75,
      supersededCount: 0, staleCount: 0,
    });
  });

  // The headline used to count every stored row, so the tab reported a fail count and an
  // average the acceptance layer itself did not hold (judgeBridge applies neither a
  // superseded-rubric verdict nor one bound to content the step no longer holds).
  it('a superseded-rubric fail and a stale-bound fail do NOT inflate the current fail count', () => {
    const t = verdictTotals([
      v({ step: 'A', verdict: 'fail', score: 40, provenance: 'current' }),
      v({ step: 'B', verdict: 'fail', score: 10, provenance: 'superseded' }),
      v({ step: 'C', verdict: 'fail', score: 10, provenance: 'stale' }),
      v({ step: 'D', verdict: 'pass', score: 100, provenance: 'current' }),
    ]);
    expect(t.total).toBe(4);         // every judgment is still on record
    expect(t.standing).toBe(2);
    expect(t.failCount).toBe(1);     // only the bound, current-rubric fail
    expect(t.passCount).toBe(1);
    expect(t.avgScore).toBe(70);     // (40 + 100) / 2 — the 10s do not drag it down
    expect(t.supersededCount).toBe(1);
    expect(t.staleCount).toBe(1);
  });

  it('an `unknown`-provenance verdict still counts — acceptance still applies it', () => {
    const t = verdictTotals([v({ verdict: 'fail', score: 30, provenance: 'unknown' })]);
    expect(t.failCount).toBe(1);
    expect(t.standing).toBe(1);
  });

  it('keeps non-standing verdicts VISIBLE (evidence), listed after the standing ones', () => {
    const [group] = rollupVerdictsByCatalog([
      v({ step: 'Stale', verdict: 'fail', score: 5, provenance: 'stale' }),
      v({ step: 'Bound', verdict: 'pass', score: 91, provenance: 'current' }),
    ]);
    expect(group.verdicts).toHaveLength(2);
    expect(group.verdicts.map((x) => x.step)).toEqual(['Bound', 'Stale']);
  });
});

describe('JudgeVerdictsView', () => {
  it('renders an honest empty state when there are no verdicts', async () => {
    mockVerdicts([]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByText('No content judgments yet')).toBeTruthy());
  });

  it('renders catalog groups and per-verdict rows', async () => {
    mockVerdicts([
      v({ catalogId: 'items', step: 'Icon 2D Art', verdict: 'pass', score: 92 }),
      v({ catalogId: 'loot-tables', step: 'Drop Rates', verdict: 'fail', score: 42 }),
    ]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByTestId('judge-verdicts-view')).toBeTruthy());
    expect(screen.getByText('items')).toBeTruthy();
    expect(screen.getByText('loot-tables')).toBeTruthy();
    expect(screen.getByText('Icon 2D Art')).toBeTruthy();
    expect(screen.getByText('Drop Rates')).toBeTruthy();
    // The failing verdict is marked distinctly (colorblind-safe StatusTag with FAIL word).
    expect(screen.getAllByText(/FAIL/).length).toBeGreaterThan(0);
  });

  it('marks a non-standing verdict in the LIST — legible without opening the modal', async () => {
    mockVerdicts([
      v({ catalogId: 'items', step: 'Bound Fail', verdict: 'fail', score: 40, provenance: 'current' }),
      v({ catalogId: 'items', step: 'Old Fail', verdict: 'fail', score: 10, provenance: 'stale' }),
      v({ catalogId: 'items', step: 'Old Rubric', verdict: 'fail', score: 10, provenance: 'superseded' }),
    ]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByTestId('judge-verdicts-view')).toBeTruthy());

    const rows = screen.getAllByTestId('verdict-row');
    expect(rows.map((r) => r.getAttribute('data-standing')))
      .toEqual(['current', 'not-counted', 'not-counted']);
    // The existing provenance vocabulary, in the row itself.
    expect(screen.getByText('VERDICT: STALE')).toBeTruthy();
    expect(screen.getByText('VERDICT: SUPERSEDED')).toBeTruthy();
    // Headline counts only the bound one, and says what it left out.
    expect(screen.getByTestId('verdict-totals').textContent).toContain('1 standing verdicts');
    expect(screen.getByTestId('verdict-not-counted').textContent).toContain('3 judgments on record');
  });

  it('opens the detail modal with full findings when a verdict is clicked', async () => {
    mockVerdicts([v({ step: 'Icon 2D Art', findings: 'Muddy value hierarchy; edges are AI-mushy.' })]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByText('Icon 2D Art')).toBeTruthy());
    fireEvent.click(screen.getByText('Icon 2D Art'));
    expect(screen.getByText('Muddy value hierarchy; edges are AI-mushy.')).toBeTruthy();
  });

  it('the modal states rubric standing and the content binding', async () => {
    mockVerdicts([v({
      step: 'Icon 2D Art', verdict: 'fail', score: 30, rubricVersion: 2,
      provenance: 'superseded', contentHash: 'v2-9-abc', findings: 'Values are muddy throughout.',
    })]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByText('Icon 2D Art')).toBeTruthy());
    fireEvent.click(screen.getByText('Icon 2D Art'));

    const standing = screen.getByTestId('verdict-standing').textContent ?? '';
    expect(standing).toContain('superseded by v');   // rubric standing, not a bare "rubric v2"
    expect(standing).toContain('v2-9-abc');          // the binding itself
  });
});
