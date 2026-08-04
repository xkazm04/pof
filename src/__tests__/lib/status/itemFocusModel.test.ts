import { describe, it, expect } from 'vitest';
import {
  buildDependencyIndex,
  resolveItemFocus,
  buildCategoryNodes,
  sortWeakestFirst,
  entityKey,
  type ItemFocusCtx,
  type SwimlaneCtx,
} from '@/lib/status/itemFocusModel';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepMeta } from '@/lib/status/statusModel';

/** Minimal entity factory. */
function ent(catalogId: string, id: string, name: string, links: CatalogEntityBase['links'] = []): CatalogEntityBase {
  return { id, catalogId, name, categoryPath: [], tags: [], lifecycle: 'planned', links };
}

function art(catalogId: string, entityId: string, step: string, status: PipelineArtifact['status'], tier?: PipelineArtifact['tier']): PipelineArtifact {
  return { catalogId, entityId, step, data: {}, ueAssets: [], status, ...(tier ? { tier } : {}) };
}

const STEPS: Record<string, StepMeta[]> = {
  items: [{ label: 'Economy', engine: 'Claude' }, { label: '3D-Mesh', engine: 'Tripo' }],
  'loot-tables': [{ label: 'Drop-Rates', engine: 'Claude' }],
  'icon-sets': [{ label: 'Icon', engine: 'Leonardo' }],
};

/** A world: a sword item, an icon it binds (forward), a loot table that drops it (reverse). */
function makeWorld() {
  const entitiesByCatalog = {
    items: {
      'vael-blade': ent('items', 'vael-blade', 'Vael Blade', [{ catalogId: 'icon-sets', entityId: 'icon-sword', role: 'icon' }]),
    },
    'icon-sets': { 'icon-sword': ent('icon-sets', 'icon-sword', 'Sword Icon') },
    'loot-tables': {
      'lt-brute': ent('loot-tables', 'lt-brute', 'Brute Loot', [{ catalogId: 'items', entityId: 'vael-blade', role: 'loot' }]),
    },
  };
  const artifacts: Record<string, PipelineArtifact[]> = {
    items: [art('items', 'vael-blade', 'Economy', 'pass', 'L0')], // Economy produced, 3D-Mesh NOT
    'loot-tables': [art('loot-tables', 'lt-brute', 'Drop-Rates', 'pass', 'L0')],
    'icon-sets': [],
  };
  const ctx: ItemFocusCtx = {
    entitiesByCatalog,
    index: buildDependencyIndex(entitiesByCatalog),
    stepsFor: (c) => STEPS[c] ?? [],
    artifactsFor: (c) => artifacts[c] ?? [],
    verdictsFor: () => [],
  };
  return ctx;
}

describe('buildDependencyIndex', () => {
  it('records forward links and inverts them into reverse', () => {
    const ctx = makeWorld();
    const { forward, reverse } = ctx.index;
    expect(forward.get(entityKey('items', 'vael-blade'))).toHaveLength(1);
    // loot-tables → items is inverted so the item sees its reverse dependent
    const rev = reverse.get(entityKey('items', 'vael-blade'));
    expect(rev).toEqual([{ catalogId: 'loot-tables', entityId: 'lt-brute', role: 'loot' }]);
    // the icon the sword binds sees the sword as ITS reverse dependent
    expect(reverse.get(entityKey('icon-sets', 'icon-sword'))).toEqual([
      { catalogId: 'items', entityId: 'vael-blade', role: 'icon' },
    ]);
  });

  it('skips entities with no links', () => {
    const entitiesByCatalog = { items: { a: ent('items', 'a', 'A') } };
    const { forward, reverse } = buildDependencyIndex(entitiesByCatalog);
    expect(forward.size).toBe(0);
    expect(reverse.size).toBe(0);
  });
});

