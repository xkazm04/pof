/**
 * Orrery model — one `pof.storygraph/1` document in, one polar instrument out.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3, "Orrery"),
 * whose `model.js` was already a pure function of the data. The order of work matters and is the
 * prototype's:
 *
 *   1. node records and the id index (a virtual dataset root is appended at index N)
 *   2. the edge partition — **`contains` is containment and `influences` is the impact layer, so
 *      neither is traversal**; only `then`/`option`/`gate` reach anything
 *   3. reach rows, by the producer's own cohort names (absent = `null`, which is NOT zero)
 *   4. forward reachability from the declared entries, which doubles as the topological order for
 *      a document that declares no axis
 *   5. the containment hierarchy, hub docks and the angular layout (`@/lib/story/orrery/layout`)
 *   6. choice facts — what each option set actually moves, and who reads it
 *   7. subtree aggregates, the audit (`@/lib/story/orrery/audit`), and the flat dial when the
 *      document declares an axis with enough lanes to earn one
 *
 * Pure: no DOM, no `window`, no clock, no randomness, no module-level state. The React surface
 * calls this during render, so same input, same output, every time.
 */

import type { StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';
import { buildAudit, condReadVars } from '@/lib/story/orrery/audit';
import { layoutDocks, layoutFlat, layoutHierarchy, trackLanes } from '@/lib/story/orrery/layout';
import type {
  ChoiceClass,
  ChoiceFacts,
  FlatLayout,
  NodeIx,
  OrreryEdge,
  OrreryModel,
  OrreryNode,
} from '@/lib/story/orrery/types';

/** A dial is only worth building when the document has enough lanes to make tracks of. */
const MIN_FLAT_LANES = 4;
/** Fallback domain width for a variable that declares no numeric range. */
const DEFAULT_DOMAIN_WIDTH = 100;
/** A differing non-numeric write counts this much of a domain width toward the spread. */
const SET_SPREAD_SHARE = 0.5;
/** Added to a choice's spread when at least two options land somewhere different. */
const DIVERGENCE_BONUS = 0.02;
/** How many decisions the model ranks for the surface's "top decisions" list. */
const TOP_DECISIONS = 12;
/** The percentile of choice spread the impact rim normalises against. */
const SPREAD_REFERENCE_PERCENTILE = 0.98;
/** Id of the synthesised root used when the document has several top-level nodes. */
const DATASET_ROOT_ID = '__dataset__';

export function buildOrreryModel(raw: StoryGraph, key: string): OrreryModel {
  const nodes = raw.nodes;
  const N = nodes.length;
  const profile = raw.profile ?? {};
  const axis = profile.axis ?? null;
  const hasAxis = axis !== null;

  /* ---- 1. node records; the virtual dataset root is the last entry */
  const idx = new Map<string, NodeIx>();
  const R: OrreryNode[] = new Array<OrreryNode>(N + 1);
  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    idx.set(n.id, i);
    R[i] = blankNode(i, n);
  }
  const V = N;
  R[V] = blankNode(V, { id: DATASET_ROOT_ID, kind: 'container', class: 'dataset', title: raw.graphId || raw.project || 'dataset' });
  R[V].virtual = true;
  for (let i = 0; i < N; i++) {
    const parent = nodes[i].parent;
    if (parent === undefined) continue;
    const p = idx.get(parent);
    if (p === undefined) continue;
    R[i].par = p;
    R[p].kids.push(i);
  }

  /* ---- 2. edge partition: contains is containment, influences is the impact layer */
  const out: OrreryEdge[][] = new Array<OrreryEdge[]>(N + 1);
  const inn: OrreryEdge[][] = new Array<OrreryEdge[]>(N + 1);
  for (let i = 0; i <= N; i++) {
    out[i] = [];
    inn[i] = [];
  }
  const tr: OrreryEdge[] = [];
  const infl: OrreryEdge[] = [];
  raw.edges.forEach((e, k) => {
    if (e.kind === 'contains') return;
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === undefined || b === undefined) return; // a dangling edge is the validator's finding
    const edge: OrreryEdge = { k, id: e.id, from: a, to: b, kind: e.kind, raw: e };
    if (e.kind === 'influences') {
      infl.push(edge);
      return;
    }
    tr.push(edge);
    out[a].push(edge);
    inn[b].push(edge);
  });

  /* ---- 3. reach: the producer's cohorts, and `null` for anything it did not measure */
  const evidence = raw.evidence;
  const run0 = evidence?.runs?.[0];
  const cohorts: string[] = run0 ? [...run0.cohorts] : [];
  // The cohorts actually present in the rows. Normally the run's own list; a document whose
  // evidence declares no run still gets averaged honestly instead of silently dropped.
  const reachCohorts: string[] = [...cohorts];
  if (evidence?.reach) {
    for (const [id, row] of Object.entries(evidence.reach)) {
      const i = idx.get(id);
      if (i === undefined || !row) continue;
      const names = cohorts.length > 0 ? cohorts : Object.keys(row);
      const measured: Record<string, number> = {};
      let any = false;
      for (const c of names) {
        const v = row[c];
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
        measured[c] = v;
        any = true;
        if (!reachCohorts.includes(c)) reachCohorts.push(c);
      }
      // An empty row is still unmeasured. `{}` would read as "measured, at nothing".
      if (any) R[i].reach = measured;
    }
  }

  /* ---- 4. forward reachability from the declared entries (and the topological fallback) */
  const rank = new Int32Array(N + 1).fill(-1);
  const queue: NodeIx[] = [];
  const entered = new Set<NodeIx>();
  const touch = (i: NodeIx, r: number) => {
    if (rank[i] >= 0) return;
    rank[i] = r;
    queue.push(i);
  };
  for (const id of raw.entries ?? []) {
    const i = idx.get(id);
    if (i !== undefined) touch(i, 0);
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const r = rank[i];
    // Reaching a node reaches the containers it sits in.
    let p = R[i].par;
    while (p >= 0 && rank[p] < 0) {
      rank[p] = r;
      queue.push(p);
      p = R[p].par;
    }
    for (const e of out[i]) {
      if (rank[e.to] < 0 && R[e.to].kids.length > 0) entered.add(e.to);
      touch(e.to, r + 1);
    }
    // An edge into a container enters its children that nothing inside the container reaches.
    if (entered.has(i)) {
      for (const k of R[i].kids) {
        if (!inn[k].some((e) => R[e.from].par === i)) touch(k, r + 1);
      }
    }
  }

  /* ---- 5. hierarchy: display root, sibling order, docks, angular layout */
  const tops: NodeIx[] = [];
  for (let i = 0; i < N; i++) if (R[i].par < 0) tops.push(i);
  let root: NodeIx;
  if (tops.length === 1 && R[tops[0]].kids.length > 0) {
    root = tops[0];
    // The unused virtual record must not look like a root: it gets no sector and no docks.
    R[V].u0 = -1;
    R[V].u1 = -1;
  } else {
    root = V;
    R[V].kids = tops;
    for (const t of tops) R[t].par = V;
  }

  // Subtree minimum rank, so a container orders by when the story first enters it.
  const rankOf = (i: NodeIx) => (rank[i] < 0 ? Number.MAX_SAFE_INTEGER : rank[i]);
  const minRank = new Int32Array(N + 1).fill(Number.MAX_SAFE_INTEGER);
  {
    const post: NodeIx[] = [];
    const st: NodeIx[] = [root];
    while (st.length) {
      const i = st.pop() as NodeIx;
      post.push(i);
      for (const k of R[i].kids) st.push(k);
    }
    for (let a = post.length - 1; a >= 0; a--) {
      const i = post[a];
      let m = rankOf(i);
      for (const k of R[i].kids) if (minRank[k] < m) m = minRank[k];
      minRank[i] = m;
    }
  }
  const compare = hasAxis
    ? (a: NodeIx, b: NodeIx) => (R[a].axis ?? 0) - (R[b].axis ?? 0) || a - b
    : (a: NodeIx, b: NodeIx) => minRank[a] - minRank[b] || a - b;
  const { order } = layoutHierarchy(R, root, { compare });

  const precedence = new Map<string, number>();
  raw.endings.forEach((e, k) => precedence.set(e.node, e.precedence ?? k));
  let { dockPos, dockEnds, dockTmpl, dockEntry } = layoutDocks(R, R[root].docks ?? [], precedence);

  /* ---- 6. choice facts: what the options move, and whether anything reads it */
  const vars = new Map<string, StoryVariable>();
  for (const v of raw.variables) vars.set(v.name, v);
  const domainWidth = (name: string): number => {
    const d = vars.get(name)?.domain;
    if (d && typeof d.min === 'number' && typeof d.max === 'number' && d.max > d.min) return d.max - d.min;
    return DEFAULT_DOMAIN_WIDTH;
  };
  const guardReads = new Set<string>();
  for (const e of tr) for (const v of condReadVars(e.raw.when, raw.definitions)) guardReads.add(v);
  const endingReads = new Set<string>();
  for (const e of raw.endings) {
    for (const v of condReadVars(e.when, raw.definitions)) {
      endingReads.add(v);
      guardReads.add(v);
    }
  }

  for (let i = 0; i < N; i++) {
    const n = R[i];
    if (n.kind !== 'choice') continue;
    const opts = out[i].filter((e) => e.kind === 'option');
    const declared = n.raw.options?.length ?? 0;
    if (opts.length === 0) continue; // nothing wired at all: a terminal, not a choice
    n.ch = choiceFacts(opts, declared, domainWidth, guardReads, endingReads);
  }

  /* ---- 7. subtree aggregates: choice counts, impact, derived reach, the per-subtree census */
  const C = reachCohorts.length;
  const reachSum = new Float64Array((N + 1) * C);
  const reachCount = new Int32Array((N + 1) * C);
  for (let i = 0; i <= N; i++) {
    const n = R[i];
    n.cnt = {
      nodes: 1,
      choices: n.kind === 'choice' ? 1 : 0,
      endings: n.kind === 'ending' ? 1 : 0,
      // A "line" is a prose-or-decision leaf: what a conversation is a clock of.
      lines: n.kids.length === 0 && (n.kind === 'event' || n.kind === 'choice' || n.kind === 'gate') ? 1 : 0,
    };
  }
  for (let a = order.length - 1; a >= 0; a--) {
    const n = R[order[a]];
    if (n.ch) {
      n.nChoice++;
      n.impSum += n.ch.spread;
      if (n.ch.cls === 'false' || n.ch.cls === 'single') n.nFalse++;
      else {
        if (n.ch.spread > n.impMax) n.impMax = n.ch.spread;
        if (n.ch.cls === 'routing' || n.ch.cls === 'decoration') n.nCos++;
      }
    }
    // Derived reach: the mean over this node's MEASURED descendants, per cohort.
    //
    // A container carries no reach row of its own, so without this a whole act reads as unmeasured
    // when every line inside it was measured. The three states the surface must keep apart are
    // `reach` present (measured, and a 0 here is a real zero), `reach` null with `reachMean` set
    // (derived, and it must be labelled as derived), and both null (unmeasured, which is never
    // zero). Only measured rows contribute, so an unmeasured child cannot drag a mean toward 0.
    if (C > 0 && n.reachMeasured > 0) {
      const mean: Record<string, number> = {};
      const base = n.i * C;
      for (let c = 0; c < C; c++) {
        if (reachCount[base + c] > 0) mean[reachCohorts[c]] = reachSum[base + c] / reachCount[base + c];
      }
      if (Object.keys(mean).length > 0) n.reachMean = mean;
    }

    if (n.par < 0 || n.par > N || n.dock) continue;
    const p = R[n.par];
    // Carry this node's whole subtree (its descendants' measured rows plus its own) to the parent.
    if (C > 0) {
      const base = n.i * C;
      const pbase = p.i * C;
      for (let c = 0; c < C; c++) {
        const own = n.reach ? n.reach[reachCohorts[c]] : undefined;
        reachSum[pbase + c] += reachSum[base + c] + (typeof own === 'number' ? own : 0);
        reachCount[pbase + c] += reachCount[base + c] + (typeof own === 'number' ? 1 : 0);
      }
      p.reachMeasured += n.reachMeasured + (n.reach ? 1 : 0);
    }
    p.nChoice += n.nChoice;
    p.nFalse += n.nFalse;
    p.nCos += n.nCos;
    p.impSum += n.impSum;
    if (n.impMax > p.impMax) p.impMax = n.impMax;
    if (p.cnt && n.cnt) {
      p.cnt.nodes += n.cnt.nodes;
      p.cnt.choices += n.cnt.choices;
      p.cnt.endings += n.cnt.endings;
      p.cnt.lines += n.cnt.lines;
    }
  }

  // The impact rim normalises against the 98th percentile, not the maximum: one outlier
  // decision otherwise flattens every other spike into the baseline.
  const spreads: number[] = [];
  for (let i = 0; i < N; i++) {
    const c = R[i].ch;
    if (c) spreads.push(c.spread);
  }
  spreads.sort((a, b) => a - b);
  const spreadRef = spreads.length
    ? Math.max(spreads[Math.floor(spreads.length * SPREAD_REFERENCE_PERCENTILE)], 1e-6)
    : 1;

  const audit = buildAudit({ raw, nodes: R, idx, order, root, out, inn, tr, rank, vars });
  for (const [i, labels] of audit.flags) R[i].flags = labels;
  for (let i = 0; i < N; i++) if (R[i].flags) R[i].nFlag = 1;
  for (let a = order.length - 1; a >= 0; a--) {
    const n = R[order[a]];
    if (n.par >= 0 && !n.dock) R[n.par].nFlag += n.nFlag;
  }

  const topDecisions: NodeIx[] = [];
  for (let i = 0; i < N; i++) {
    const c = R[i].ch;
    if (c && c.cls !== 'false' && c.cls !== 'single') topDecisions.push(i);
  }
  topDecisions.sort((a, b) => (R[b].ch?.spread ?? 0) - (R[a].ch?.spread ?? 0) || a - b);

  /* ---- the flat dial, for a document that declares an axis and lanes */
  let flat: FlatLayout | null = null;
  const declaredLanes = profile.lanes ?? [];
  if (axis && declaredLanes.length >= MIN_FLAT_LANES) {
    // In the dial every ending docks at the hub, not only the ones that hung off the root.
    const endIdx: NodeIx[] = [];
    for (let i = 0; i < N; i++) if (R[i].kind === 'ending') endIdx.push(i);
    const docks = layoutDocks(R, endIdx, precedence, { mode: 'dial' });
    dockPos = docks.dockPos;
    dockEnds = docks.dockEnds;
    dockTmpl = [];
    dockEntry = [];
    for (const i of dockEnds) R[i].dock = true;
    flat = layoutFlat(R, {
      axis,
      laneIds: trackLanes(R, declaredLanes),
      excluded: new Set(endIdx),
    });
  }

  const source = raw.source ?? {};
  const note = typeof source.note === 'string' ? source.note : '';

  return {
    key,
    raw,
    R,
    idx,
    order,
    tr,
    infl,
    out,
    inn,
    cohorts,
    prov: {
      // Honesty flags are read off the document; none of the three is ever assumed.
      unverified: !run0?.graphHash,
      provisional: run0?.provisional === true || source.reachProvisional === true,
      generated: /GENERATED/i.test(note),
      runs: evidence?.runs ?? [],
    },
    spreadRef,
    flat,
    dockPos,
    dockEnds,
    dockTmpl,
    dockEntry,
    audit: audit.groups,
    auditTotal: audit.total,
    topDecisions: topDecisions.slice(0, TOP_DECISIONS),
    // A node can be focused when it owns a sector: docks and the unused virtual record do not.
    can: (i: NodeIx) => Number.isInteger(i) && i >= 0 && i <= N && !R[i].dock && R[i].u1 > R[i].u0,
  };
}

