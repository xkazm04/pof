/**
 * F-11: /story with `?g=gtai` renders the GTAI campaign from `GET /api/games/gtai/story` instead of
 * the stored graphs. With no quest packages the skeleton shows every act, "no contracts yet", and
 * the protected beats (the betrayal, soul 4) as locked. A placed quest shows on its beat. The Orrery
 * is stubbed (canvas); the graph it is handed is asserted instead. Plain DOM, own cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { OrreryDataset } from '@/components/story/orrery/OrreryView';
import { campaignMapOf } from '@/lib/games/story/campaignMap';
import { LEDGER_QUEST } from '@/__tests__/games/gtai-quest/fixtures';
import { useActiveGameStore } from '@/stores/activeGameStore';

const seen = vi.hoisted(() => ({ datasets: [] as OrreryDataset[] }));
vi.mock('@/components/story/orrery/OrreryView', () => ({
  OrreryView: ({ datasets }: { datasets: OrreryDataset[] }) => {
    seen.datasets = datasets;
    return <div data-testid="orrery-stub">{datasets.map((d) => d.label).join('|')}</div>;
  },
}));

import { StoryMap } from '@/components/story/StoryMap';

function stubFetch(data: unknown) {
  const fn = vi.fn((url: string) => Promise.resolve({ json: () => Promise.resolve(url === '/api/games/gtai/story' ? { success: true, data } : { success: true, data: [] }) }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  seen.datasets = [];
  window.history.replaceState(null, '', '/story?g=gtai');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useActiveGameStore.getState().setGame('pof');
  window.history.replaceState(null, '', '/');
});

describe('/story for GTAI', () => {
  it('with no packages renders the skeleton, "no contracts yet" and the locked protected beats', async () => {
    const fn = stubFetch({ ...campaignMapOf([]), hash: 'h'.repeat(64), source: 'games/gtai/quests' });
    render(<StoryMap />);
    await screen.findByTestId('gtai-campaign-summary');
    expect(fn).toHaveBeenCalledWith('/api/games/gtai/story', undefined);
    expect(fn.mock.calls.some(([u]) => String(u).startsWith('/api/story/graphs'))).toBe(false);
    expect(screen.getByTestId('gtai-campaign-count').textContent).toContain('no contracts yet');
    expect(screen.getByTestId('gtai-campaign-empty').textContent).toContain('campaign skeleton');
    for (const act of ['prologue', 'clock-out', 'act1', 'act2', 'act3', 'act4', 'finale']) {
      expect(screen.getByTestId(`campaign-act-${act}`)).toBeTruthy();
    }
    for (const id of ['act3.betrayal', 'act4.soul-4']) {
      const b = screen.getByTestId(`campaign-beat-${id}`);
      expect(b.getAttribute('data-state')).toBe('locked');
      expect(b.querySelector('[data-status="bad"]')?.textContent?.toLowerCase()).toContain('locked');
    }
    expect(screen.getByTestId('campaign-beat-act1.soul-1').getAttribute('data-state')).toBe('open');
    expect(seen.datasets[0].graph.graphId).toBe('gtai-campaign');
    expect(seen.datasets[0].project).toBeUndefined(); // not a stored graph: no walk target
  });

  it('shows a ledger quest in its act', async () => {
    stubFetch({ ...campaignMapOf([LEDGER_QUEST]), hash: 'h'.repeat(64), source: 'games/gtai/quests' });
    render(<StoryMap />);
    const q = await screen.findByTestId('campaign-quest-witnesses-are-crumbs');
    expect(q.textContent).toContain('Witnesses Are Crumbs');
    expect(q.textContent).toContain('in act');
    expect(screen.getByTestId('gtai-campaign-count').textContent).toContain('1 contract');
    expect(screen.queryByTestId('gtai-campaign-empty')).toBeNull();
  });

  it('a failed read shows the error with Retry', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: false, error: 'disk gone' }) })));
    render(<StoryMap />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not load the GTAI campaign: disk gone');
  });
});
