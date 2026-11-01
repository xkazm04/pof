/**
 * Wave 4 (the section-12 amendment pass): the six structural codes for MUSTs that had none, each
 * with a positive case, a clean or honest near-miss negative, the node(s) it names and its
 * severity; plus `mode: 'all'` leaving structural reachability unchanged. Self-contained.
 */
import { describe, it, expect } from 'vitest';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { validateStoryGraph } from '@/lib/story/validate';
import type { StoryEdge, StoryEnding, StoryFinding, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';

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
const brief = (f: StoryFinding) => `${f.code}/${f.severity}:${f.nodes.join(',')}`;
const run = (g: StoryGraph) => validateStoryGraph(g).map(brief);
const flag: StoryVariable = { name: 'f', type: 'bool', domain: { values: [true, false] }, initial: false, writers: [], scope: 'playthrough', external: false };

describe('CHOICE_TOO_FEW_OPTIONS (§4: a choice needs >= 2 options)', () => {
  const choice = (options: StoryNode['options'], edges: Omit<StoryEdge, 'id'>[]) =>
    tiny([{ id: 'CH', kind: 'choice', options }], [{ from: 'START', to: 'CH', kind: 'then' }, ...edges]);

  it('one option edge and one declared option: error, naming the choice', () => {
    const f = validateStoryGraph(choice([{ id: 'go' }], [{ from: 'CH', to: 'END', kind: 'option', optionId: 'go' }]));
    expect(f.map(brief)).toEqual(['CHOICE_TOO_FEW_OPTIONS/error:CH']);
    expect(f[0].detail).toContain('one option (go)');
  });

  it('two edges carrying the SAME optionId are still one option', () => {
    expect(run(choice(undefined, [
      { from: 'CH', to: 'END', kind: 'option', optionId: 'go' },
      { from: 'CH', to: 'END', kind: 'option', optionId: 'go', label: 'again' },
    ]))).toEqual(['CHOICE_TOO_FEW_OPTIONS/error:CH']);
  });

  it('a `then` edge out of a choice is not an option', () => {
    expect(run(choice(undefined, [{ from: 'CH', to: 'END', kind: 'then' }]))).toEqual(['CHOICE_TOO_FEW_OPTIONS/error:CH']);
  });

  it('near-miss: two distinct options landing on the same node (different writes) pass', () => {
    const g = choice([{ id: 'a' }, { id: 'b' }], [
      { from: 'CH', to: 'END', kind: 'option', optionId: 'a', writes: [{ var: 'f', op: 'set', value: true }] },
      { from: 'CH', to: 'END', kind: 'option', optionId: 'b', writes: [{ var: 'f', op: 'set', value: false }] },
    ]);
    expect(run({ ...g, variables: [{ ...flag, writers: ['CH'] }] })).toEqual([]);
  });

  it('two distinct optionIds count even with no declared options list', () => {
    const g = choice(undefined, [
      { from: 'CH', to: 'END', kind: 'option', optionId: 'a', writes: [{ var: 'f', op: 'set', value: true }] },
      { from: 'CH', to: 'END', kind: 'option', optionId: 'b', writes: [{ var: 'f', op: 'set', value: false }] },
    ]);
    expect(run({ ...g, variables: [{ ...flag, writers: ['CH'] }] })).toEqual([]);
  });
});

describe('GATE_WITHOUT_CONDITION (§4, §5: gate edges and edges out of a gate carry `when`)', () => {
  const when = { visited: 'START' };
  const gate = (edges: Omit<StoryEdge, 'id'>[]) => tiny([{ id: 'G', kind: 'gate' }], [{ from: 'START', to: 'G', kind: 'then' }, ...edges]);

  it('a single unguarded fall-through out of a gate node is still a violation (no exception)', () => {
    const f = validateStoryGraph(gate([{ from: 'G', to: 'END', kind: 'gate', when }, { from: 'G', to: 'END', kind: 'then' }]));
    expect(f.map(brief)).toEqual(['GATE_WITHOUT_CONDITION/error:G']);
    expect(f[0].detail).toContain('then edge e2 out of gate node G');
  });

  it('a `gate` edge with no `when` is flagged wherever it starts, once per edge', () => {
    const g = tiny([{ id: 'A', kind: 'event' }], [
      { from: 'START', to: 'A', kind: 'gate' },
      { from: 'START', to: 'A', kind: 'gate' },
      { from: 'A', to: 'END', kind: 'then' },
    ]);
    expect(run(g)).toEqual(['GATE_WITHOUT_CONDITION/error:START', 'GATE_WITHOUT_CONDITION/error:START']);
  });

  it('near-miss: every edge guarded; a `contains` edge out of a gate is not a branch', () => {
    const g = gate([
      { from: 'G', to: 'END', kind: 'gate', when },
      { from: 'G', to: 'END', kind: 'gate', when: { not: when } },
      { from: 'G', to: 'K', kind: 'contains' },
    ]);
    expect(run({ ...g, nodes: [...g.nodes, { id: 'K', kind: 'event', parent: 'G' }] })).toEqual([]);
  });
});

describe('UNKNOWN_KIND (§4: render it as a labelled generic node AND report it)', () => {
  it('reports node and edge kinds as info, each saying how the walks treat it', () => {
    const g = tiny([{ id: 'V', kind: 'vignette' as StoryNode['kind'] }], [
      { from: 'START', to: 'V', kind: 'then' },
      { from: 'V', to: 'END', kind: 'then' },
      { from: 'V', to: 'END', kind: 'echoes' as StoryEdge['kind'] },
    ]);
    const f = validateStoryGraph(g);
    expect(f.map(brief)).toEqual(['UNKNOWN_KIND/info:V,END', 'UNKNOWN_KIND/info:V']);
    expect(f[0].detail).toMatch(/^edge e2 .*"echoes".*NOT walked/);
    expect(f[1].detail).toMatch(/^node V .*"vignette".*walked as an ordinary node/);
  });

  it('near-miss: all seven node kinds and five edge kinds are known', () => {
    expect(validateStoryGraph(generateStoryGraph({ nodes: 400, seed: 2 }))).toEqual([]);
  });
});

describe('PARENT_CONTAINS_MISMATCH (§5: contains mirrors node.parent; both must agree)', () => {
  const boxes = (kid: Partial<StoryNode>, contains: Omit<StoryEdge, 'id'>[]) =>
    tiny([{ id: 'A', kind: 'container' }, { id: 'B', kind: 'container' }, { id: 'K', kind: 'event', ...kid }], [
      { from: 'START', to: 'A', kind: 'then' },
      { from: 'A', to: 'B', kind: 'then' },
      { from: 'B', to: 'END', kind: 'then' },
      ...contains,
    ]);

  it('parent: A but a contains edge from B: error naming child and both parents', () => {
    const f = validateStoryGraph(boxes({ parent: 'A' }, [{ from: 'B', to: 'K', kind: 'contains' }]));
    expect(f.map(brief)).toEqual(['PARENT_CONTAINS_MISMATCH/error:K,A,B']);
  });

  it('no parent declared but contains edges from two parents', () => {
    const f = validateStoryGraph(boxes({}, [{ from: 'A', to: 'K', kind: 'contains' }, { from: 'B', to: 'K', kind: 'contains' }]));
    expect(f.map((x) => x.code)).toEqual(['PARENT_CONTAINS_MISMATCH']);
    expect(f[0].nodes).toEqual(['K', 'A', 'B']);
  });

  it('near-miss: both forms agreeing, or only one form, is fine', () => {
    expect(run(boxes({ parent: 'A' }, [{ from: 'A', to: 'K', kind: 'contains' }]))).toEqual([]);
    expect(run(boxes({ parent: 'A' }, []))).toEqual([]);
    expect(run(boxes({}, [{ from: 'B', to: 'K', kind: 'contains' }]))).toEqual([]);
  });
});

describe('STRING_VAR_NO_VALUES (§3: a free-form string is reported as info)', () => {
  const str = (domain: StoryVariable['domain']): StoryVariable => ({ name: 'callsign', type: 'string', domain, initial: 'x', writers: [], scope: 'playthrough', external: false });
  const g = (vars: StoryVariable[]) => tiny([], [{ from: 'START', to: 'END', kind: 'then' }], { variables: vars });

  it('one info finding per variable, naming it', () => {
    const f = validateStoryGraph(g([str({})]));
    expect(f.map(brief)).toEqual(['STRING_VAR_NO_VALUES/info:']);
    expect(f[0].variables).toEqual(['callsign']);
  });

  it('a duplicated declaration is DUPLICATE_ID once plus ONE string finding, not two', () => {
    expect(validateStoryGraph(g([str({}), str({})])).map((f) => f.code)).toEqual(['DUPLICATE_ID', 'STRING_VAR_NO_VALUES']);
  });

  it('near-miss: a string with values, or a non-string without values, is silent', () => {
    expect(run(g([str({ values: ['x', 'y'] })]))).toEqual([]);
    expect(run(g([{ ...str({ min: 0, max: 3 }), type: 'int', initial: 0 }]))).toEqual([]);
  });
});

describe('PRECEDENCE_NOT_TOTAL (§6: where present, a total order; lower wins)', () => {
  const ends = (endings: StoryEnding[]) =>
    tiny([{ id: 'E2', kind: 'ending' }, { id: 'E3', kind: 'ending' }], [
      { from: 'START', to: 'END', kind: 'then' },
      { from: 'START', to: 'E2', kind: 'then' },
      { from: 'START', to: 'E3', kind: 'then' },
    ], { endings });

  it('a tie is error, naming the tied endings', () => {
    expect(run(ends([{ node: 'END', precedence: 1 }, { node: 'E2', precedence: 1 }, { node: 'E3', precedence: 2 }]))).toEqual(['PRECEDENCE_NOT_TOTAL/error:E2,END']);
  });

  it('a partial declaration is warn, naming the endings that declare none', () => {
    expect(run(ends([{ node: 'END', precedence: 1 }, { node: 'E2' }, { node: 'E3' }]))).toEqual(['PRECEDENCE_NOT_TOTAL/warn:E2,E3']);
  });

  it('near-miss: distinct values (any order, gaps allowed), or none at all, are silent', () => {
    expect(run(ends([{ node: 'END', precedence: 10 }, { node: 'E2', precedence: -1 }, { node: 'E3', precedence: 3 }]))).toEqual([]);
    expect(run(ends([{ node: 'END' }, { node: 'E2' }, { node: 'E3' }]))).toEqual([]);
  });
});

describe("`mode: 'all'` does not change structural reachability", () => {
  it('the same graph with and without mode yields identical findings', () => {
    const base = tiny(
      [{ id: 'HUB', kind: 'event' }, { id: 'T1', kind: 'event' }, { id: 'T2', kind: 'event' }, { id: 'T3', kind: 'event' }, { id: 'DEAD', kind: 'event' }],
      [
        { from: 'START', to: 'HUB', kind: 'then' },
        { from: 'HUB', to: 'T1', kind: 'then' },
        { from: 'HUB', to: 'T2', kind: 'then' },
        { from: 'HUB', to: 'T3', kind: 'then' },
        { from: 'T1', to: 'END', kind: 'then' },
        { from: 'T2', to: 'END', kind: 'then' },
        { from: 'DEAD', to: 'END', kind: 'then' },
      ],
    );
    const all = { ...base, edges: base.edges.map((e) => (e.from === 'HUB' ? { ...e, mode: 'all' as const } : e)) };
    const any = { ...base, edges: base.edges.map((e) => (e.from === 'HUB' ? { ...e, mode: 'any' as const } : e)) };
    const without = validateStoryGraph(base);
    // T3 is an undeclared terminal and DEAD an orphan either way: the mode is not a structural fact.
    expect(without.map(brief)).toEqual(['ORPHAN_NODE/warn:DEAD', 'UNDECLARED_TERMINAL/warn:T3']);
    expect(validateStoryGraph(all)).toEqual(without);
    expect(validateStoryGraph(any)).toEqual(without);
  });

  it('on a generated 1,000-node graph, marking every multi-then source `all` changes nothing', () => {
    const g = generateStoryGraph({ nodes: 1000, seed: 11 });
    const all = { ...g, edges: g.edges.map((e) => (e.kind === 'then' ? { ...e, mode: 'all' as const } : e)) };
    expect(validateStoryGraph(all)).toEqual(validateStoryGraph(g));
  });
});
