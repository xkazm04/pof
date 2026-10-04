/**
 * Derived structures the wheel needs per model, cached per model.
 *
 * None of this is new information — it is the same containment tree read three other ways, and the
 * prototype hung all three on the model object as it computed them. Here they live in a `WeakMap`
 * keyed by the model instead, because the model is a prop: the pure core owns its shape, and a
 * surface that mutated it would make the "same input, same output" promise in `model.ts` false.
 *
 * Each cache is built on first ask and then free. `aggregatedEdges` is the expensive one — one pass
 * over every traversal edge per aggregation depth — and the LOD band only ever asks for a handful of
 * depths, so it pays once per depth the user actually reaches.
 */

import type { NodeIx, OrreryEdge, OrreryModel } from '@/lib/story/orrery';
import type { StoryEdgeKind } from '@/lib/story/types';

/** Several traversal edges folded into one line between two ancestors. */
export interface AggEdge {
  a: NodeIx;
  b: NodeIx;
  /** How many real edges this line stands for. */
  n: number;
  /** The kind that wins the bundle: a gate if any, else the majority of option vs then. */
  kind: 'then' | 'option' | 'gate';
}

interface Derived {
  root: NodeIx;
  counts: Map<NodeIx, Int32Array>;
  ancestors: Map<number, Int32Array>;
  aggregates: Map<number, AggEdge[]>;
  laneLabels: Map<string, string>;
}

const CACHE = new WeakMap<OrreryModel, Derived>();

function of(model: OrreryModel): Derived {
  let d = CACHE.get(model);
  if (!d) {
    d = {
      // Containment pre-order starts at the display root, by construction in `layoutHierarchy`.
      root: model.root,
      counts: new Map(),
      ancestors: new Map(),
      aggregates: new Map(),
      laneLabels: new Map((model.raw.profile.lanes ?? []).map((l) => [l.id, l.label])),
    };
    CACHE.set(model, d);
  }
  return d;
}

/**
 * The node the wheel treats as the whole story.
 *
 * This was an inference off the containment order's head until two packages guessed differently and
 * disagreed; `OrreryModel.root` now publishes it, so this is a read.
 */
export function displayRoot(model: OrreryModel): NodeIx {
  return of(model).root;
}

/** Lane label for a lane id, falling back to the id when the profile declares none. */
export function laneLabel(model: OrreryModel, id: string): string {
  return of(model).laneLabels.get(id) ?? id;
}

/**
 * How many descendants of `i` sit at each containment depth. Drives the LOD bands: a ring whose
 * members would each be under a few pixels wide is not worth drawing one at a time.
 */
export function depthCounts(model: OrreryModel, i: NodeIx): Int32Array {
  const d = of(model);
  const hit = d.counts.get(i);
  if (hit) return hit;
  const R = model.R;
  const counts = new Int32Array(R[d.root].maxd + 3);
  const stack: NodeIx[] = [i];
  while (stack.length) {
    const j = stack.pop() as NodeIx;
    for (const k of R[j].kids) {
      const depth = R[k].depth;
      if (depth < counts.length) counts[depth]++;
      stack.push(k);
    }
  }
  d.counts.set(i, counts);
  return counts;
}

/**
 * For every node, the ancestor at or above depth `depth`. This is what lets edges be aggregated:
 * two edges between the same pair of visible ancestors are one line.
 */
export function ancestorAtDepth(model: OrreryModel, depth: number): Int32Array {
  const d = of(model);
  const hit = d.ancestors.get(depth);
  if (hit) return hit;
  const R = model.R;
  const a = new Int32Array(R.length);
  for (let i = 0; i < R.length; i++) a[i] = i;
  // `order` is parents-before-children, so a parent's answer is already settled.
  for (const i of model.order) {
    const n = R[i];
    a[i] = n.depth <= depth || n.par < 0 ? i : a[n.par];
  }
  d.ancestors.set(depth, a);
  return a;
}

/** Traversal edges folded to the ancestors visible at `depth`. Self-loops are dropped. */
export function aggregatedEdges(model: OrreryModel, depth: number): AggEdge[] {
  const d = of(model);
  const hit = d.aggregates.get(depth);
  if (hit) return hit;
  const a = ancestorAtDepth(model, depth);
  const stride = model.R.length;
  const byPair = new Map<number, { a: NodeIx; b: NodeIx; n: number; kc: Record<string, number> }>();
  for (const e of model.tr) {
    const x = a[e.from];
    const y = a[e.to];
    if (x === y) continue;
    const key = x * stride + y;
    let rec = byPair.get(key);
    if (!rec) {
      rec = { a: x, b: y, n: 0, kc: { then: 0, option: 0, gate: 0 } };
      byPair.set(key, rec);
    }
    rec.n++;
    rec.kc[e.kind] = (rec.kc[e.kind] ?? 0) + 1;
  }
  const out: AggEdge[] = [];
  for (const rec of byPair.values()) {
    out.push({
      a: rec.a,
      b: rec.b,
      n: rec.n,
      kind: rec.kc.gate ? 'gate' : rec.kc.option >= rec.kc.then ? 'option' : 'then',
    });
  }
  d.aggregates.set(depth, out);
  return out;
}

/** Narrow an edge kind to the three the chord layers draw; anything else bundles as `then`. */
export function chordKindOf(kind: StoryEdgeKind): 'then' | 'option' | 'gate' {
  return kind === 'option' || kind === 'gate' ? kind : 'then';
}

/** Edges as the overlay wants them: one list per direction, already filtered to traversal. */
export function relationsOf(model: OrreryModel, i: NodeIx): { out: OrreryEdge[]; inn: OrreryEdge[] } {
  return { out: model.out[i] ?? [], inn: model.inn[i] ?? [] };
}
