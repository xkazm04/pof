import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RoadmapCard } from '@/components/ecw/mission/RoadmapCard';

const { roster } = vi.hoisted(() => ({ roster: vi.fn() }));
vi.mock('@/components/ecw/catalogs/useCatalogRoster', () => ({ useCatalogRoster: () => roster() }));

function mockRoster(total: number, verified: number) {
  roster.mockReturnValue([{ catalogId: 'bestiary', label: 'Bestiary', total, verified, failingCount: 0 }]);
}

describe('RoadmapCard', () => {
  afterEach(cleanup);

  it('renders the four milestones', () => {
    mockRoster(100, 30);
    render(<RoadmapCard />);
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(screen.getByText('Playable Vertical Slice')).toBeTruthy();
    expect(screen.getByText('Release Candidate')).toBeTruthy();
  });

  it('drives progress from real catalog completion (30% verified)', () => {
    mockRoster(100, 30); // 30% complete → vertical slice (target 30) at 100%
    render(<RoadmapCard />);
    expect(screen.getByText('100%')).toBeTruthy(); // vertical slice reached
    expect(screen.getByText('40%')).toBeTruthy(); // feature-complete: 30/75
  });

  it('shows 0% across the board for an empty project', () => {
    mockRoster(0, 0);
    render(<RoadmapCard />);
    const zeros = screen.getAllByText('0%');
    expect(zeros.length).toBe(4);
  });
});
