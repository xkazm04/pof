/**
 * Orrery audit — the structural findings, computed from the document alone.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3, "Orrery").
 * **Nothing here is keyed to a node id**: a staged fixture carries deliberately seeded defects,
 * and a core that recognised them by name would be worthless. Every group is a generic derivation
 * (forward reachability, co-reachability, set differences, domain arithmetic, name distance).
 *
 * Altitude: these are all **structural** findings in the sense of
 * `docs/architecture/storygraph-standard.md` §8 — total, cheap, and provable from the authored
 * graph. Nothing here simulates a runtime, so nothing here is a `lead`, and nothing here is
 * entitled to say the graph is playable. The state altitude (softlocks, unsatisfiable guards,
 * options never offered) belongs to a sampler and is out of this module's scope.
 *
 * Pure: no DOM, no clock, no module state. The node records are not mutated — the flags a finding
 * attaches come back in `AuditResult.flags` for the model to apply.
 */

import type { Cond, StoryGraph, StoryVariable } from '@/lib/story/types';
import type { AuditGroup, NodeIx, OrreryEdge, OrreryNode } from '@/lib/story/orrery/types';

/** Writer lists at or above this length look capped by the producer and are not audited. */
const WRITER_LIST_CAP = 40;
/** Above this edit distance two declared names are not plausibly the same name. */
const TWIN_DISTANCE = 1;

export interface AuditInput {
  raw: StoryGraph;
  /** Node records, length N+1; the last is the virtual dataset root. */
  nodes: readonly OrreryNode[];
  idx: ReadonlyMap<string, NodeIx>;
  /** Containment pre-order, parents before children. */
  order: readonly NodeIx[];
  root: NodeIx;
  out: readonly OrreryEdge[][];
  inn: readonly OrreryEdge[][];
  /** Traversal edges only — `contains` and `influences` are excluded upstream. */
  tr: readonly OrreryEdge[];
  /** BFS distance from the nearest declared entry, or -1 when nothing reaches the node. */
  rank: Int32Array;
  vars: ReadonlyMap<string, StoryVariable>;
}

export interface AuditResult {
  groups: AuditGroup[];
  total: number;
  /** Node index -> the reasons attached to it, in the order they were found. */
  flags: Map<NodeIx, string[]>;
  /** Co-reachability: 2 = an ending is reachable by traversal, 1 = only through containment. */
  canReachEnding: Uint8Array;
}

/* ------------------------------------------------------------------ guard grammar helpers */

/**
 * Walk a `Cond` tree and visit every atom. `all`/`any`/`not` are structure; `ref` is resolved
 * through the document's `definitions` when it can be, and visited as an atom when it cannot.
 */
export function walkCond(
  cond: Cond | undefined,
  visit: (atom: Cond) => void,
  definitions?: Readonly<Record<string, Cond>>,
  seen?: Set<string>,
): void {
  if (!cond || typeof cond !== 'object') return;
  if ('all' in cond) {
    for (const c of cond.all) walkCond(c, visit, definitions, seen);
    return;
  }
  if ('any' in cond) {
    for (const c of cond.any) walkCond(c, visit, definitions, seen);
    return;
  }
  if ('not' in cond) {
    walkCond(cond.not, visit, definitions, seen);
    return;
  }
  if ('ref' in cond && definitions) {
    const target = definitions[cond.ref];
    if (target) {
      const visited = seen ?? new Set<string>();
      if (visited.has(cond.ref)) return; // a definition cycle is not this module's finding to make
      visited.add(cond.ref);
      walkCond(target, visit, definitions, visited);
      return;
    }
  }
  visit(cond);
}

/**
 * The declared variables a guard reads. Only `var` atoms count, which is what the prototype
 * checked; `flag` and `visited` name state in a different namespace and the standard's wider
 * reading of them is not settled here.
 */
