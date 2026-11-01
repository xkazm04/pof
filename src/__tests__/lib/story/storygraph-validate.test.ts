/**
 * WP2 — the structural validator suite, committed and self-contained (no gitignored input).
 * Acceptance 2 (clean baseline at 100 / 1,000 / 10,000 + every structural code seeded and found
 * EXACTLY), 3 (VAR_NO_REACHING_WRITE join fixture reports the path), 4 (UNDECLARED_TERMINAL is a
 * set difference; FALSE_CHOICE spares honest convergence) and 6 (altitude + no lead).
 */
import { describe, it, expect } from 'vitest';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { seedStructuralDefects, type SeededDefect } from '@/lib/story/defect-fixtures';
import { STRUCTURAL_CODES, validateStoryGraph } from '@/lib/story/validate';
import type { StoryEdge, StoryFinding, StoryGraph, StoryNode } from '@/lib/story/types';

const key = (f: Pick<StoryFinding, 'code' | 'nodes' | 'variables'> | SeededDefect) =>
  `${f.code}|${[...f.nodes].sort().join(',')}|${[...(f.variables ?? [])].sort().join(',')}`;

/** A tiny hand-built graph: entry START, declared ending END, and whatever the test adds. */
function tiny(nodes: StoryNode[], edges: Omit<StoryEdge, 'id'>[], extra: Partial<StoryGraph> = {}): StoryGraph {
  return {
    format: 'pof.storygraph/1',
    project: 't',
    graphId: 'tiny',
    revision: 1,
    profile: {},
    variables: [],
    entries: ['START'],
    nodes: [{ id: 'START', kind: 'entry' }, { id: 'END', kind: 'ending' }, ...nodes],
    edges: edges.map((e, i) => ({ id: `e${i}`, ...e })),
    endings: [{ node: 'END' }],
    budgets: { unit: 'words', basis: 'per node', perClass: {} },
    ...extra,
  };
}

describe('the structural pass on a clean generated graph', () => {
  for (const n of [100, 1000, 10000]) {
    it(`yields zero findings at N = ${n}`, () => {
      const g = generateStoryGraph({ nodes: n, seed: 7 });
      expect(g.nodes).toHaveLength(n);
      expect(validateStoryGraph(g)).toEqual([]);
    });
  }
});

describe('seedStructuralDefects: every structural code planted, each found exactly', () => {
  for (const n of [100, 1000, 10000]) {
    it(`N = ${n}: findings == manifest, no extras, no misses`, () => {
      const { graph, defects } = seedStructuralDefects(generateStoryGraph({ nodes: n, seed: 3 }), n);
      expect(new Set(defects.map((d) => d.code))).toEqual(new Set(STRUCTURAL_CODES));
      const findings = validateStoryGraph(graph);
      expect(findings.map(key).sort()).toEqual(defects.map(key).sort());
    });
  }

  it('the clean input is not mutated', () => {
    const clean = generateStoryGraph({ nodes: 50 });
    const before = JSON.stringify(clean);
    seedStructuralDefects(clean, 1);
    expect(JSON.stringify(clean)).toBe(before);
  });

  it('every finding is structural and carries no lead (acceptance 6)', () => {
    const { graph } = seedStructuralDefects(generateStoryGraph({ nodes: 200 }), 2);
    const findings = validateStoryGraph(graph);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.altitude).toBe('structural');
      expect('lead' in f).toBe(false);
      expect(STRUCTURAL_CODES).toContain(f.code);
    }
  });
});

describe('VAR_NO_REACHING_WRITE — definite assignment at a join (acceptance 3)', () => {
  const verdict = { name: 'verdict', type: 'enum' as const, domain: { values: ['guilty', 'free'] }, initial: null, requiresWrite: true, writers: ['W'], scope: 'playthrough' as const, external: false };
  const join = (skipWrites: boolean) =>
    tiny(
      [{ id: 'W', kind: 'event' }, { id: 'SKIP', kind: 'event' }, { id: 'J', kind: 'gate' }],
      [
        { from: 'START', to: 'W', kind: 'then' },
        { from: 'START', to: 'SKIP', kind: 'then' },
        { from: 'W', to: 'J', kind: 'then', writes: [{ var: 'verdict', op: 'set', value: 'guilty' }] },
        { from: 'SKIP', to: 'J', kind: 'then', ...(skipWrites ? { writes: [{ var: 'verdict', op: 'set', value: 'free' }] } : {}) },
        { from: 'J', to: 'END', kind: 'gate', when: { var: 'verdict', op: '==', value: 'guilty' } },
        { from: 'J', to: 'END', kind: 'gate', when: { var: 'verdict', op: '!=', value: 'guilty' } },
      ],
      { variables: [{ ...verdict, writers: skipWrites ? ['W', 'SKIP'] : ['W'] }] },
    );

  it('one predecessor writes, the other does not: the read is flagged WITH the unwritten path', () => {
    const f = validateStoryGraph(join(false));
    expect(f.map((x) => x.code)).toEqual(['VAR_NO_REACHING_WRITE']);
    expect(f[0].nodes).toEqual(['J']);
    expect(f[0].variables).toEqual(['verdict']);
    expect(f[0].path).toEqual(['START', 'SKIP', 'J']);
    expect(f[0].detail).toContain('START -> SKIP -> J');
  });

  it('both predecessors write: no finding', () => {
    expect(validateStoryGraph(join(true))).toEqual([]);
  });

  it('an external variable is skipped (§3)', () => {
    const g = join(false);
    (g.variables[0] as { external: boolean }).external = true;
    expect(validateStoryGraph(g)).toEqual([]);
  });
});

