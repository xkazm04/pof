/**
 * Every scenario's `dependsOn` graph must be closed and acyclic — DERIVED from the
 * catalogs themselves, not restated here.
 *
 * Why this matters: the orchestrator treats a dependency it cannot find as
 * RESOLVED (`isDependencyResolved`: "Unknown dep — don't block"), so a typo in a
 * hand-maintained `dependsOn` list does not stall the plan, it silently UNBLOCKS
 * the area — the dependent runs before the work it depends on exists, and nothing
 * in the run says so. `overhaul-areas.test.ts` pins id uniqueness; this pins the
 * edges. The bogus-catalog case proves the check bites.
 */
import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '@/lib/harness/scenarios';
import type { ModuleArea } from '@/lib/harness/types';

/** Unresolved edges (`areaId -> missingDep`) plus the first cycle found, if any. */
export function auditDependencyGraph(areas: ModuleArea[]): { unresolved: string[]; cycle: string[] | null } {
  const ids = new Set(areas.map((a) => a.id));
  const unresolved: string[] = [];
  for (const a of areas) {
    for (const d of a.dependsOn) if (!ids.has(d)) unresolved.push(`${a.id} -> ${d}`);
  }
  const byId = new Map(areas.map((a) => [a.id, a]));
  const state = new Map<string, 'visiting' | 'done'>();
  let cycle: string[] | null = null;
  const visit = (id: string, trail: string[]): void => {
    if (cycle) return;
    const s = state.get(id);
    if (s === 'done') return;
    if (s === 'visiting') { cycle = [...trail.slice(trail.indexOf(id)), id]; return; }
    state.set(id, 'visiting');
    for (const d of byId.get(id)?.dependsOn ?? []) if (byId.has(d)) visit(d, [...trail, id]);
    state.set(id, 'done');
  };
  for (const a of areas) visit(a.id, []);
  return { unresolved, cycle };
}

describe('scenario dependency graphs are closed and acyclic', () => {
  const names = Object.keys(SCENARIOS);

  it('has scenarios to check', () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)('%s: every dependsOn names an area in the same scenario', (name) => {
    const { unresolved } = auditDependencyGraph(SCENARIOS[name].areas);
    expect(unresolved, `a typo here silently UNBLOCKS the dependent (isDependencyResolved)`).toEqual([]);
  });

  it.each(names)('%s: the dependency graph has no cycle', (name) => {
    expect(auditDependencyGraph(SCENARIOS[name].areas).cycle).toBeNull();
  });

  it('the audit bites: a dangling edge and a cycle are both reported', () => {
    const mk = (id: string, deps: string[]): ModuleArea => ({
      id, moduleId: 'arpg-combat' as never, label: id, description: '', checklistItemIds: [],
      featureNames: [], dependsOn: deps, status: 'pending', features: [],
    });
    const dangling = auditDependencyGraph([mk('a', []), mk('b', ['a', 'typo-of-a'])]);
    expect(dangling.unresolved).toEqual(['b -> typo-of-a']);
    const cyclic = auditDependencyGraph([mk('a', ['c']), mk('b', ['a']), mk('c', ['b'])]);
    expect(cyclic.cycle).not.toBeNull();
  });
});
