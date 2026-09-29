/**
 * catalog-gap-analysis/B (coordinator render case) — the idle one-shot panel lists the ranked
 * gaps from GET /api/one-shot/gaps, and clicking one analyzes that catalog and proposes AT that
 * gap: no stub /gaps route or unwired panel can pass this.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { OneShotPanel } from '@/components/layout-lab/one-shot/OneShotPanel';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { LIGHT } from '@/components/layout-lab/theme';

const RANKING = {
  targets: [
    { catalogId: 'items', attribute: 'rarity', value: 'Common', count: 34, expected: 57, deficit: 23 },
    { catalogId: 'items', attribute: 'type', value: 'Armor', count: 25, expected: 43, deficit: 18 },
    { catalogId: 'bestiary', attribute: 'role', value: 'healer', count: 4, expected: 8, deficit: 4 },
  ],
  unmeasured: ['quests', 'vendors'],
  balanced: [],
};

const ITEMS_DIST = {
  catalogId: 'items', total: 100,
  byAttribute: { rarity: { Common: 34, Rare: 66 }, type: { Weapon: 75, Armor: 25 } },
  underrepresented: [
    { attribute: 'rarity', value: 'Common', count: 34, expected: 57 },
    { attribute: 'type', value: 'Armor', count: 25, expected: 43 },
  ],
  sample: [], gapBasis: 'expected-share',
};

const PROPOSAL = { name: 'Worn Tunic', data: { type: 'Armor', rarity: 'Common' }, rationale: 'fills Common' };

const envelope = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

let fetchMock: ReturnType<typeof vi.fn>;

describe('OneShotPanel — gap-first idle', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useOneShotLabStore.setState({ panelOpen: true, pendingNavigation: null });
    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/one-shot/gaps') return envelope(RANKING);
      if (url === '/api/one-shot/analyze') return envelope(ITEMS_DIST);
      if (url === '/api/one-shot/propose') return envelope(PROPOSAL);
      return { ok: false, status: 404, json: async () => ({ success: false, error: 'no route' }) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('lists the ranked gaps as actions; clicking the top one analyzes then proposes at that gap', async () => {
    render(<OneShotPanel t={LIGHT} />);
    const rows = await screen.findAllByTestId('one-shot-gap-target');
    expect(rows[0].textContent).toContain('Add a items entity with rarity=Common (have 34, expected ~57)');
    expect(rows).toHaveLength(3);
    expect(screen.getByText(/quests/)).toBeTruthy();

    fireEvent.click(rows[0]);
    await waitFor(() => expect(useOneShotJobStore.getState().proposal).toEqual(PROPOSAL));

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    const iAnalyze = urls.indexOf('/api/one-shot/analyze');
    const iPropose = urls.indexOf('/api/one-shot/propose');
    expect(iAnalyze).toBeGreaterThan(-1);
    expect(iPropose).toBeGreaterThan(iAnalyze);
    const body = JSON.parse((fetchMock.mock.calls[iPropose][1] as RequestInit).body as string);
    expect(body.target).toEqual(RANKING.targets[0]);
    expect(body.catalogId).toBe('items');
  });

  it('after a plain analyze, every dimension is shown and an under-represented bucket proposes at it', async () => {
    render(<OneShotPanel t={LIGHT} />);
    await screen.findAllByTestId('one-shot-gap-target');
    fireEvent.change(screen.getByLabelText('catalog'), { target: { value: 'items' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));
    await waitFor(() => expect(useOneShotJobStore.getState().phase).toBe('analyzed'));
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/one-shot/propose')).toBe(false);

    // The 2nd dimension's gap (type=Armor) is visible and actionable — not just the first key.
    const armor = await screen.findByRole('button', { name: /type=Armor/ });
    fireEvent.click(armor);
    await waitFor(() => expect(useOneShotJobStore.getState().phase).toBe('proposing'));
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/one-shot/propose')!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.target).toEqual({ catalogId: 'items', attribute: 'type', value: 'Armor', count: 25, expected: 43, deficit: 18 });
  });
});
