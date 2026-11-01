/**
 * WP1 acceptance 2 and 4: the staged documents parse, and `generateStoryGraph` emits exactly N
 * nodes for any N, deterministically, with a 10k emit under 5 s (measured and printed).
 *
 * The staged documents are gitignored contest data; they are read through the Orrery suite's own
 * loader (`./orrery/_fixtures`) from whichever staging directory holds them, and the block SKIPS
 * LOUDLY when none does — a missing input is not a passing gate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ARENA_DATA_DIR, readGraph } from './orrery/_fixtures';
import { importStoryGraph } from '@/lib/story/importer';
import { canonicalStoryGraph } from '@/lib/story/canonical';
import { STAGED_STORY_FIXTURES, generateStoryGraph } from '@/lib/story/fixtures';
import type { StoryGraph } from '@/lib/story/types';

const CANDIDATE_DIRS = [
  ARENA_DATA_DIR,
  path.resolve(process.cwd(), 'public', 'orrery-fixtures'),
  path.resolve(process.cwd(), '.contest', 'staging', 'storymap', 'data'),
];
const STAGED_DIR = CANDIDATE_DIRS.find((d) =>
  STAGED_STORY_FIXTURES.every((f) => fs.existsSync(path.join(d, `${f.name}.json`))),
);
if (!STAGED_DIR) {
  console.error(`[storygraph] staged documents not found in any of ${CANDIDATE_DIRS.join(' | ')} — staged-parse acceptance SKIPPED, not passing.`);
}

const NON_TRAVERSAL = new Set(['contains', 'influences']);

describe.skipIf(!STAGED_DIR)('the three staged documents parse', () => {
  for (const f of STAGED_STORY_FIXTURES) {
    it(`${f.name}: parses, keeps its size, reports no unknown kind`, () => {
      const raw = readGraph(path.join(STAGED_DIR!, `${f.name}.json`));
      const r = importStoryGraph(raw);
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      if (!r.ok) return;
      const g = r.data.graph;
      expect(g.nodes).toHaveLength(f.nodes);
      expect(g.edges).toHaveLength(f.edges);
      expect(g.profile.axis !== undefined).toBe(f.hasAxis);
      expect(r.data.unknownKinds).toEqual([]);
      // Lossless: the parsed graph serialises to the same canonical bytes as the raw document.
      expect(canonicalStoryGraph(g)).toBe(canonicalStoryGraph(raw));
    });
  }

  it('synthetic-scale carries the figures the design brief quotes, measured from the document', () => {
    const r = importStoryGraph(readGraph(path.join(STAGED_DIR!, 'synthetic-scale.json')));
    if (!r.ok) throw new Error(r.error);
    const g = r.data.graph;
    const traversal = g.edges.filter((e) => !NON_TRAVERSAL.has(e.kind)).length;
    expect(traversal).toBe(13369);
    expect(g.nodes.filter((n) => n.kind === 'container').length).toBe(489);
    // The 27 seeded defects are WP2's answer key (`seeded-defects.json`, beside the document in
    // the arena only); this package deliberately does not read it.
  });
});

/* ------------------------------------------------------------------ generator */

