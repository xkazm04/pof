import { describe, expect, it } from 'vitest';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The mutation probe, run over the Items step specs.
 *
 * A gate is only a gate if its verdict can move when its own content changes. This probe
 * takes each step's OWN produced artifact, mutates it, and re-runs the step's `accept`.
 * A step whose status is identical across every mutant is insensitive to its own content:
 * whatever it prints, it is not checking anything.
 *
 * Two properties of the mutant set are load-bearing, and a probe without them reports
 * false insensitivity — both were observed while writing this one:
 *
 *  - **Mutate ONE leaf at a time, not every value at once.** A predicate that reads a
 *    ratio (cost against a curve derived from power) is invariant under a uniform scale
 *    of all its inputs, so a whole-artifact scale moves nothing and the step looks
 *    decorative when it is not.
 *  - **Recurse.** An artifact shaped `{ stats: { … } }` has exactly one top-level value,
 *    and a mutator that only walks the top level never touches the numbers the checker
 *    actually reads.
 */

const ENTITY = { id: 'probe-entity', name: 'Probe Item' } as unknown as LabEntity;

type Data = Record<string, unknown>;

/** Every leaf path in the artifact, as a list of keys/indices. */
function leafPaths(v: unknown, prefix: (string | number)[] = []): (string | number)[][] {
  if (Array.isArray(v)) return v.flatMap((x, i) => leafPaths(x, [...prefix, i]));
  if (v && typeof v === 'object') {
    return Object.entries(v as Data).flatMap(([k, x]) => leafPaths(x, [...prefix, k]));
  }
  return prefix.length ? [prefix] : [];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function setAt(root: Data, path: (string | number)[], value: unknown): void {
  let node: Record<string | number, unknown> = root;
  for (const k of path.slice(0, -1)) node = node[k] as Record<string | number, unknown>;
  node[path[path.length - 1]] = value;
}

function deleteAt(root: Data, path: (string | number)[]): void {
  let node: Record<string | number, unknown> = root;
  for (const k of path.slice(0, -1)) node = node[k] as Record<string | number, unknown>;
  delete node[path[path.length - 1]];
}

/** One mutant per leaf per operation: perturb it, and remove it. */
function mutants(data: Data): Data[] {
  const out: Data[] = [];
  for (const path of leafPaths(data)) {
    const perturbed = clone(data);
    let node: unknown = data;
    for (const k of path) node = (node as Record<string | number, unknown>)[k];

    if (typeof node === 'number') setAt(perturbed, path, node * 37 + 11);
    else if (typeof node === 'string') setAt(perturbed, path, 'MUTATED');
    else if (typeof node === 'boolean') setAt(perturbed, path, !node);
    else setAt(perturbed, path, null);
    out.push(perturbed);

    const removed = clone(data);
    deleteAt(removed, path);
    out.push(removed);
  }
  // Plus the empty artifact: the honest floor.
  out.push({});
  return out;
}

describe('Items step acceptance is sensitive to its own content', () => {
  for (const [step, spec] of Object.entries(ITEM_STEP_SPECS)) {
    if (typeof spec.produce !== 'function' || typeof spec.accept !== 'function') continue;

    it(`${step} — a mutation of its own artifact moves the verdict`, () => {
      const produced = spec.produce!(ENTITY) as { data?: Data };
      const data = (produced?.data ?? {}) as Data;
      const baseline = spec.accept!(data)?.status as string;

      const set = mutants(data);
      const moved = set.some((m) => {
        try {
          return (spec.accept!(m)?.status as string) !== baseline;
        } catch {
          return true; // a throw is a moved verdict: the predicate read something
        }
      });

      // eslint-disable-next-line no-console
      if (!moved) console.log(`INSENSITIVE  ${step}  (always "${baseline}", ${set.length} mutants)`);

      expect(
        moved,
        `"${step}" returned "${baseline}" for all ${set.length} mutants of its own produced artifact`,
      ).toBe(true);
    });
  }
});
