import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { NextBestActionsCard } from '@/components/ecw/mission/NextBestActionsCard';

const { computeProjectNBA } = vi.hoisted(() => ({ computeProjectNBA: vi.fn() }));
vi.mock('@/lib/nba-engine', () => ({ computeProjectNBA }));

function rec(moduleId: string, label: string, score: number, reason: string) {
  return { item: { id: `${moduleId}-${label}`, label, description: '', prompt: '' }, moduleId, score, reason };
}

describe('NextBestActionsCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { statuses: [] } }) })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    computeProjectNBA.mockReset();
  });

  it('renders the top recommendations with score, module, and reason', async () => {
    computeProjectNBA.mockReturnValue([
      rec('arpg-combat', 'Implement hit reactions', 82, 'Unblocks 3 dependent features'),
      rec('arpg-loot', 'Wire drop tables', 70, 'Next uncompleted item'),
    ]);
    render(<NextBestActionsCard />);
    await waitFor(() => expect(screen.getByText('Implement hit reactions')).toBeTruthy());
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByText(/Unblocks 3 dependent features/i)).toBeTruthy();
  });

  it('shows an empty state when nothing is recommended', async () => {
    computeProjectNBA.mockReturnValue([]);
    render(<NextBestActionsCard />);
    await waitFor(() => expect(screen.getByText(/nothing recommended right now/i)).toBeTruthy());
  });
});