function blankNode(i: NodeIx, n: StoryNode): OrreryNode {
  return {
    i,
    id: n.id,
    kind: n.kind,
    cls: n.class ?? '',
    title: n.title ?? n.id,
    axis: typeof n.axis === 'number' ? n.axis : null,
    par: -1,
    kids: [],
    docks: null,
    depth: 0,
    w: 1,
    u0: 0,
    u1: 0,
    maxd: 0,
    text: n.text ?? '',
    lanes: n.lanes ?? [],
    reach: null,
    reachMean: null,
    reachMeasured: 0,
    ch: null,
    dock: false,
    raw: n,
    nChoice: 0,
    nFalse: 0,
    nCos: 0,
    impSum: 0,
    impMax: 0,
    nFlag: 0,
    flags: null,
    sib: 0,
    cnt: null,
  };
}

/**
 * What one option set actually does.
 *
 * `spread` is how far apart the options pull the world: for each variable, the gap between the
 * highest and lowest value the options give it as a share of that variable's declared domain width
 * — so "+8 of 200" and "+8 of 10" are not the same decision — SUMMED over every variable they pull
 * apart, plus a small bonus when they also land in different places. That is the prototype's
 * definition and the one the impact rim was chosen on. A differing non-numeric write (a `set` to
 * another enum value) counts as a fixed share, because there is no arithmetic to take its size
 * from.
 *
 * The class then says what that move is *for*, which is the question the prototype's `real` /
 * `cosmetic` pair could not answer: an option that moves a variable an ending condition reads is
 * shaping the ending, one that moves a variable a guard reads is consequential, one that only
 * changes where the story goes next is routing, and one that writes state nothing ever reads is
 * decoration. An empty read set is a finding, not a default.
 */