describe('UNDECLARED_TERMINAL is a set difference against endings[] (acceptance 4)', () => {
  const g = tiny(
    [{ id: 'A', kind: 'event' }, { id: 'B', kind: 'event' }],
    [
      { from: 'START', to: 'A', kind: 'then' },
      { from: 'START', to: 'B', kind: 'then' },
      { from: 'START', to: 'END', kind: 'then' },
    ],
  );
  it('both dead ends are reported, END (declared) is not', () => {
    const f = validateStoryGraph(g).filter((x) => x.code === 'UNDECLARED_TERMINAL');
    expect(f.map((x) => x.nodes[0]).sort()).toEqual(['A', 'B']);
  });
  it('declaring one of them removes exactly that one', () => {
    const f = validateStoryGraph({ ...g, endings: [...g.endings, { node: 'A' }] }).filter((x) => x.code === 'UNDECLARED_TERMINAL');
    expect(f.map((x) => x.nodes[0])).toEqual(['B']);
  });
  it('a terminal is not double-reported as NO_ENDING_REACHABLE (one code per dead node)', () => {
    expect(validateStoryGraph(g).map((x) => x.code)).toEqual(['UNDECLARED_TERMINAL', 'UNDECLARED_TERMINAL']);
  });
  it('a node inside a container whose own edge continues is not terminal', () => {
    const c = tiny(
      [{ id: 'C', kind: 'container' }, { id: 'C.l1', kind: 'event', parent: 'C' }],
      [{ from: 'START', to: 'C', kind: 'then' }, { from: 'C', to: 'END', kind: 'then' }],
    );
    expect(validateStoryGraph(c)).toEqual([]);
  });
});

describe('FALSE_CHOICE compares (sorted writes, target) per option (acceptance 4)', () => {
  const choice = (aWrites: StoryEdge['writes'], bWrites: StoryEdge['writes'], bTo = 'END') =>
    tiny(
      [{ id: 'CH', kind: 'choice', options: [{ id: 'a' }, { id: 'b' }] }, { id: 'OTHER', kind: 'event' }],
      [
        { from: 'START', to: 'CH', kind: 'then' },
        { from: 'CH', to: 'END', kind: 'option', optionId: 'a', writes: aWrites },
        { from: 'CH', to: bTo, kind: 'option', optionId: 'b', writes: bWrites },
        { from: 'START', to: 'OTHER', kind: 'then' },
        { from: 'OTHER', to: 'END', kind: 'then' },
      ],
      { variables: [{ name: 'x', type: 'int', domain: { min: 0, max: 9 }, initial: 0, writers: ['CH'], scope: 'playthrough', external: false }, { name: 'y', type: 'int', domain: { min: 0, max: 9 }, initial: 0, writers: ['CH'], scope: 'playthrough', external: false }] },
    );
  const codes = (g: StoryGraph) => validateStoryGraph(g).map((f) => f.code);
  it('identical writes (in any order) and identical target: flagged', () => {
    const w1 = [{ var: 'x', op: 'set' as const, value: 1 }, { var: 'y', op: 'set' as const, value: 2 }];
    expect(codes(choice(w1, [...w1].reverse()))).toEqual(['FALSE_CHOICE']);
  });
  it('honest convergence — different writes, same target: NOT flagged', () => {
    expect(codes(choice([{ var: 'x', op: 'set', value: 1 }, { var: 'y', op: 'set', value: 1 }], [{ var: 'x', op: 'set', value: 2 }, { var: 'y', op: 'set', value: 2 }]))).toEqual([]);
  });
  it('same writes, different target: NOT flagged', () => {
    const w = [{ var: 'x', op: 'set' as const, value: 1 }, { var: 'y', op: 'set' as const, value: 1 }];
    expect(codes(choice(w, w, 'OTHER'))).toEqual([]);
  });
});

describe('robustness and the non-traversal rule', () => {
  it('contains and influences edges are not traversal', () => {
    const g = tiny(
      [{ id: 'X', kind: 'event' }],
      [{ from: 'START', to: 'END', kind: 'then' }, { from: 'START', to: 'X', kind: 'influences' }, { from: 'X', to: 'END', kind: 'then' }],
    );
    expect(validateStoryGraph(g).map((f) => `${f.code}:${f.nodes.join(',')}`)).toEqual(['ORPHAN_NODE:X']);
  });

  it('unknown node and edge kinds do not crash; an unknown edge is not assumed to connect', () => {
    const g = tiny(
      [{ id: 'Q', kind: 'mystery' as StoryNode['kind'] }],
      [{ from: 'START', to: 'END', kind: 'then' }, { from: 'START', to: 'Q', kind: 'teleport' as StoryEdge['kind'] }, { from: 'Q', to: 'END', kind: 'then' }],
    );
    expect(validateStoryGraph(g).map((f) => `${f.code}:${f.nodes.join(',')}`)).toEqual(['ORPHAN_NODE:Q']);
  });

  it('templates are excluded from forward reachability', () => {
    const g = tiny([{ id: 'T', kind: 'template', text: 'a storylet' }], [{ from: 'START', to: 'END', kind: 'then' }]);
    expect(validateStoryGraph(g)).toEqual([]);
  });

  it('is deterministic', () => {
    const { graph } = seedStructuralDefects(generateStoryGraph({ nodes: 300 }), 9);
    expect(JSON.stringify(validateStoryGraph(graph))).toBe(JSON.stringify(validateStoryGraph(graph)));
  });
});