export function condReadVars(
  cond: Cond | undefined,
  definitions?: Readonly<Record<string, Cond>>,
): string[] {
  const found: string[] = [];
  walkCond(
    cond,
    (atom) => {
      if ('var' in atom && typeof atom.var === 'string' && !found.includes(atom.var)) found.push(atom.var);
    },
    definitions,
  );
  return found;
}

/** Levenshtein distance, short-circuited past the distance anything here cares about. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n];
}

/** Two declared names that differ by one letter, or by one adjacent transposition. */
export function isTwinName(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5) return false;
  if (editDistance(a, b) <= TWIN_DISTANCE) return true;
  if (a.length === b.length) {
    const d: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i);
    if (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]) return true;
  }
  return false;
}

const wordCount = (text: string): number => (text ? text.trim().split(/\s+/).length : 0);

function compareValue(a: unknown, op: string, b: unknown): boolean {
  switch (op) {
    case '>=':
      return Number(a) >= Number(b);
    case '>':
      return Number(a) > Number(b);
    case '<=':
      return Number(a) <= Number(b);
    case '<':
      return Number(a) < Number(b);
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case 'in':
      return Array.isArray(b) && b.includes(a);
    default:
      return true;
  }
}

/** A plain `{ var, op, value }` guard — the only shape the ending satisfiability check reads. */
function varAtom(cond: Cond | undefined): { var: string; op: string; value: unknown } | null {
  if (!cond || typeof cond !== 'object' || !('var' in cond)) return null;
  return { var: cond.var, op: cond.op, value: cond.value };
}

/* ------------------------------------------------------------------ the audit */