function choiceFacts(
  opts: readonly OrreryEdge[],
  declared: number,
  domainWidth: (name: string) => number,
  guardReads: ReadonlySet<string>,
  endingReads: ReadonlySet<string>,
): ChoiceFacts {
  const dests = new Set<NodeIx>();
  const per = new Map<string, { num: number[]; set: string[] }>();
  opts.forEach((e, oi) => {
    dests.add(e.to);
    for (const w of e.raw.writes ?? []) {
      let rec = per.get(w.var);
      if (!rec) {
        rec = { num: new Array<number>(opts.length).fill(0), set: new Array<string>(opts.length).fill('∅') };
        per.set(w.var, rec);
      }
      if (w.op === 'add') rec.num[oi] += Number(w.value) || 0;
      else if (w.op === 'sub') rec.num[oi] -= Number(w.value) || 0;
      else rec.set[oi] = `${w.op}:${JSON.stringify(w.value)}`;
    }
  });

  let spread = 0;
  const differing: string[] = [];
  for (const [name, rec] of per) {
    let share = 0;
    let max = rec.num[0];
    let min = rec.num[0];
    for (const v of rec.num) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
    if (max > min) share = (max - min) / domainWidth(name);
    if (new Set(rec.set).size > 1) share += SET_SPREAD_SHARE;
    if (share <= 0) continue;
    // The winner's definition: every variable the options pull apart ADDS to the spread, so a
    // choice that nudges six things out-ranks one that moves a single thing slightly harder.
    differing.push(name);
    spread += share;
  }

  const diverges = dests.size > 1;
  // A small bonus for landing somewhere else, so two otherwise identical option sets are ordered
  // by whether the story actually forks. The class is decided on the raw spread, before this.
  if (diverges) spread += DIVERGENCE_BONUS;
  const wiredCount = opts.length;
  let cls: ChoiceClass;
  if (wiredCount < 2) cls = 'single';
  else if (differing.length === 0 && !diverges) cls = 'false';
  else if (differing.some((v) => endingReads.has(v))) cls = 'ending-shaping';
  else if (differing.some((v) => guardReads.has(v))) cls = 'consequential';
  else if (diverges) cls = 'routing';
  else cls = 'decoration';

  return { cls, spread, diverges, optionCount: declared || wiredCount, wiredCount };
}
