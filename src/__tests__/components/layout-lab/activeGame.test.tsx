/**
 * The ACTIVE game in the lab (spark gtai-uprising-project, WP2). Pinned against a mutable TEST
 * manifest for gtai so the rules hold whatever the real manifest says:
 *  - the URL `g` wins on arrival, an invalid `g` falls back to the remembered game, and a
 *    switch rewrites `g` in place (replace, never push) keeping the lab address params;
 *  - pof (and no param) shows exactly today's catalog set; gtai shows only its manifest, the
 *    toggle reveals the rest greyed "not in GTAI: Uprising", and only gtai entities;
 *  - an empty manifest is an explicit empty board, and the Game view renders its facts.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, renderHook, act, fireEvent, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  manifest: [
    { catalogId: 'quests', fit: 'reskin', note: 'quests -> hitman contracts' },
    { catalogId: 'vfx', fit: 'reuse', expected: 4 },
    { catalogId: 'vehicles', fit: 'planned', note: 'stealable cars' },
  ] as unknown[],
}));
vi.mock('@/lib/games/gtai', () => ({
  GTAI_OMITTED: [],
  GTAI_GAME: {
    id: 'gtai', title: 'GTAI: Uprising', canonProfiles: ['gtai'],
    get manifest() { return h.manifest; },
    engine: { kind: 'undecided' }, designDir: 'games/gtai',
  },
}));
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = (p: Record<string, unknown>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, whileInView, layout, variants, drag, ...rest } = p;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void whileInView; void layout; void variants; void drag;
    return rest;
  };
  const byTag = new Map<string, (props: Record<string, unknown>) => React.ReactElement>();
  const motion = new Proxy({}, {
    get: (_t, tag: string) => {
      if (!byTag.has(tag)) byTag.set(tag, (props: Record<string, unknown>) => React.createElement(tag, strip(props)));
      return byTag.get(tag);
    },
  });
  return { AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion, useReducedMotion: () => true };
});
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  fetchStepSummaryResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue(undefined),
  drainGates: vi.fn().mockResolvedValue(null),
  drainCatalogGates: vi.fn().mockResolvedValue({ kind: 'ok', summary: { ran: 0, passed: 0, failed: 0, skipped: 0, results: [] } }),
  fetchDrainLease: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    tryApiFetch: vi.fn(async (url: string) => (url.includes('/intake') ? { ok: false, error: 'HTTP 404' } : { ok: true, data: [] })),
  };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { LabSearch } from '@/components/layout-lab/LabSearch';
import { GameSelector } from '@/components/layout-lab/GameSelector';
import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import { DEFAULT_LOCATION, resolveCatalogForGame } from '@/components/layout-lab/labLocation';
import { useLabCatalogData, useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import {
  arrivalGame, gameUrl, parseGameParam, useActiveGameStore, useActiveGameUrlSync,
} from '@/stores/activeGameStore';

const MANIFEST = [...(h.manifest as { catalogId: string }[])];
/** Today's lab grouping (category → catalogs, first-seen category order) — what pof must still show. */
const TODAY: string[] = (() => {
  const byCat = new Map<string, string[]>();
  for (const s of CATALOG_SECTIONS) byCat.set(s.category ?? 'Other', [...(byCat.get(s.category ?? 'Other') ?? []), s.catalogId]);
  return [...byCat.values()].flat();
})();
const ids = (groups: { catalogs: { catalogId: string }[] }[]) => groups.flatMap((g) => g.catalogs.map((c) => c.catalogId));
const setGame = (gameId: 'pof' | 'gtai', showAllPipelines = false) => act(() => { useActiveGameStore.setState({ gameId, showAllPipelines }); });

beforeEach(() => {
  h.manifest = [...MANIFEST];
  localStorage.clear();
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
  useLabPipelineStore.setState({ byEntity: {} });
  _resetArtifactCache();
  window.history.replaceState({}, '', '/');
});
afterEach(cleanup);