describe('resolveItemFocus', () => {
  it('returns null for an unknown entity', () => {
    const ctx = makeWorld();
    expect(resolveItemFocus('items', 'nope', ctx)).toBeNull();
  });

  it('grades the focus entity by ITS OWN artifacts (realization, not aggregate)', () => {
    const ctx = makeWorld();
    const focus = resolveItemFocus('items', 'vael-blade', ctx)!.focus;
    const cells = focus.swimlane.cells;
    const economy = cells.find((c) => c.label === 'Economy')!;
    const mesh = cells.find((c) => c.label === '3D-Mesh')!;
    expect(economy.grade).toBe('trusted'); // produced (Claude → trusted)
    expect(mesh.grade).toBe('unwired');    // never produced → the "didn't make it through" signal
  });

  it('surfaces the forward binding and the reverse dependent, each with its role + swimlane', () => {
    const ctx = makeWorld();
    const result = resolveItemFocus('items', 'vael-blade', ctx)!;
    expect(result.forward).toHaveLength(1);
    expect(result.forward[0]).toMatchObject({ catalogId: 'icon-sets', entityId: 'icon-sword', role: 'icon' });
    expect(result.forward[0].swimlane.cells).toHaveLength(1);
    expect(result.reverse).toHaveLength(1);
    expect(result.reverse[0]).toMatchObject({ catalogId: 'loot-tables', entityId: 'lt-brute', role: 'loot' });
    // the loot table's own realization is visible (Drop-Rates produced)
    expect(result.reverse[0].swimlane.cells[0].grade).toBe('trusted');
  });

  it('marks a dangling forward link target as missing but still renders it', () => {
    const entitiesByCatalog = {
      items: { sword: ent('items', 'sword', 'Sword', [{ catalogId: 'icon-sets', entityId: 'ghost', role: 'icon' }]) },
    };
    const ctx: ItemFocusCtx = {
      entitiesByCatalog,
      index: buildDependencyIndex(entitiesByCatalog),
      stepsFor: (c) => STEPS[c] ?? [],
      artifactsFor: () => [],
      verdictsFor: () => [],
    };
    const forward = resolveItemFocus('items', 'sword', ctx)!.forward;
    expect(forward).toHaveLength(1);
    expect(forward[0]).toMatchObject({ entityId: 'ghost', missing: true });
  });

  it('grades forward/reverse the same way the focus is graded', () => {
    const ctx = makeWorld();
    const result = resolveItemFocus('items', 'vael-blade', ctx)!;
    // sanity: the reverse node's swimlane readyPct is a number
    expect(typeof result.reverse[0].swimlane.readyPct).toBe('number');
  });

  it('dedupes and drops self-references', () => {
    const entitiesByCatalog = {
      items: {
        a: ent('items', 'a', 'A', [
          { catalogId: 'items', entityId: 'a', role: 'self' }, // self → dropped
          { catalogId: 'icon-sets', entityId: 'i', role: 'icon' },
          { catalogId: 'icon-sets', entityId: 'i', role: 'icon' }, // dup → collapsed
        ]),
      },
      'icon-sets': { i: ent('icon-sets', 'i', 'Icon') },
    };
    const ctx: ItemFocusCtx = {
      entitiesByCatalog,
      index: buildDependencyIndex(entitiesByCatalog),
      stepsFor: (c) => STEPS[c] ?? [],
      artifactsFor: () => [],
      verdictsFor: () => [],
    };
    const forward = resolveItemFocus('items', 'a', ctx)!.forward;
    expect(forward).toHaveLength(1);
    expect(forward[0].entityId).toBe('i');
  });
});

describe('buildCategoryNodes — the weakest-first category overview', () => {
  // items has 2 steps; a verified (L3/L4 gate) pass on a step lifts readyPct.
  function categoryCtx() {
    const entitiesByCatalog = {
      items: {
        strong: ent('items', 'strong', 'Mid Blade'),   // 1 of 2 steps gate-verified → 50%
        zephyr: ent('items', 'zephyr', 'Zephyr Edge'),  // 0%
        apple: ent('items', 'apple', 'Apple Dagger'),   // 0%
      },
    };
    const artifacts: Record<string, PipelineArtifact[]> = {
      items: [art('items', 'strong', 'Economy', 'pass', 'L3')], // L3 pass → verified
    };
    const ctx: SwimlaneCtx = {
      stepsFor: (c) => STEPS[c] ?? [],
      artifactsFor: (c) => artifacts[c] ?? [],
      verdictsFor: () => [],
    };
    return { entitiesByCatalog, ctx };
  }

  it('sorts by verified % ascending, then by name ascending on ties', () => {
    const { entitiesByCatalog, ctx } = categoryCtx();
    const nodes = buildCategoryNodes('items', entitiesByCatalog, ctx);
    expect(nodes.map((n) => n.name)).toEqual(['Apple Dagger', 'Zephyr Edge', 'Mid Blade']);
    expect(nodes.map((n) => n.swimlane.readyPct)).toEqual([0, 0, 50]);
  });

  it('each row is the entity-scoped realization (Mid Blade produced Economy, not 3D-Mesh)', () => {
    const { entitiesByCatalog, ctx } = categoryCtx();
    const mid = buildCategoryNodes('items', entitiesByCatalog, ctx).find((n) => n.entityId === 'strong')!;
    const economy = mid.swimlane.cells.find((c) => c.label === 'Economy')!;
    const mesh = mid.swimlane.cells.find((c) => c.label === '3D-Mesh')!;
    expect(economy.grade).toBe('verified');
    expect(mesh.grade).toBe('unwired');
  });

  it('returns [] for a catalog with no entities', () => {
    const { ctx } = categoryCtx();
    expect(buildCategoryNodes('items', {}, ctx)).toEqual([]);
  });

  it('sortWeakestFirst is a pure, stable ordering', () => {
    const mk = (name: string, pct: number) => ({ catalogId: 'x', entityId: name, name, swimlane: { readyPct: pct } });
    const input = [mk('B', 10), mk('A', 10), mk('C', 0)] as unknown as Parameters<typeof sortWeakestFirst>[0];
    const out = sortWeakestFirst(input);
    expect(out.map((n) => n.name)).toEqual(['C', 'A', 'B']);
    // does not mutate input
    expect((input as { name: string }[]).map((n) => n.name)).toEqual(['B', 'A', 'C']);
  });
});
