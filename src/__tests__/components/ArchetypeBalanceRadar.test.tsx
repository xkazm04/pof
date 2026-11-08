import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('@/components/modules/core-engine/sub_character/_shared/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_character/_shared/data')>();
  return { ...actual, DEVIATION_THRESHOLDS: { balanced: 0.15, outlier: 0.3 } };
});

import { ArchetypeBalanceRadar } from '@/components/modules/core-engine/sub_character/simulator/ArchetypeBalanceRadar';
import { COMPARISON_STATS, type BalanceResult } from '@/components/modules/core-engine/sub_character/_shared/data';

afterEach(cleanup);

function result(name: string, compositeScore: number): BalanceResult {
  const n = COMPARISON_STATS.length;
  return {
    name, color: 'var(--accent)', compositeScore,
    normalizedStats: Array(n).fill(0.5),
    deviations: Array(n).fill(0),
  };
}

describe('ArchetypeBalanceRadar legend', () => {
  it('derives the deviation legend from DEVIATION_THRESHOLDS', () => {
    const { container } = render(
      <ArchetypeBalanceRadar balanceResults={[result('A', 0.5), result('B', 0.5)]} scoreMean={0.5} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Balanced (<15%)');
    expect(text).toContain('Outlier (≥30%)');
    expect(text).not.toContain('<10%');
    expect(text).not.toContain('≥25%');
  });
});

describe('ArchetypeBalanceRadar score-delta badge', () => {
  it('carries a band word and glyph beside the colour, plus a legend line', () => {
    const { container } = render(
      <ArchetypeBalanceRadar
        balanceResults={[result('Hi', 0.59), result('Mid', 0.54), result('Lo', 0.51)]}
        scoreMean={0.5}
      />,
    );
    const tags = Array.from(container.querySelectorAll('[data-status]'));
    expect(tags.map(t => t.getAttribute('data-status'))).toEqual(['bad', 'warn', 'ok']);
    expect(tags.map(t => t.textContent)).toEqual(['Off', 'Drift', 'Even']);
    expect(tags.every(t => t.querySelector('svg') !== null)).toBe(true);
    const legend = container.querySelector('[data-testid="score-delta-legend"]');
    expect(legend?.textContent).toContain('Even (<3 pts)');
    expect(legend?.textContent).toContain('Off (≥8 pts)');
  });
});
