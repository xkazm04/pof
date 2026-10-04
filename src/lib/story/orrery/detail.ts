/**
 * Line detail — the fourth level of the Orrery: click one line and see the situation it sits in,
 * what led here, and what it changes.
 *
 * This layer is **not in the prototype**. It is a pure derivation from the model, never authored:
 *
 *  - `situation` — the containment chain from the dataset root down to this line, so "where am I"
 *    is answered by the document's own hierarchy.
 *  - `predecessors` / `successors` — immediate traversal neighbours with the edge that connects
 *    them. `contains` is containment and `influences` is the impact layer, so neither appears here.
 *  - `impact` — every write on the edges into and out of this line, and **who reads it**: the
 *    nodes whose guards read that variable anywhere forward of here, and whether an ending
 *    condition reads it. An empty `readBy` with `endingReads: false` is the whole point of the
 *    panel — it is the fact that makes a decoration visible — so it is computed, never defaulted.
 *  - `influences` — the influence edges touching this line, with direction.
 *
 * Pure: no DOM, no clock, no module state. Called on click, so the work is per-node and bounded
 * by one forward walk plus one pass over the traversal edges.
 */

import { condReadVars } from '@/lib/story/orrery/audit';
import type { LineDetail, NodeIx, OrreryModel, OrreryNode } from '@/lib/story/orrery/types';

export function buildLineDetail(model: OrreryModel, i: NodeIx): LineDetail | null {
  const R = model.R;
  if (!Number.isInteger(i) || i < 0 || i >= R.length) return null;
  const node = R[i];

  /* ---- situation: the containment chain, root first */
  const situation: OrreryNode[] = [];
  const onChain = new Set<NodeIx>();
  for (let p: NodeIx = i; p >= 0; p = R[p].par) {
    if (onChain.has(p)) break; // a containment cycle is the validator's finding, not a hang
    onChain.add(p);
    situation.push(R[p]);
  }
  situation.reverse();

  /* ---- traversal neighbours */
  const predecessors = model.inn[i].map((edge) => ({ node: R[edge.from], edge }));
  const successors = model.out[i].map((edge) => ({ node: R[edge.to], edge }));

  /* ---- impact: one entry per write on the edges touching this line */
  const touching = [...model.inn[i], ...model.out[i]];
  const written = new Set<string>();
  for (const e of touching) for (const w of e.raw.writes ?? []) written.add(w.var);

  const readBy = new Map<string, NodeIx[]>();
  const endingReaders = new Set<string>();
  if (written.size > 0) {
    // Everything forward of here by traversal — the only place a later guard can sit.
    //
    // Containment carries flow in both directions and the walk has to honour both, exactly as
    // the model's own reachability walk does: an edge into a container enters the children
    // nothing inside it reaches, and being somewhere means being inside everything that contains
    // it — which is how a conversation is left, because the edge onward hangs off the
    // conversation, not off its last line. Without both steps the walk stops at the first
    // container wall and `readBy` would come back empty because the search gave up, which is the
    // one thing this field must never mean.
    const forward = new Uint8Array(R.length);
    const walk: NodeIx[] = [];
    const reach = (n: NodeIx) => {
      if (forward[n]) return;
      forward[n] = 1;
      walk.push(n);
    };
    const enter = (c: NodeIx) => {
      for (const k of R[c].kids) {
        if (!model.inn[k].some((e) => R[e.from].par === c)) reach(k);
      }
    };
    reach(i);
    if (R[i].kids.length > 0) enter(i);
    for (let h = 0; h < walk.length; h++) {
      const cur = walk[h];
      for (let p = R[cur].par; p >= 0 && !forward[p]; p = R[p].par) reach(p);
      for (const e of model.out[cur]) {
        const already = forward[e.to];
        reach(e.to);
        if (!already && R[e.to].kids.length > 0) enter(e.to);
      }
    }
    const seen = new Map<string, Set<NodeIx>>();
    for (const name of written) seen.set(name, new Set<NodeIx>());
    for (const e of model.tr) {
      if (!e.raw.when || !forward[e.from]) continue;
      for (const name of condReadVars(e.raw.when, model.raw.definitions)) {
        seen.get(name)?.add(e.from);
      }
    }
    for (const [name, set] of seen) readBy.set(name, [...set].sort((a, b) => a - b));
    for (const ending of model.raw.endings) {
      for (const name of condReadVars(ending.when, model.raw.definitions)) {
        if (written.has(name)) endingReaders.add(name);
      }
    }
  }

  const impact: LineDetail['impact'] = [];
  for (const e of touching) {
    for (const w of e.raw.writes ?? []) {
      impact.push({
        variable: w.var,
        op: w.op,
        value: w.value,
        readBy: readBy.get(w.var) ?? [],
        endingReads: endingReaders.has(w.var),
      });
    }
  }

  /* ---- the impact layer touching this line */
  const influences: LineDetail['influences'] = [];
  for (const e of model.infl) {
    if (e.from === i) influences.push({ node: R[e.to], direction: 'out' });
    else if (e.to === i) influences.push({ node: R[e.from], direction: 'in' });
  }

  return {
    i,
    situation,
    predecessors,
    successors,
    impact,
    influences,
    reach: node.reach,
    flags: node.flags,
  };
}