describe('active game — URL and memory', () => {
  it('parses only registered ids; writes g in place, keeps other params, leaves a param-less pof address alone', () => {
    expect(parseGameParam('?g=gtai')).toBe('gtai');
    expect(parseGameParam('?g=nope')).toBeNull();
    expect(arrivalGame('?g=nope', 'gtai')).toBe('gtai');
    expect(arrivalGame('?g=pof', 'gtai')).toBe('pof');
    expect(gameUrl('http://x/?legacy=0&c=items', 'gtai')).toBe('/?legacy=0&c=items&g=gtai');
    expect(gameUrl('http://x/?c=items', 'pof')).toBeNull();
    expect(gameUrl('http://x/?g=gtai', 'gtai')).toBeNull();
  });

  it('the URL wins on arrival over the remembered game', () => {
    useActiveGameStore.setState({ gameId: 'gtai' });
    window.history.replaceState({}, '', '/?g=pof');
    renderHook(() => useActiveGameUrlSync());
    expect(useActiveGameStore.getState().gameId).toBe('pof');
  });

  it('an invalid g falls back to the remembered game and the address is corrected', () => {
    useActiveGameStore.setState({ gameId: 'gtai' });
    window.history.replaceState({}, '', '/?c=items&g=bogus');
    renderHook(() => useActiveGameUrlSync());
    expect(useActiveGameStore.getState().gameId).toBe('gtai');
    expect(new URLSearchParams(window.location.search).get('g')).toBe('gtai');
    expect(new URLSearchParams(window.location.search).get('c')).toBe('items');
  });

  it('a switch rewrites g by REPLACE (no history entry) and the choice is remembered', () => {
    window.history.replaceState({}, '', '/?legacy=0&c=items');
    renderHook(() => useActiveGameUrlSync());
    const before = window.history.length;
    act(() => { useActiveGameStore.getState().setGame('gtai'); });
    expect(window.location.search).toBe('?legacy=0&c=items&g=gtai');
    expect(window.history.length).toBe(before);
    expect(JSON.parse(localStorage.getItem('pof-active-game') ?? '{}').state.gameId).toBe('gtai');
  });
});

describe('active game — catalog and entity scope', () => {
  it('pof (no param) shows exactly today\'s catalog set, in section order, nothing greyed', () => {
    const { result } = renderHook(() => useLabCatalogData());
    expect(ids(result.current)).toEqual(TODAY);
    expect(result.current.every((g) => g.catalogs.every((c) => c.notInGame === undefined))).toBe(true);
  });

  it('gtai shows only its registered manifest catalogs; the toggle reveals the rest greyed "not in GTAI: Uprising"', () => {
    const { result } = renderHook(() => useLabCatalogData());
    setGame('gtai');
    expect(ids(result.current).sort()).toEqual(['quests', 'vfx']);
    setGame('gtai', true);
    expect(ids(result.current)).toEqual(TODAY);
    const items = result.current.flatMap((g) => g.catalogs).find((c) => c.catalogId === 'items')!;
    expect(items.notInGame).toBe('GTAI: Uprising');
    const quests = result.current.flatMap((g) => g.catalogs).find((c) => c.catalogId === 'quests')!;
    expect(quests.notInGame).toBeUndefined();
  });

  it('gtai detail holds only gtai entities (seeded pof quests leave, a gtai-authored one stays)', () => {
    act(() => {
      useCatalogStore.getState().addDraft('quests', {
        id: 'gtai-first-hit', catalogId: 'quests', name: 'First Hit', categoryPath: [], tags: [], lifecycle: 'planned',
        provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T00:00:00Z' },
      } as never);
    });
    const { result } = renderHook(() => useLabDetail('quests'));
    expect(result.current!.entities.some((e) => e.id === 'gtai-first-hit')).toBe(false);
    expect(result.current!.entities.length).toBeGreaterThan(0);
    setGame('gtai');
    expect(result.current!.entities.map((e) => e.id)).toEqual(['gtai-first-hit']);
    act(() => { useCatalogStore.getState().removeDraft('quests', 'gtai-first-hit'); });
  });
});

