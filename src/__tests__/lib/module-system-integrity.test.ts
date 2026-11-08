/**
 * Structural integrity of the module registries, derived from the registries
 * themselves (never from a hand list of ids).
 *
 * Why each guard matters:
 * - A `dependsOn` ref that names no feature row resolves (buildDependencyMap) to a
 *   key no status map ever holds, so `computeBlockers` reports it as a permanent
 *   blocker: the dependent feature can never unblock, whatever the user builds.
 * - Two rows with one featureName in a module collapse onto one
 *   `moduleId::featureName` key — `map.set` keeps the last, so the first row's deps
 *   silently vanish from the graph.
 * - A cycle in MODULE_PREREQUISITES makes each module a prerequisite of itself, so
 *   the Recommended-next banner can never call either one "Ready".
 *
 * Every checker is pure and is also run against a seeded violation, so a checker
 * that stops matching goes red instead of reporting a clean registry.
 *
 * Standard: game-production ▸ wiring-contract-doctrine ▸ cross-catalog-link-resolution
 * — "The dependency field is only worth writing if every name in it is looked up."
 */
import { describe, it, expect } from 'vitest';
import {
  MODULE_FEATURE_DEFINITIONS,
  MODULE_PREREQUISITES,
  type FeatureDefinition,
} from '@/lib/feature-definitions';
import { SUB_MODULES } from '@/lib/module-registry';
import { SUB_MODULE_IDS } from '@/types/modules';

type FeatureDefs = Partial<Record<string, FeatureDefinition[]>>;
type Prereqs = Partial<Record<string, string[]>>;

/** Every `dependsOn` ref (same-module or `module::feature`) that names no declared row. */
function danglingFeatureDeps(defs: FeatureDefs): string[] {
  const keys = new Set<string>();
  for (const [moduleId, features] of Object.entries(defs)) {
    for (const f of features ?? []) keys.add(`${moduleId}::${f.featureName}`);
  }
  const out: string[] = [];
  for (const [moduleId, features] of Object.entries(defs)) {
    for (const f of features ?? []) {
      for (const ref of f.dependsOn ?? []) {
        const parts = ref.split('::');
        const key = parts.length === 1 ? `${moduleId}::${ref}` : ref;
        if (parts.length > 2 || !keys.has(key)) out.push(`${moduleId}::${f.featureName} -> ${ref}`);
      }
    }
  }
  return out;
}

/** featureNames declared twice within one module. */
function duplicateFeatureNames(defs: FeatureDefs): string[] {
  const out: string[] = [];
  for (const [moduleId, features] of Object.entries(defs)) {
    const seen = new Set<string>();
    for (const f of features ?? []) {
      if (seen.has(f.featureName)) out.push(`${moduleId}::${f.featureName}`);
      seen.add(f.featureName);
    }
  }
  return out;
}

/** Rows that depend on themselves (directly). */
function selfDependencies(defs: FeatureDefs): string[] {
  const out: string[] = [];
  for (const [moduleId, features] of Object.entries(defs)) {
    for (const f of features ?? []) {
      const self = `${moduleId}::${f.featureName}`;
      for (const ref of f.dependsOn ?? []) {
        if (ref === f.featureName || ref === self) out.push(self);
      }
    }
  }
  return out;
}

/** Every cycle reachable in a `node -> deps[]` graph, as `a > b > a`. */
function cyclesIn(graph: Partial<Record<string, string[]>>): string[] {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const cycles: string[] = [];
  const visit = (node: string, stack: string[]) => {
    const c = color.get(node) ?? WHITE;
    if (c === BLACK) return;
    if (c === GREY) {
      cycles.push([...stack.slice(stack.indexOf(node)), node].join(' > '));
      return;
    }
    color.set(node, GREY);
    for (const next of graph[node] ?? []) visit(next, [...stack, node]);
    color.set(node, BLACK);
  };
  for (const node of Object.keys(graph)) visit(node, []);
  return cycles;
}

describe('feature graph integrity (MODULE_FEATURE_DEFINITIONS)', () => {
  it('every dependsOn ref resolves to a declared feature row', () => {
    expect(danglingFeatureDeps(MODULE_FEATURE_DEFINITIONS)).toEqual([]);
  });

  it('no module declares the same featureName twice', () => {
    expect(duplicateFeatureNames(MODULE_FEATURE_DEFINITIONS)).toEqual([]);
  });

  it('no feature depends on itself', () => {
    expect(selfDependencies(MODULE_FEATURE_DEFINITIONS)).toEqual([]);
  });

  it('the checkers bite on a seeded violation', () => {
    const seeded: FeatureDefs = {
      'mod-a': [
        { featureName: 'A', category: 'c', description: 'd', dependsOn: ['Missing', 'mod-b::B', 'mod-b::Nope', 'x::y::z'] },
        { featureName: 'A', category: 'c', description: 'd' },
        { featureName: 'Loop', category: 'c', description: 'd', dependsOn: ['Loop'] },
      ],
      'mod-b': [{ featureName: 'B', category: 'c', description: 'd' }],
    };
    expect(danglingFeatureDeps(seeded)).toEqual([
      'mod-a::A -> Missing',
      'mod-a::A -> mod-b::Nope',
      'mod-a::A -> x::y::z',
    ]);
    expect(duplicateFeatureNames(seeded)).toEqual(['mod-a::A']);
    expect(selfDependencies(seeded)).toEqual(['mod-a::Loop']);
  });
});

