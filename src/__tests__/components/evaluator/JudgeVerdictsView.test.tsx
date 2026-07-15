import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { JudgeVerdictsView } from '@/components/modules/evaluator/JudgeVerdictsView';
import { rollupVerdictsByCatalog, verdictTotals } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function v(partial: Partial<JudgeVerdict>): JudgeVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
    judge: 'llm-panel', verdict: 'pass', score: 92, findings: 'Clean silhouette.',
    model: 'opus', ...partial,
  };
}

function mockVerdicts(list: JudgeVerdict[]) {
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
    expect(t).toEqual({ total: 2, passCount: 1, failCount: 1, avgScore: 75 });
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

  it('opens the detail modal with full findings when a verdict is clicked', async () => {
    mockVerdicts([v({ step: 'Icon 2D Art', findings: 'Muddy value hierarchy; edges are AI-mushy.' })]);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByText('Icon 2D Art')).toBeTruthy());
    fireEvent.click(screen.getByText('Icon 2D Art'));
    expect(screen.getByText('Muddy value hierarchy; edges are AI-mushy.')).toBeTruthy();
  });
});
