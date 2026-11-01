/**
 * Storygraph fixtures: a deterministic generator for any size, and the names of the staged
 * documents.
 *
 * `generateStoryGraph({ nodes: N })` emits a `pof.storygraph/1` graph of EXACTLY N nodes, seeded
 * (mulberry32), so the same `(nodes, seed)` yields byte-identical output. It is built to be
 * structurally CLEAN — every node reachable from the entry and co-reachable to a declared ending,
 * every choice a real choice (distinct writes per option), every gate guarded, every write by a
 * declared writer and inside its domain, every text inside its class budget, containment declared
 * both ways (`parent` + a `contains` edge). That makes it the no-false-positive baseline at any
 * scale; the seeded-defect case is the staged `synthetic-scale` document, not this.
 *
 * Its prose is filler and is not writing.
 *
 * The three STAGED documents are not duplicated here: they are real contest data (one is 8 MB),
 * read from disk by the tests (`STAGED_STORY_FIXTURES` names them and pins their measured size).
 */

import type { StoryEdge, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';

/* ------------------------------------------------------------ staged documents */

export interface StagedStoryFixture {
  name: 'synthetic-scale' | 'mage-arena-season' | 'pof-exemplars';
  nodes: number;
  edges: number;
  /** `pof-exemplars` declares no `profile.axis`; ordering there is topological. */
  hasAxis: boolean;
  what: string;
}

export const STAGED_STORY_FIXTURES: readonly StagedStoryFixture[] = [
  { name: 'synthetic-scale', nodes: 10739, edges: 24202, hasAxis: true, what: 'generated scale case with 27 seeded defects' },
  { name: 'mage-arena-season', nodes: 36, edges: 70, hasAxis: true, what: 'a 42-day season, transcribed (reach provisional)' },
  { name: 'pof-exemplars', nodes: 20, edges: 37, hasAxis: false, what: 'a quest and a conversation; no axis' },
];

/* -------------------------------------------------------------------- generator */

/** The seeded PRNG every PoF story package shares, so a seed means the same thing everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  nodes: number;
  seed?: number;
  project?: string;
  graphId?: string;
}

const WORDS = ['ash', 'road', 'oath', 'iron', 'water', 'bread', 'stone', 'watch', 'trial', 'coin', 'lantern', 'gate'];
const TRUST_VARS = 3;
const MOODS = ['cold', 'warm', 'sworn'] as const;
const BUDGET = { start: 40, beat: 40, decision: 25, conversation: 40, line: 25, branch: 20, finale: 40 } as const;

export function generateStoryGraph(opts: GenerateOptions): StoryGraph {
  const N = opts.nodes;
  if (!Number.isInteger(N) || N < 1) throw new RangeError(`generateStoryGraph: nodes must be an integer >= 1, got ${N}`);
  const seed = opts.seed ?? 1;
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const prose = (lo: number, hi: number) => Array.from({ length: int(lo, hi) }, () => WORDS[int(0, WORDS.length - 1)]).join(' ');

  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const writers = new Map<string, string[]>();
  let block = 0;
  const edge = (e: Omit<StoryEdge, 'id'>) => edges.push({ id: `e${edges.length}`, ...e });
  const link = (tails: string[], head: string) => tails.forEach((from) => edge({ from, to: head, kind: 'then' }));
  const node = (n: StoryNode) => nodes.push(n);
  const wrote = (v: string, by: string) => writers.set(v, [...(writers.get(v) ?? []), by]);

  const endings: string[] = [];
  if (N === 1) {
    node({ id: 'E.1', kind: 'ending', class: 'finale', title: 'The end', axis: 0, lanes: ['ending'] });
    endings.push('E.1');
  } else {
    node({ id: 'START', kind: 'entry', class: 'start', title: 'The road in', axis: 0, lanes: ['main'], text: prose(4, 20) });
    let tails = ['START'];
    if (N === 2 || N === 3) {
      if (N === 3) {
        node({ id: 'B0', kind: 'event', class: 'beat', title: 'Beat 0', axis: 1, lanes: ['main'], text: prose(4, 30) });
        link(tails, 'B0');
        tails = ['B0'];
      }
      node({ id: 'E.1', kind: 'ending', class: 'finale', title: 'The end', axis: N - 1, lanes: ['ending'] });
      link(tails, 'E.1');
      endings.push('E.1');
    } else {
      let r = N - 4;
      while (r > 0) {
        block += 1;
        const roll = rnd();
        const base = { axis: block, lanes: ['main'] };
        if (r >= 3 && roll < 0.35) {
          const x = `B${block}`;
          node({ id: x, kind: 'choice', class: 'decision', title: `Decision ${block}`, ...base, options: [{ id: 'a' }, { id: 'b' }] });
          link(tails, x);
          const useMood = block % 4 === 0;
          const v = useMood ? 'mood' : `trust.${int(0, TRUST_VARS - 1)}`;
          const [va, vb] = useMood
            ? (() => { const i = int(0, 2); return [MOODS[i], MOODS[(i + 1) % 3]]; })()
            : [int(1, 100), -int(1, 100)];
          for (const [opt, value] of [['a', va], ['b', vb]] as const) {
            const to = `${x}.${opt}`;
            node({ id: to, kind: 'event', class: 'beat', title: `Outcome ${block}${opt}`, ...base, text: prose(4, 30) });
            edge({ from: x, to, kind: 'option', optionId: opt, writes: [{ var: v, op: 'set', value }] });
          }
          wrote(v, x);
          tails = [`${x}.a`, `${x}.b`];
          r -= 3;
        } else if (r >= 3 && roll < 0.6) {
          const c = `C${block}`;
          const lines = Math.min(r - 1, int(3, 8));
          node({ id: c, kind: 'container', class: 'conversation', title: `Conversation ${block}`, ...base });
          link(tails, c);
          let prev = c;
          for (let j = 1; j <= lines; j += 1) {
            const l = `${c}.l${j}`;
            node({ id: l, kind: 'event', class: 'line', title: `Line ${j}`, ...base, parent: c, text: prose(3, 20) });
            edge({ from: c, to: l, kind: 'contains' });
            edge({ from: prev, to: l, kind: 'then' });
            prev = l;
          }
          tails = [prev];
          r -= lines + 1;
        } else {
          const b = `B${block}`;
          node({ id: b, kind: 'event', class: 'beat', title: `Beat ${block}`, ...base, text: prose(4, 30) });
          link(tails, b);
          tails = [b];
          r -= 1;
        }
      }
      const end = { axis: block + 1 };
      node({ id: 'G', kind: 'gate', class: 'branch', title: 'The reckoning', ...end, lanes: ['main'] });
      link(tails, 'G');
      for (const [eid, op, title] of [['E.1', '>=', 'Trusted'], ['E.2', '<', 'Alone']] as const) {
        node({ id: eid, kind: 'ending', class: 'finale', title, ...end, lanes: ['ending'] });
        edge({ from: 'G', to: eid, kind: 'gate', when: { var: 'trust.0', op, value: 0 } });
        endings.push(eid);
      }
    }
  }

  const variables: StoryVariable[] = [];
  const declare = (name: string, v: Omit<StoryVariable, 'name' | 'writers' | 'scope' | 'external'>) =>
    variables.push({ name, ...v, writers: writers.get(name) ?? [], scope: 'playthrough', external: false });
  if (N >= 4) {
    for (let i = 0; i < TRUST_VARS; i += 1) {
      const name = `trust.${i}`;
      if (i === 0 || writers.has(name)) {
        declare(name, { type: 'int', domain: { min: -100, max: 100 }, initial: 0, requiresWrite: false, doc: `Trust ${i}.` });
      }
    }
    if (writers.has('mood')) {
      declare('mood', { type: 'enum', domain: { values: [...MOODS] }, initial: 'cold', requiresWrite: false, doc: 'Mood.' });
    }
  }

  return {
    format: 'pof.storygraph/1',
    project: opts.project ?? 'pof-fixtures',
    graphId: opts.graphId ?? `generated-${N}`,
    revision: 1,
    producer: { tool: 'pof/story/fixtures', version: '1', generatedAt: '2026-11-01T00:00:00.000Z' },
    source: { generator: 'generateStoryGraph', seed, nodes: N, note: 'Generated filler: topology only, prose is not writing.' },
    profile: {
      axis: { name: 'block', unit: 'block ordinal', min: 0, max: N >= 4 ? block + 1 : N - 1 },
      lanes: [{ id: 'main', label: 'Main' }, { id: 'ending', label: 'Endings' }],
      nodeClasses: [
        { id: 'start', coreKind: 'entry', label: 'Start' },
        { id: 'beat', coreKind: 'event', label: 'Beat' },
        { id: 'decision', coreKind: 'choice', label: 'Decision' },
        { id: 'conversation', coreKind: 'container', label: 'Conversation' },
        { id: 'line', coreKind: 'event', label: 'Line' },
        { id: 'branch', coreKind: 'gate', label: 'Branch' },
        { id: 'finale', coreKind: 'ending', label: 'Finale' },
      ],
      languages: ['en'],
    },
    variables,
    entries: [nodes[0].id],
    nodes,
    edges,
    endings: endings.map((n) => ({ node: n })),
    budgets: { unit: 'words', basis: 'per node, per language', perClass: { ...BUDGET } },
  };
}
