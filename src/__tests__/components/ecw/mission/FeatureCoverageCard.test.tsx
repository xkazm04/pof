import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FeatureCoverageCard } from '@/components/ecw/mission/FeatureCoverageCard';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';

const { crud } = vi.hoisted(() => ({ crud: vi.fn() }));
vi.mock('@/hooks/useCRUD', () => ({ useCRUD: () => crud() }));

function agg(moduleId: string, impl: number, partial: number, missing: number): ModuleAggregate {
  return { moduleId, total: impl + partial + missing, implemented: impl, improved: 0, partial, missing, unknown: 0, avgQuality: null, lastReviewedAt: null } as ModuleAggregate;
}

function mockData(modules: ModuleAggregate[], isLoading = false) {
  crud.mockReturnValue({ data: { modules }, isLoading, error: null, refetch: vi.fn(), retry: vi.fn(), mutate: vi.fn() });
}

describe('FeatureCoverageCard', () => {
  afterEach(cleanup);

  it('shows overall done percentage and status counts', () => {
    mockData([agg('arpg-combat', 6, 2, 2), agg('arpg-loot', 4, 0, 6)]);
    render(<FeatureCoverageCard />);
    // done 10, partial 2, missing 8, total 20 → 50% done
    expect(screen.getByText('50% done')).toBeTruthy();
    expect(screen.getByText('10 done')).toBeTruthy();
    expect(screen.getByText('8 missing')).toBeTruthy();
  });

  it('lists the lowest-coverage modules', () => {
    mockData([agg('arpg-combat', 9, 0, 1), agg('arpg-loot', 1, 0, 9)]);
    render(<FeatureCoverageCard />);
    expect(screen.getByText(/Lowest coverage/i)).toBeTruthy();
    expect(screen.getByText('arpg-loot')).toBeTruthy();
  });

  it('shows an empty state when there are no tracked features', () => {
    mockData([]);
    render(<FeatureCoverageCard />);
    expect(screen.getByText(/no tracked features yet/i)).toBeTruthy();
  });
});
