import { describe, it, expect, vi, beforeEach } from 'vitest';

// Record exactly what rebuildSearchIndex writes, without SQLite: every INSERT
// lands in `docs`, and the DB-backed SELECTs return one fake build row (the
// feature-matrix and findings scans return nothing — they are not registry docs).
const { docs } = vi.hoisted(() => ({
  docs: [] as { id: string; type: string; moduleId: string }[],
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    exec: () => undefined,
    transaction: (fn: () => void) => fn,
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.startsWith('INSERT INTO search_index')) {
          docs.push({ id: String(args[0]), type: String(args[1]), moduleId: String(args[2]) });
        }
      },
      all: () =>
        sql.includes('FROM build_history')
          ? [{ id: 12, platform: 'Win64', config: 'Shipping', status: 'success', error_summary: null, notes: null, created_at: '2026-09-28' }]
          : [],
    }),
  }),
}));

import { resolveSearchIntents } from '@/components/layout/GlobalSearchPanel/searchIntents';
import { rebuildSearchIndex, type SearchResult } from '@/lib/search-index';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SubModuleId } from '@/types/modules';

type Hit = Pick<SearchResult, 'type' | 'id' | 'moduleId'>;

const combat = SUB_MODULE_MAP['arpg-combat']!;
const qa = combat.quickActions[0];
const item = combat.checklist![0];

describe('resolveSearchIntents — every palette hit is an intent', () => {
  beforeEach(() => {
    useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
  });

  it('a category with no sub-module list lands on its first sub-module', () => {
    const r = resolveSearchIntents({ type: 'category', id: 'cat-core-engine', moduleId: 'core-engine' }, {});
    expect(r.primary?.kind).toBe('navigate');
    const target = r.primary!.moduleId as SubModuleId;
    expect(SUB_MODULE_MAP[target]?.categoryId).toBe('core-engine');
    expect(r.run).toBeNull();
  });

  it('a build row lands on packaging', () => {
    const r = resolveSearchIntents({ type: 'build', id: 'build-12', moduleId: '' }, {});
    expect(r.primary).toEqual({ kind: 'navigate', moduleId: 'packaging' });
  });

  it('a quick-action hit is an Action with a run intent carrying the registry prompt verbatim', () => {
    const r = resolveSearchIntents({ type: 'checklist', id: `qa-arpg-combat-${qa.id}`, moduleId: 'arpg-combat' }, {});
    expect(r.kind).toBe('action');
    expect(r.itemId).toBe(qa.id);
    expect(r.run).toEqual({ kind: 'run', moduleId: 'arpg-combat', prompt: combat.quickActions.find((q) => q.id === qa.id)!.prompt });
    expect(r.primary).toEqual({ kind: 'navigate', moduleId: 'arpg-combat' });
  });

  it('a checklist hit shows done/open from checklist progress', () => {
    const hit: Hit = { type: 'checklist', id: `cl-arpg-combat-${item.id}`, moduleId: 'arpg-combat' };
    const done = resolveSearchIntents(hit, { 'arpg-combat': { [item.id]: true } });
    expect(done.kind).toBe('checklist');
    expect(done.state).toBe('done');
    expect(done.run).toBeNull();
    expect(resolveSearchIntents(hit, {}).state).toBe('open');
  });

  it('[guard] a module hit navigates to itself and never runs', () => {
    const r = resolveSearchIntents({ type: 'module', id: 'mod-arpg-combat', moduleId: 'arpg-combat' }, {});
    expect(r.primary).toEqual({ kind: 'navigate', moduleId: 'arpg-combat' });
    expect(r.run).toBeNull();
  });

  it('coverage ratchet: every doc the index writes resolves to a navigation that lands', () => {
    docs.length = 0;
    rebuildSearchIndex();
    const count = (t: string, prefix: string) => docs.filter((d) => d.type === t && d.id.startsWith(prefix)).length;
    expect(count('category', 'cat-')).toBe(7);
    expect(count('module', 'mod-')).toBe(37);
    expect(count('checklist', 'cl-')).toBe(216);
    expect(count('checklist', 'qa-')).toBe(103);
    expect(count('feature', 'feat-')).toBe(240);
    expect(count('build', 'build-')).toBe(1);

    const deadEnds: string[] = [];
    for (const d of docs) {
      const r = resolveSearchIntents({ type: d.type as SearchResult['type'], id: d.id, moduleId: d.moduleId }, {});
      useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
      if (r.primary) useNavigationStore.getState().navigateToModule(r.primary.moduleId);
      if (!r.primary || useNavigationStore.getState().activeCategory === null) deadEnds.push(d.id);
      if (d.id.startsWith('qa-') && (!r.run || r.kind !== 'action')) deadEnds.push(`${d.id} (not runnable)`);
    }
    expect(deadEnds).toEqual([]);
  });
});