/** A small independent structural audit: proves the generated graph is a clean baseline. */
function auditClean(g: StoryGraph): string[] {
  const problems: string[] = [];
  const ids = new Set(g.nodes.map((n) => n.id));
  if (ids.size !== g.nodes.length) problems.push('duplicate node id');
  if (new Set(g.edges.map((e) => e.id)).size !== g.edges.length) problems.push('duplicate edge id');
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) problems.push(`dangling ${e.id}`);
    if (NON_TRAVERSAL.has(e.kind)) continue;
    out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
    inn.set(e.to, [...(inn.get(e.to) ?? []), e.from]);
  }
  const walk = (roots: string[], adj: Map<string, string[]>) => {
    const seen = new Set(roots);
    const stack = [...roots];
    while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    return seen;
  };
  const endingIds = g.endings.map((e) => e.node);
  const fwd = walk([...g.entries], out);
  const back = walk(endingIds, inn);
  for (const n of g.nodes) {
    if (!fwd.has(n.id)) problems.push(`orphan ${n.id}`);
    if (!back.has(n.id)) problems.push(`no ending reachable from ${n.id}`);
    if (!endingIds.includes(n.id) && !(out.get(n.id)?.length)) problems.push(`undeclared terminal ${n.id}`);
    const budget = g.budgets.perClass[n.class ?? ''];
    if (n.text && budget !== undefined && n.text.split(/\s+/).length > budget) problems.push(`over budget ${n.id}`);
    if (n.parent && !g.edges.some((e) => e.kind === 'contains' && e.from === n.parent && e.to === n.id)) problems.push(`parent without contains ${n.id}`);
    if (n.kind === 'choice') {
      const opts = g.edges.filter((e) => e.from === n.id && e.kind === 'option');
      if ((n.options?.length ?? 0) < 2 || opts.length < 2) problems.push(`thin choice ${n.id}`);
      const sigs = opts.map((e) => JSON.stringify([e.to, e.writes ?? []]));
      if (new Set(sigs).size !== sigs.length) problems.push(`false choice ${n.id}`);
    }
  }
  const vars = new Map(g.variables.map((v) => [v.name, v]));
  for (const e of g.edges) {
    if (e.kind === 'gate' && !e.when) problems.push(`unguarded gate ${e.id}`);
    for (const w of e.writes ?? []) {
      const v = vars.get(w.var);
      if (!v) { problems.push(`undeclared ${w.var}`); continue; }
      if (!v.writers.includes(e.from)) problems.push(`writer not owner ${e.from} -> ${w.var}`);
      if (typeof w.value === 'number' && (w.value < (v.domain.min ?? -Infinity) || w.value > (v.domain.max ?? Infinity))) problems.push(`domain ${e.id}`);
      if (v.domain.values && !v.domain.values.includes(w.value)) problems.push(`domain ${e.id}`);
    }
  }
  return problems;
}

describe('generateStoryGraph', () => {
  const sizes = [1, 2, 3, 4, 5, 6, 7, 10, 33, 100, 997, 2500];

  for (const n of sizes) {
    it(`emits exactly ${n} node(s), parses, and is structurally clean`, () => {
      const g = generateStoryGraph({ nodes: n, seed: 7 });
      expect(g.nodes).toHaveLength(n);
      const r = importStoryGraph(g);
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      expect(auditClean(g)).toEqual([]);
    });
  }

  it('emits exactly N nodes for every N from 1 to 300', () => {
    for (let n = 1; n <= 300; n += 1) expect(generateStoryGraph({ nodes: n, seed: n }).nodes.length).toBe(n);
  });

  it('is deterministic: the same (nodes, seed) is byte-identical, a different seed differs', () => {
    const a = canonicalStoryGraph(generateStoryGraph({ nodes: 800, seed: 42 }));
    const b = canonicalStoryGraph(generateStoryGraph({ nodes: 800, seed: 42 }));
    const c = canonicalStoryGraph(generateStoryGraph({ nodes: 800, seed: 43 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('refuses a size that is not a positive integer', () => {
    expect(() => generateStoryGraph({ nodes: 0 })).toThrow(RangeError);
    expect(() => generateStoryGraph({ nodes: 2.5 })).toThrow(RangeError);
  });

  it('emits 10,000 nodes in under 5 s (measured)', () => {
    const t0 = performance.now();
    const g = generateStoryGraph({ nodes: 10_000, seed: 1 });
    const ms = performance.now() - t0;
    console.error(`[storygraph] generateStoryGraph(10,000 nodes, ${g.edges.length} edges) took ${ms.toFixed(1)} ms`);
    expect(g.nodes).toHaveLength(10_000);
    expect(ms).toBeLessThan(5000);
    const r = importStoryGraph(g);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(auditClean(g)).toEqual([]);
  });
});