describe('active game — the lab shell', () => {
  it('?g=gtai on the Matrix lists only manifest catalogs in its picker', async () => {
    window.history.replaceState({}, '', '/?legacy=0&c=items&v=matrix&g=gtai');
    render(<LayoutLab />);
    const select = (await screen.findByLabelText('Catalog')) as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value).sort();
    expect(options).toEqual(['quests', 'vfx']);
    // `items` is not in gtai: the location resolved away to the game's first catalog.
    expect(['quests', 'vfx']).toContain(select.value);
  });

  it('an empty manifest is an explicit empty board, never a blank panel or PoF\'s catalogs', async () => {
    h.manifest = [];
    window.history.replaceState({}, '', '/?g=gtai');
    render(<LayoutLab />);
    const empty = await screen.findByTestId('game-empty-board');
    expect(empty.textContent).toContain("No pipelines in GTAI: Uprising's manifest yet");
    expect(document.querySelector('[data-testid^="harness-catalog-"]')).toBeNull();
  });

  it('the Game view renders coverage and readiness as separate columns, planned "not built", canon, intake and engine', async () => {
    window.history.replaceState({}, '', '/?legacy=0&c=quests&v=game&g=gtai');
    render(<LayoutLab />);
    const home = await screen.findByTestId('game-home');
    expect(home.textContent).toContain('GTAI: Uprising');
    const table = screen.getByTestId('game-home-pipelines');
    expect(table.textContent).toContain('Coverage');
    expect(table.textContent).toContain('Readiness');
    expect(table.textContent).toContain('no target declared'); // quests declares none
    expect(table.textContent).toContain('0 / 4'); // vfx declares 4
    expect(table.textContent).toContain('not built'); // vehicles is planned
    expect(table.textContent).not.toContain('R0');
    expect(screen.getByTestId('game-home-engine').textContent).toContain('undecided');
    expect(screen.getByTestId('game-home-canon').textContent).toMatch(/canon rules yet|rules across gtai/);
    expect((await screen.findByText(/intake unavailable/)).textContent).toContain('HTTP 404');
    // Readiness settles to "unmeasured" (no artifacts), never R0.
    await screen.findAllByText('unmeasured');
  });
});

describe('active game — lab search', () => {
  const hits = (q: string, badge: string) => {
    fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: q } });
    return screen.queryAllByTestId('lab-search-option').filter((o) => within(o).queryByText(badge));
  };
  const mount = () => render(<LabSearch open onClose={() => {}} currentEntityId={null} onSelectCatalog={() => {}} onNavigate={() => {}} />);

  it('pof finds a pof catalog and its seeded entities; gtai finds neither, only its manifest catalogs', () => {
    const seededItem = Object.values(useCatalogStore.getState().entitiesByCatalog.items ?? {})[0];
    mount();
    expect(hits('items', 'catalog').length).toBeGreaterThan(0);
    expect(hits(seededItem.id, 'entity').length).toBeGreaterThan(0);
    cleanup();
    setGame('gtai');
    mount();
    expect(hits('items', 'catalog')).toHaveLength(0);
    expect(hits(seededItem.id, 'entity')).toHaveLength(0);
    expect(hits('quests', 'catalog').length).toBeGreaterThan(0);
  });
});

describe('active game — selector', () => {
  it('is a named control listing game titles; the reveal toggle exists only for a game with a manifest', () => {
    render(<GameSelector />);
    const select = screen.getByLabelText('Game') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Pillars of Fortune', 'GTAI: Uprising']);
    expect(screen.queryByTestId('game-show-all')).toBeNull(); // pof: nothing off-manifest
    fireEvent.change(select, { target: { value: 'gtai' } });
    expect(useActiveGameStore.getState().gameId).toBe('gtai');
    const toggle = screen.getByTestId('game-show-all');
    expect(toggle.getAttribute('aria-label')).toContain('not in GTAI: Uprising');
    fireEvent.click(toggle);
    expect(useActiveGameStore.getState().showAllPipelines).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('active game — location and tree', () => {
  it('a known catalog the game does not show resolves to its first one; pof / unknown / empty stay put', () => {
    const known = ['items', 'quests', 'vfx'];
    const at = { ...DEFAULT_LOCATION, catalogId: 'items', entityId: 'x', stepIdx: 2 };
    expect(resolveCatalogForGame(at, ['quests', 'vfx'], known)).toEqual({ ...at, catalogId: 'quests' });
    expect(resolveCatalogForGame(at, known, known)).toBe(at);
    expect(resolveCatalogForGame({ ...at, catalogId: 'stale' }, ['quests'], known).catalogId).toBe('stale');
    expect(resolveCatalogForGame(at, [], known)).toBe(at);
  });

  it('an off-manifest catalog row is greyed and says "not in <game>"', () => {
    render(<CatalogTree t={LIGHT} selectedCatalogId="items" entities={[]} selectedEntityId={null}
      onSelectCatalog={() => {}} onSelectEntity={() => {}}
      groups={[{ category: 'Core', catalogs: [
        { catalogId: 'items', label: 'Items', description: '', total: 0, notInGame: 'GTAI: Uprising' },
        { catalogId: 'quests', label: 'Quests', description: '', total: 0 },
      ] }]} />);
    expect(screen.getByTestId('catalog-not-in-game-items').textContent).toBe('not in GTAI: Uprising');
    expect(screen.getByTestId('harness-catalog-items').hasAttribute('data-not-in-game')).toBe(true);
    expect(screen.queryByTestId('catalog-not-in-game-quests')).toBeNull();
  });
});
