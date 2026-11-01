/**
 * WP1 acceptance 1, 3 and 6: the §11 minimum graph round-trips byte-identically, a `variables`
 * block that cannot be read is refused (never degraded), and an unknown kind is preserved and
 * reported.
 *
 * The minimum graph is read FROM THE STANDARD ITSELF, so a doc edit that breaks it goes red here.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { importStoryGraph, parseStoryGraph } from '@/lib/story/importer';
import { canonicalize, canonicalStoryGraph, contentHashInput, storyContentHash } from '@/lib/story/canonical';
import { storyGraphSchema } from '@/lib/story/schema';

const STANDARD = path.resolve(process.cwd(), 'docs', 'architecture', 'storygraph-standard.md');

function minimumGraphText(): string {
  const doc = fs.readFileSync(STANDARD, 'utf8');
  const at = doc.indexOf('**Minimum viable graph**');
  expect(at, 'the standard no longer carries a "Minimum viable graph" section').toBeGreaterThan(-1);
  const m = /```jsonc\r?\n([\s\S]*?)```/.exec(doc.slice(at));
  expect(m, 'no fenced block after the minimum-graph heading').not.toBeNull();
  return m![1];
}

const minimum = (): Record<string, unknown> => JSON.parse(minimumGraphText()) as Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('§11 minimum viable graph', () => {
  it('parses', () => {
    const r = parseStoryGraph(minimum());
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
  });

  it('round-trips byte-identically through canonical.ts', () => {
    const raw = minimum();
    const r = parseStoryGraph(raw);
    if (!r.ok) throw new Error(r.error);
    const canonicalRaw = canonicalize(raw);
    const canonicalParsed = canonicalStoryGraph(r.data);
    // Nothing lost, nothing added by the parser.
    expect(canonicalParsed).toBe(canonicalRaw);
    // And the canonical text is a fixed point: parse it again, serialise it again, same bytes.
    const again = parseStoryGraph(canonicalParsed);
    if (!again.ok) throw new Error(again.error);
    expect(canonicalStoryGraph(again.data)).toBe(canonicalParsed);
  });

  it('is also accepted as JSON text', () => {
    expect(parseStoryGraph(minimumGraphText()).ok).toBe(true);
    const bad = parseStoryGraph('{ not json');
    expect(bad.ok).toBe(false);
  });

  it('has a contentHash that ignores its own field and is stable across key order', async () => {
    const r = parseStoryGraph(minimum());
    if (!r.ok) throw new Error(r.error);
    const h = await storyContentHash(r.data);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await storyContentHash({ ...r.data, contentHash: h })).toBe(h);
    const reordered = Object.fromEntries(Object.entries(minimum()).reverse());
    const r2 = parseStoryGraph(reordered);
    if (!r2.ok) throw new Error(r2.error);
    expect(contentHashInput(r2.data)).toBe(contentHashInput(r.data));
  });
});

describe('canonicalize', () => {
  it('sorts keys, keeps array order, drops undefined, refuses non-finite numbers', () => {
    expect(canonicalize({ b: 1, a: [3, 1, 2], c: undefined, d: { z: null, y: 'é' } })).toBe(
      '{"a":[3,1,2],"b":1,"d":{"y":"é","z":null}}',
    );
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
    expect(() => canonicalize({ x: Infinity })).toThrow();
  });
});

describe('a variables block that fails to parse is a loud Err, never a partial graph', () => {
  const cases: [string, (v: Record<string, unknown>) => void][] = [
    ['missing domain', (v) => delete v.domain],
    ['unknown type', (v) => (v.type = 'number')],
    ['initial null without requiresWrite', (v) => (v.initial = null)],
    ['initial missing', (v) => delete v.initial],
    ['initial outside the declared values', (v) => (v.initial = 'maybe')],
    ['writers not an array', (v) => (v.writers = 'C1')],
    ['scope outside the closed set', (v) => (v.scope = 'forever')],
    ['external missing', (v) => delete v.external],
  ];
  for (const [label, mutate] of cases) {
    it(label, () => {
      const g = minimum();
      const vars = g.variables as Record<string, unknown>[];
      mutate(vars[0]);
      const r = parseStoryGraph(g);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toMatch(/^variables block failed to parse/);
      expect(r.error).toContain('variables[0]');
      // The result carries no graph at all — there is nothing partial to fall back to.
      expect('data' in r).toBe(false);
    });
  }

  it('refuses a numeric variable without a range, an enum without values, a duplicate name', () => {
    const noRange = minimum();
    (noRange.variables as unknown[]).push({ name: 'rep', type: 'int', domain: {}, initial: 0, writers: [], scope: 'quest', external: false });
    expect(parseStoryGraph(noRange).ok).toBe(false);

    const enumNoValues = minimum();
    (enumNoValues.variables as unknown[]).push({ name: 'mood', type: 'enum', domain: {}, initial: 'x', writers: [], scope: 'quest', external: false });
    expect(parseStoryGraph(enumNoValues).ok).toBe(false);

    const dup = minimum();
    (dup.variables as unknown[]).push(clone((dup.variables as unknown[])[0]));
    const r = parseStoryGraph(dup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('duplicate declaration');
  });

  it('accepts initial:null when requiresWrite:true, and an unconstrained string', () => {
    const g = minimum();
    (g.variables as unknown[]).push(
      { name: 'secret', type: 'bool', domain: { values: [true, false] }, initial: null, requiresWrite: true, writers: ['C1'], scope: 'playthrough', external: false },
      { name: 'playerName', type: 'string', domain: {}, initial: null, requiresWrite: true, writers: [], scope: 'persistent', external: true },
    );
    const r = parseStoryGraph(g);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
  });
});

describe('unknown kinds are preserved and reported, never dropped', () => {
  it('keeps an unknown node, edge and class kind as written and lists every one', () => {
    const g = minimum();
    (g.nodes as Record<string, unknown>[]).push({ id: 'X1', kind: 'storylet-pool', title: 'Future kind' });
    (g.edges as Record<string, unknown>[]).push({ id: 'eX', from: 'C1', to: 'X1', kind: 'echoes' });
    ((g.profile as Record<string, unknown>).nodeClasses as unknown[]).push({ id: 'pool', coreKind: 'pool', label: 'Pool' });
    const r = importStoryGraph(g);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (!r.ok) return;
    const node = r.data.graph.nodes.find((n) => n.id === 'X1');
    expect(node?.kind).toBe('storylet-pool');
    expect(node?.title).toBe('Future kind');
    expect(r.data.graph.edges.find((e) => e.id === 'eX')?.kind).toBe('echoes');
    expect(r.data.graph.nodes).toHaveLength(5);
    expect(r.data.unknownKinds).toEqual([
      { where: 'node', id: 'X1', kind: 'storylet-pool' },
      { where: 'edge', id: 'eX', kind: 'echoes' },
      { where: 'nodeClass', id: 'pool', kind: 'pool' },
    ]);
  });

  it('reports nothing for a document that uses only the core kinds', () => {
    const r = importStoryGraph(minimum());
    expect(r.ok && r.data.unknownKinds).toEqual([]);
  });
});

describe('envelope and grammar', () => {
  it('carries unknown top-level and node fields through for a lossless round-trip', () => {
    const g = minimum();
    g.x_producerKey = { keep: [1, 2] };
    (g.nodes as Record<string, unknown>[])[0].x_line = 42;
    const r = parseStoryGraph(g);
    if (!r.ok) throw new Error(r.error);
    expect(canonicalStoryGraph(r.data)).toBe(canonicalize(g));
  });

  it('refuses a wrong format, an empty entries list, a non-integer revision', () => {
    for (const mutate of [
      (g: Record<string, unknown>) => (g.format = 'pof.storygraph/2'),
      (g: Record<string, unknown>) => (g.entries = []),
      (g: Record<string, unknown>) => (g.revision = 1.5),
      (g: Record<string, unknown>) => delete g.budgets,
    ]) {
      const g = minimum();
      mutate(g);
      expect(parseStoryGraph(g).ok).toBe(false);
    }
  });

  it('reads a missing profile as {} (§11 does not require one)', () => {
    const g = minimum();
    delete g.profile;
    const r = parseStoryGraph(g);
    expect(r.ok && r.data.profile).toEqual({});
  });

  it('accepts every Cond atom the grammar names, and refuses one it does not', () => {
    const when = {
      all: [
        { var: 'tookTheCoin', op: '==', value: true },
        { any: [{ flag: 'take' }, { visited: 'C1' }, { not: { axis: { op: '>=', value: 3 } } }] },
        { ref: 'greedy' },
        { chance: 0.5 },
        { expr: 'player.isCursed()' },
        { var: 'tookTheCoin', op: 'in', value: [true] },
      ],
    };
    const g = minimum();
    (g.edges as Record<string, unknown>[])[0].when = when;
    g.definitions = { greedy: { var: 'tookTheCoin', op: '==', value: true } };
    expect(parseStoryGraph(g).ok).toBe(true);

    const bad = minimum();
    (bad.edges as Record<string, unknown>[])[0].when = { var: 'tookTheCoin', op: '~=', value: true };
    expect(parseStoryGraph(bad).ok).toBe(false);
    const inNotArray = minimum();
    (inNotArray.edges as Record<string, unknown>[])[0].when = { var: 'tookTheCoin', op: 'in', value: true };
    expect(parseStoryGraph(inNotArray).ok).toBe(false);
  });

  it('keeps evidence.reach exactly as given: an absent node stays absent, never 0', () => {
    const g = minimum();
    g.evidence = {
      runs: [{ runId: 'r1', engine: 'pof-sampler/1', n: 10, graphHash: null, cohorts: ['all'] }],
      reach: { E1: { all: 50 } },
    };
    const r = storyGraphSchema.safeParse(g);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.evidence?.reach).toEqual({ E1: { all: 50 } });
    expect(r.data.evidence?.reach.E2).toBeUndefined();
    expect(r.data.evidence?.runs[0].graphHash).toBeNull();
  });
});
