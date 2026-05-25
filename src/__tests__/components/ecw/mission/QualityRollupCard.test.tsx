import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QualityRollupCard } from '@/components/ecw/mission/QualityRollupCard';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';

const { crud } = vi.hoisted(() => ({ crud: vi.fn() }));
vi.mock('@/hooks/useCRUD', () => ({ useCRUD: () => crud() }));

function agg(moduleId: string, avgQuality: number | null): ModuleAggregate {
  return { moduleId, total: 5, implemented: 3, improved: 0, partial: 1, missing: 1, unknown: 0, avgQuality, lastReviewedAt: avgQuality !== null ? '2026-05-25' : null } as ModuleAggregate;
}

function mockData(modules: ModuleAggregate[], isLoading = false) {
  crud.mockReturnValue({ data: { modules }, isLoading, error: null, refetch: vi.fn(), retry: vi.fn(), mutate: vi.fn() });
}

describe('QualityRollupCard', () => {
  afterEach(cleanup);

  it('shows the overall reviewed-quality score', () => {
    mockData([agg('arpg-combat', 80), agg('arpg-loot', 60), agg('arpg-ui', null)]);
    render(<QualityRollupCard />);
    expect(screen.getByText('Project Quality')).toBeTruthy();
    expect(screen.getByText('70')).toBeTruthy(); // mean of 80 and 60
    expect(screen.getByText(/2 of 3 modules reviewed/i)).toBeTruthy();
  });

  it('lists the weakest modules first', () => {
    mockData([agg('arpg-combat', 90), agg('arpg-loot', 40), agg('arpg-ui', 65)]);
    render(<QualityRollupCard />);
    expect(screen.getByText('arpg-loot')).toBeTruthy();
    expect(screen.getByText(/Weakest modules/i)).toBeTruthy();
  });

  it('shows an empty state when no modules are reviewed', () => {
    mockData([agg('arpg-combat', null)]);
    render(<QualityRollupCard />);
    expect(screen.getByText(/no module reviews yet/i)).toBeTruthy();
  });
});