describe('module prerequisite graph integrity (MODULE_PREREQUISITES)', () => {
  it('has no cycles', () => {
    expect(cyclesIn(MODULE_PREREQUISITES as Prereqs)).toEqual([]);
  });

  it('the cycle checker bites on a seeded violation', () => {
    expect(cyclesIn({ a: ['b'], b: ['c'], c: ['a'], d: [] })).toEqual(['a > b > c > a']);
  });
});

// ─── Checklists and quick actions (module-registry.ts) ──────────────────────
//
// - Checklist progress is keyed by item id, so two items sharing an id tick and
//   untick together and the module's X/Y counts one of them twice.
// - nba-engine resolves `ChecklistItem.dependsOn` with `checklist.find(...)` and
//   DROPS a ref that matches no sibling, so a misspelt prerequisite is silently
//   not enforced; a cycle makes every item in it wait on another forever.
// - Quick actions render keyed by id (QuickActionsPanel) and the global search
//   resolves them by id, so a duplicate id runs the wrong prompt.

interface RegistryModule {
  id: string;
  checklist?: { id: string; dependsOn?: string[] }[];
  quickActions: { id: string }[];
}

function duplicatesOf(ids: string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

function duplicateChecklistIds(mods: RegistryModule[]): string[] {
  return mods.flatMap((m) => duplicatesOf((m.checklist ?? []).map((c) => c.id)).map((id) => `${m.id}:${id}`));
}

function danglingChecklistDeps(mods: RegistryModule[]): string[] {
  const out: string[] = [];
  for (const m of mods) {
    const ids = new Set((m.checklist ?? []).map((c) => c.id));
    for (const c of m.checklist ?? []) {
      for (const dep of c.dependsOn ?? []) if (!ids.has(dep)) out.push(`${m.id}:${c.id} -> ${dep}`);
    }
  }
  return out;
}

function checklistCycles(mods: RegistryModule[]): string[] {
  return mods.flatMap((m) => {
    // Merge deps across duplicate ids so a duplicate can never hide a cycle.
    const graph: Record<string, string[]> = {};
    for (const c of m.checklist ?? []) graph[c.id] = [...(graph[c.id] ?? []), ...(c.dependsOn ?? [])];
    return cyclesIn(graph).map((cycle) => `${m.id}: ${cycle}`);
  });
}

function duplicateQuickActionIds(mods: RegistryModule[]): string[] {
  return mods.flatMap((m) => duplicatesOf(m.quickActions.map((a) => a.id)).map((id) => `${m.id}:${id}`));
}

describe('registry integrity (SUB_MODULES)', () => {
  it('declares every SubModuleId exactly once', () => {
    const ids = SUB_MODULES.map((m) => m.id as string);
    expect(duplicatesOf(ids)).toEqual([]);
    expect(SUB_MODULE_IDS.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('checklist item ids are unique within each module', () => {
    expect(duplicateChecklistIds(SUB_MODULES)).toEqual([]);
  });

  it('every checklist dependsOn names a sibling item', () => {
    expect(danglingChecklistDeps(SUB_MODULES)).toEqual([]);
  });

  it('checklist prerequisites are acyclic', () => {
    expect(checklistCycles(SUB_MODULES)).toEqual([]);
  });

  it('quick-action ids are unique within each module', () => {
    expect(duplicateQuickActionIds(SUB_MODULES)).toEqual([]);
  });

  it('the checkers bite on a seeded violation', () => {
    const seeded: RegistryModule[] = [{
      id: 'mod-a',
      checklist: [
        { id: 'a-1', dependsOn: ['a-2'] },
        { id: 'a-2', dependsOn: ['a-1', 'a-9'] },
        { id: 'a-1' },
      ],
      quickActions: [{ id: 'q-1' }, { id: 'q-1' }],
    }];
    expect(duplicateChecklistIds(seeded)).toEqual(['mod-a:a-1']);
    expect(danglingChecklistDeps(seeded)).toEqual(['mod-a:a-2 -> a-9']);
    expect(checklistCycles(seeded)).toEqual(['mod-a: a-1 > a-2 > a-1']);
    expect(duplicateQuickActionIds(seeded)).toEqual(['mod-a:q-1']);
  });
});
