/**
 * The variable half of the structural pass (§3, §6, §8): `VAR_UNDECLARED`, `VAR_SINGLETON`,
 * `VAR_DOMAIN_VIOLATION`, `VAR_WRITER_NOT_OWNER`, `VAR_NO_REACHING_WRITE`, `UNTYPED_CONDITION`.
 *
 * Occurrences are TEXTUAL: a guard's `ref` is counted where the definition is written, not once per
 * use, so a name used once in a shared definition is still one occurrence. The reaching-write walk
 * resolves `ref`, because there what matters is which variables a guard actually reads at a node.
 * Pure: no clock, no I/O.
 */

import type { Cond, StoryFinding, StoryGraph, StoryVariable, StoryWrite } from '@/lib/story/types';
import { bfsTree, exitId, pathTo, type StoryTopology } from '@/lib/story/reachability';
import { structural } from '@/lib/story/structure';

/* ------------------------------------------------------------------ the Cond grammar */

/** Visit every atom of a guard. Unknown shapes are atoms too (default branch, never a crash). */
export function walkCond(
  cond: Cond | undefined,
  visit: (atom: Cond) => void,
  definitions?: Readonly<Record<string, Cond>>,
  seen: Set<string> = new Set(),
): void {
  if (!cond || typeof cond !== 'object') return;
  if ('all' in cond && Array.isArray(cond.all)) {
    for (const c of cond.all) walkCond(c, visit, definitions, seen);
  } else if ('any' in cond && Array.isArray(cond.any)) {
    for (const c of cond.any) walkCond(c, visit, definitions, seen);
  } else if ('not' in cond) {
    walkCond(cond.not, visit, definitions, seen);
  } else if ('ref' in cond && definitions && typeof cond.ref === 'string' && definitions[cond.ref] && !seen.has(cond.ref)) {
    seen.add(cond.ref);
    walkCond(definitions[cond.ref], visit, definitions, seen);
  } else {
    visit(cond);
  }
}

const varOf = (atom: Cond): string | null => ('var' in atom && typeof atom.var === 'string' ? atom.var : null);

function readVars(cond: Cond | undefined, definitions?: Readonly<Record<string, Cond>>): string[] {
  const out = new Set<string>();
  walkCond(cond, (a) => { const v = varOf(a); if (v !== null) out.add(v); }, definitions);
  return [...out];
}

/* ------------------------------------------------------------------ occurrences */

interface Occurrence {
  name: string;
  /** The node it sits on: an edge's source, an ending's node; absent inside a definition. */
  node?: string;
  kind: 'read' | 'write';
}

function occurrences(graph: StoryGraph): Occurrence[] {
  const out: Occurrence[] = [];
  const reads = (cond: Cond | undefined, node?: string) =>
    walkCond(cond, (a) => { const v = varOf(a); if (v !== null) out.push({ name: v, node, kind: 'read' }); });
  for (const e of graph.edges) {
    reads(e.when, e.from);
    for (const w of e.writes ?? []) out.push({ name: w.var, node: e.from, kind: 'write' });
  }
  for (const end of graph.endings) reads(end.when, end.node);
  for (const def of Object.values(graph.definitions ?? {})) reads(def);
  return out;
}

/* ------------------------------------------------------------------ domain arithmetic */

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Why one write cannot land inside the declared domain, or null when it can. */
export function domainViolation(w: StoryWrite, v: StoryVariable): string | null {
  const d = v.domain ?? {};
  const { op, value } = w;
  if (op === 'add' || op === 'sub') {
    if (!isNum(value)) return `${op} of a non-number ${JSON.stringify(value)}`;
    if (isNum(d.min) && isNum(d.max) && Math.abs(value) > d.max - d.min) return `${op} ${value} exceeds the whole domain width ${d.max - d.min}`;
    return null;
  }
  // `min` / `max` clamp: only a bound beyond the domain on the far side can force a value out.
  if (op === 'min') return isNum(value) && isNum(d.min) && value < d.min ? `min ${value} forces below domain min ${d.min}` : null;
  if (op === 'max') return isNum(value) && isNum(d.max) && value > d.max ? `max ${value} forces above domain max ${d.max}` : null;
  // `set` and `push` place a value.
  if (d.values && !d.values.some((x) => x === value)) return `${op} ${JSON.stringify(value)} not in {${d.values.map((x) => JSON.stringify(x)).join(', ')}}`;
  if (v.type === 'int' || v.type === 'float') {
    if (!isNum(value)) return `${op} ${JSON.stringify(value)} into a ${v.type}`;
    if (v.type === 'int' && !Number.isInteger(value)) return `${op} ${value} into an int`;
    if (isNum(d.min) && value < d.min) return `${op} ${value} below domain min ${d.min}`;
    if (isNum(d.max) && value > d.max) return `${op} ${value} above domain max ${d.max}`;
  }
  if (v.type === 'bool' && typeof value !== 'boolean') return `${op} ${JSON.stringify(value)} into a bool`;
  return null;
}

/* ------------------------------------------------------------------ the findings */

