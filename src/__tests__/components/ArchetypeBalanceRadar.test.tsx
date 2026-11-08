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