export function buildAudit(input: AuditInput): AuditResult {
  const { raw, nodes: R, idx, order, root, out, inn, tr, rank, vars } = input;
  const N = raw.nodes.length;

  const groups: AuditGroup[] = [];
  const group = (id: string, title: string, severity: AuditGroup['severity'], why: string): AuditGroup => {
    const g: AuditGroup = { id, title, why, severity, items: [] };
    groups.push(g);
    return g;
  };

  const flags = new Map<NodeIx, string[]>();
  const mark = (i: NodeIx, label: string) => {
    const existing = flags.get(i);
    if (existing) existing.push(label);
    else flags.set(i, [label]);
  };

  // Group order is the prototype's; each `why` names the standard's finding code (§8) so a
  // reader can line a finding up against the normative table.
  const gUnreach = group('unreach', 'Unreachable from any entry', 'error',
    'No chain of then/option/gate edges leads here from a declared entry (ORPHAN_NODE, structural).');
  const gDead = group('dead', 'Regions with no ending reachable', 'error',
    'Reached from an entry, but no path continues to any ending (NO_ENDING_REACHABLE, structural).');
  const gEnd = group('ending', 'Declared endings that cannot be reached', 'error',
    'No path leads there, or the guard reads state nothing can satisfy (ENDING_UNREACHABLE, structural).');
  const gTerm = group('term', 'Terminals that are not declared endings', 'warn',
    'The path stops here, but the node is not in `endings` (UNDECLARED_TERMINAL, structural).');
  const gFalse = group('false', 'False choices', 'warn',
    'Every option writes the same state and lands in the same place (FALSE_CHOICE, structural).');
  const gSingle = group('single', 'Choices with fewer than two wired options', 'warn',
    'Options are declared on the node but fewer than two have an edge: there is nothing to choose between. The standard has no code for this; it is the prototype’s own finding.');
  const gUndecl = group('undecl', 'Variables used but never declared', 'error',
    'A name read or written with no declaration, and declared names a letter apart (VAR_UNDECLARED and VAR_SINGLETON, structural).');
  const gWriter = group('writer', 'Writes outside the declared writers', 'warn',
    `The variable names an allowed set of writer nodes and this one is not in it (VAR_WRITER_NOT_OWNER). Writer lists of ${WRITER_LIST_CAP}+ look capped by the producer and are not checked.`);
  const gDomain = group('domain', 'Writes outside the declared domain', 'warn',
    'A value, or a single delta, that the declared domain cannot hold (VAR_DOMAIN_VIOLATION, structural).');
  const gExpr = group('expr', 'Untyped guard (expr)', 'warn',
    'A free-text condition: not checkable against the declared variables (UNTYPED_CONDITION, structural).');
  const gBudget = group('budget', 'Text over its class budget', 'warn',
    'Word count above the budget declared for the node class (TEXT_BUDGET_EXCEEDED, structural).');

  /* ---- unreachable: grouped under the highest wholly-unreached container */
  const skip = (n: OrreryNode) => n.kind === 'template' || n.virtual === true;
  const highestUnreached = (i: NodeIx): NodeIx => {
    let top = i;
    let p = R[i].par;
    while (p >= 0 && rank[p] < 0) {
      top = p;
      p = R[p].par;
    }
    return top;
  };
  const reported = new Set<NodeIx>();
  for (let i = 0; i < N; i++) {
    if (rank[i] >= 0 || skip(R[i]) || R[i].kind === 'ending') continue;
    const top = highestUnreached(i);
    if (reported.has(top)) continue;
    reported.add(top);
    const n = R[top];
    gUnreach.items.push({
      i: top,
      text: n.kids.length > 0 ? `${n.title} (container, ${n.w} nodes)` : n.title,
    });
    mark(top, 'unreachable');
  }

  /* ---- co-reachability: walk backwards from every ending */
  const canReachEnding = new Uint8Array(N + 1);
  const endNodes: NodeIx[] = [];
  const isEnd = new Set<NodeIx>();
  for (let i = 0; i < N; i++) {
    if (R[i].kind !== 'ending') continue;
    endNodes.push(i);
    isEnd.add(i);
  }
  // A node the document declares as an ending counts even when its kind says otherwise.
  for (const e of raw.endings) {
    const i = idx.get(e.node);
    if (i === undefined || isEnd.has(i)) continue;
    endNodes.push(i);
    isEnd.add(i);
  }
  const queue: NodeIx[] = [];
  const reaches = (i: NodeIx, direct: boolean) => {
    if (!canReachEnding[i]) {
      canReachEnding[i] = direct ? 2 : 1;
      queue.push(i);
    } else if (direct && canReachEnding[i] === 1) {
      canReachEnding[i] = 2;
      queue.push(i);
    }
  };
  const markDescendants = (i: NodeIx) => {
    const st = [...R[i].kids];
    while (st.length) {
      const k = st.pop() as NodeIx;
      reaches(k, true);
      for (const c of R[k].kids) st.push(c);
    }
  };
  for (const i of endNodes) reaches(i, true);
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const direct = canReachEnding[i] === 2;
    for (const e of inn[i]) reaches(e.from, true);
    let p = R[i].par;
    while (p >= 0) {
      reaches(p, false);
      p = R[p].par;
    }
    if (direct && R[i].kids.length > 0) markDescendants(i);
  }

  /* ---- dead regions: reached, but nothing from here reaches an ending */
  const reachedLeaves = new Int32Array(N + 1);
  const deadLeaves = new Int32Array(N + 1);
  for (let a = order.length - 1; a >= 0; a--) {
    const i = order[a];
    const n = R[i];
    if (n.kids.length === 0) {
      if (rank[i] >= 0 && n.kind !== 'ending') {
        reachedLeaves[i] = 1;
        deadLeaves[i] = canReachEnding[i] ? 0 : 1;
      }
    } else {
      for (const k of n.kids) {
        reachedLeaves[i] += reachedLeaves[k];
        deadLeaves[i] += deadLeaves[k];
      }
    }
  }
  // Report the highest node whose every reached leaf is dead, else descend into the dead parts.
  const deadStack: NodeIx[] = [root];
  while (deadStack.length) {
    const i = deadStack.pop() as NodeIx;
    if (reachedLeaves[i] > 0 && deadLeaves[i] === reachedLeaves[i]) {
      const n = R[i];
      gDead.items.push({
        i,
        text:
          n.kids.length > 0
            ? `${n.title} (${reachedLeaves[i]} reachable nodes, none lead to an ending)`
            : n.title,
      });
      mark(i, 'dead region');
      continue;
    }
    const kids = R[i].kids;
    for (let q = kids.length - 1; q >= 0; q--) if (deadLeaves[kids[q]] > 0) deadStack.push(kids[q]);
  }

  /* ---- declared endings: reachable at all, and is the guard satisfiable */
  const writtenVars = new Set<string>();
  for (const e of tr) for (const w of e.raw.writes ?? []) writtenVars.add(w.var);
  for (const e of raw.endings) {
    const i = idx.get(e.node);
    if (i === undefined) continue;
    let why: string | null = null;
    const when = varAtom(e.when);
    if (rank[i] < 0 && inn[i].length === 0) why = 'no edge leads to it';
    else if (rank[i] < 0) why = 'no path from an entry reaches it';
    else if (when) {
      const v = vars.get(when.var);
      const d = v?.domain;
      if (!v) why = `its guard reads undeclared variable "${when.var}"`;
      else if (!writtenVars.has(v.name) && !compareValue(v.initial, when.op, when.value)) {
        why = `guard ${when.var} ${when.op} ${JSON.stringify(when.value)} but nothing ever writes ${v.name}`;
      } else if (
        d && typeof d.max === 'number' && (when.op === '>=' || when.op === '>') &&
        typeof when.value === 'number' && when.value > d.max
      ) {
        why = `guard needs ${v.name} ${when.op} ${when.value}, above its domain max ${d.max}`;
      } else if (
        d?.values && when.op === 'in' && Array.isArray(when.value) &&
        when.value.some((x) => !d.values?.includes(x)) && !writtenVars.has(v.name)
      ) {
        why = `guard value is not in the domain of ${v.name}`;
      }
    }
    if (why) {
      gEnd.items.push({ i, text: `${R[i].title}: ${why}` });
      mark(i, 'ending unreachable');
    }
  }

  /* ---- terminals that are not declared endings: a set difference, not a heuristic */
  for (let i = 0; i < N; i++) {
    const n = R[i];
    if (n.kind === 'ending' || n.kind === 'template' || n.kind === 'container') continue;
    if (n.kids.length > 0 || out[i].length > 0) continue;
    gTerm.items.push({ i, text: `${n.title} (${n.kind})` });
    mark(i, 'undeclared terminal');
  }

  /* ---- choices whose options do not choose anything */
  for (let i = 0; i < N; i++) {
    const c = R[i].ch;
    if (!c) continue;
    if (c.cls === 'false') {
      gFalse.items.push({ i, text: `${R[i].title} (${c.wiredCount} options, one outcome)` });
      mark(i, 'false choice');
    } else if (c.cls === 'single') {
      gSingle.items.push({
        i,
        text: `${R[i].title} (${c.optionCount || '?'} declared, ${c.wiredCount} wired)`,
      });
      mark(i, 'unwired option');
    }
  }

  /* ---- declared names a letter apart: one of them is a misspelling */
  const names = [...vars.keys()];
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      if (!isTwinName(names[a], names[b])) continue;
      gUndecl.items.push({
        i: -1,
        text: `Declared twins "${names[a]}" and "${names[b]}" differ by a letter or two: one is probably a typo`,
      });
    }
  }

  /* ---- writes and guards, edge by edge */
  const nearest = (name: string): string | null => {
    let best: string | null = null;
    let bestD = 3;
    for (const x of names) {
      const d = editDistance(name, x);
      if (d < bestD) {
        bestD = d;
        best = x;
      }
    }
    return best;
  };
  const undeclared = new Map<string, { item: { i: NodeIx; text: string }; count: number }>();
  const noteUndeclared = (name: string, i: NodeIx, where: string) => {
    const seen = undeclared.get(name);
    if (seen) {
      seen.count++;
      return;
    }
    const near = nearest(name);
    const item = {
      i,
      text: `"${name}" in ${where} of ${R[i].title}${near ? ` (nearest declared: ${near})` : ''}`,
    };
    undeclared.set(name, { item, count: 1 });
    gUndecl.items.push(item);
    mark(i, 'undeclared variable');
  };
  const ancestorIds = (i: NodeIx): string[] => {
    const ids: string[] = [];
    let p = i;
    while (p >= 0) {
      ids.push(R[p].id);
      p = R[p].par;
    }
    return ids;
  };

  for (const e of tr) {
    const from = R[e.from];
    for (const w of e.raw.writes ?? []) {
      const v = vars.get(w.var);
      if (!v) {
        noteUndeclared(w.var, e.from, 'a write');
        continue;
      }
      if (
        v.writers.length > 0 && v.writers.length < WRITER_LIST_CAP &&
        !v.writers.includes(from.id) && !ancestorIds(e.from).some((id) => v.writers.includes(id))
      ) {
        gWriter.items.push({
          i: e.from,
          text: `${w.var} written by ${from.title} (${from.id}), not a declared writer`,
        });
        mark(e.from, 'write outside writers');
      }
      const bad = domainViolation(w.op, w.value, v);
      if (bad) {
        gDomain.items.push({ i: e.from, text: `${w.var}: ${bad} (${from.title})` });
        mark(e.from, 'domain violation');
      }
    }
    if (e.raw.when) {
      walkCond(
        e.raw.when,
        (atom) => {
          if ('var' in atom && !vars.has(atom.var)) noteUndeclared(atom.var, e.from, 'a guard');
          if ('expr' in atom) {
            gExpr.items.push({ i: e.from, text: `"${atom.expr}" on ${from.title} → ${R[e.to].title}` });
            mark(e.from, 'untyped guard');
          }
        },
        raw.definitions,
      );
    }
  }
  for (const e of raw.endings) {
    if (!e.when) continue;
    const i = idx.get(e.node);
    if (i === undefined) continue;
    walkCond(
      e.when,
      (atom) => {
        if ('expr' in atom) {
          gExpr.items.push({ i, text: `"${atom.expr}" on ending ${R[i].title}` });
          mark(i, 'untyped guard');
        }
      },
      raw.definitions,
    );
  }
  // One item per undeclared name, carrying how many places use it.
  for (const [, rec] of undeclared) {
    if (rec.count > 1) rec.item.text += ` — and ${rec.count - 1} more use${rec.count > 2 ? 's' : ''}`;
  }

  /* ---- text budgets */
  const perClass = raw.budgets?.perClass ?? {};
  for (let i = 0; i < N; i++) {
    const n = R[i];
    const budget = perClass[n.cls];
    if (!budget || !n.text) continue;
    const words = wordCount(n.text);
    if (words <= budget) continue;
    gBudget.items.push({ i, text: `${n.title}: ${words} words, budget ${budget}` });
    mark(i, 'over budget');
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  return { groups, total, flags, canReachEnding };
}

/**
 * Whether one write can land in the variable's declared domain.
 *
 * The prototype only checked `set` and the add/sub width; it therefore missed a seeded
 * `push` of a value outside an enum domain. Every op that *places* a value (`set`, `push`,
 * `min`, `max`) is checked here against the same domain — see the package report.
 */
function domainViolation(op: string, value: unknown, v: StoryVariable): string | null {
  const d = v.domain ?? {};
  const places = op === 'set' || op === 'push' || op === 'min' || op === 'max';
  if (places) {
    if (typeof value === 'number' && typeof d.min === 'number' && typeof d.max === 'number') {
      if (value < d.min || value > d.max) return `${op} ${value} outside [${d.min}, ${d.max}]`;
    }
    if (d.values && !d.values.includes(value)) {
      return `${op} ${JSON.stringify(value)} not in {${d.values.join(', ')}}`;
    }
    return null;
  }
  if (
    (op === 'add' || op === 'sub') && typeof d.min === 'number' && typeof d.max === 'number' &&
    Math.abs(Number(value)) > d.max - d.min
  ) {
    return `${op} ${value} exceeds the whole domain width`;
  }
  return null;
}