export function variableFindings(graph: StoryGraph, topo: StoryTopology): StoryFinding[] {
  const out: StoryFinding[] = [];
  const declared = new Map<string, StoryVariable>();
  for (const v of graph.variables) if (!declared.has(v.name)) declared.set(v.name, v);
  const occ = occurrences(graph);

  // VAR_UNDECLARED — one finding per name, attached to every node that uses it.
  const undeclared = new Map<string, Set<string>>();
  const count = new Map<string, number>();
  for (const o of occ) {
    count.set(o.name, (count.get(o.name) ?? 0) + 1);
    if (declared.has(o.name)) continue;
    const at = undeclared.get(o.name) ?? new Set<string>();
    if (o.node !== undefined) at.add(o.node);
    undeclared.set(o.name, at);
  }
  for (const [name, at] of undeclared) {
    out.push(structural('VAR_UNDECLARED', [...at].sort(), `"${name}" is read or written but never declared`, { variables: [name] }));
  }

  // VAR_SINGLETON — a DECLARED name used exactly once. An undeclared one-off is VAR_UNDECLARED,
  // the stronger finding on the same fact, so each name carries one of the two.
  for (const [name, n] of count) {
    if (n !== 1 || !declared.has(name)) continue;
    const o = occ.find((x) => x.name === name)!;
    out.push(structural('VAR_SINGLETON', o.node !== undefined ? [o.node] : [], `"${name}" occurs exactly once (a ${o.kind}): a misspelling or dead state`, { variables: [name] }));
  }

  // Writes: domain, and ownership. A writer may be the node or a container enclosing it.
  const notOwner = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    for (const w of e.writes ?? []) {
      const v = declared.get(w.var);
      if (!v) continue;
      const bad = domainViolation(w, v);
      if (bad) out.push(structural('VAR_DOMAIN_VIOLATION', [e.from], `${w.var}: ${bad} (edge ${e.id})`, { variables: [w.var] }));
      let owned = v.writers.includes(e.from);
      for (let p = topo.parentOf.get(e.from); !owned && p !== undefined; p = topo.parentOf.get(p)) owned = v.writers.includes(p);
      if (!owned) notOwner.set(w.var, (notOwner.get(w.var) ?? new Set<string>()).add(e.from));
    }
  }
  for (const [name, at] of notOwner) {
    const v = declared.get(name)!;
    out.push(structural('VAR_WRITER_NOT_OWNER', [...at].sort(), `${name}: ${at.size} writing node(s) absent from writers[] (which lists ${v.writers.length})`, { variables: [name] }));
  }

  // UNTYPED_CONDITION — every `expr` atom, where it is written.
  const exprs = (cond: Cond | undefined, nodes: string[], where: string) => {
    walkCond(cond, (a) => {
      if ('expr' in a) out.push(structural('UNTYPED_CONDITION', nodes, `untyped guard on ${where}: "${String(a.expr)}"`));
    });
  };
  for (const e of graph.edges) exprs(e.when, [e.from], `edge ${e.id} (${e.from} -> ${e.to})`);
  for (const end of graph.endings) exprs(end.when, [end.node], `ending ${end.node}`);
  for (const [name, def] of Object.entries(graph.definitions ?? {})) exprs(def, [], `definition "${name}"`);

  out.push(...reachingWriteFindings(graph, topo, declared));
  return out;
}

/**
 * VAR_NO_REACHING_WRITE — definite assignment. For each variable with no initial value (or that
 * `requiresWrite`), walk forward from the entries over every arc that does NOT write it; a read met
 * on that walk has a path with no write before it, and the path is the witness. `external`
 * variables are skipped (§3: another system owns them).
 */
function reachingWriteFindings(graph: StoryGraph, topo: StoryTopology, declared: Map<string, StoryVariable>): StoryFinding[] {
  const tracked = [...declared.values()].filter(
    (v) => !v.external && (v.initial === null || v.initial === undefined || v.requiresWrite === true),
  );
  if (tracked.length === 0) return [];
  const sites = new Map<string, Set<string>>();
  const addSite = (name: string, node: string) => sites.set(name, (sites.get(name) ?? new Set<string>()).add(node));
  for (const e of graph.edges) for (const name of readVars(e.when, graph.definitions)) addSite(name, e.from);
  for (const end of graph.endings) for (const name of readVars(end.when, graph.definitions)) addSite(name, end.node);

  const out: StoryFinding[] = [];
  for (const v of tracked) {
    const at = sites.get(v.name);
    if (!at) continue;
    const tree = bfsTree(topo.roots, topo.arcsFrom, (a) => !(a.edge?.writes ?? []).some((w) => w.var === v.name));
    for (const node of [...at].sort()) {
      // A guard on a container's own edge is read at its exit.
      const at2 = tree.has(node) ? node : tree.has(exitId(node)) ? exitId(node) : null;
      if (at2 === null) continue;
      const path = pathTo(tree, at2);
      out.push(structural('VAR_NO_REACHING_WRITE', [node], `${v.name} is read at ${node} with no write on the path ${path.join(' -> ')}`, { variables: [v.name], path }));
    }
  }
  return out;
}
