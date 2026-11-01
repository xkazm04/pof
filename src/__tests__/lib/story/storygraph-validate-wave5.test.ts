/**
 * Wave 5 (section-12 amendment package A): INFLUENCES_UNSUPPORTED (§5, warn) and an unknown
 * `profile.nodeClasses[].coreKind` reported as UNKNOWN_KIND (§4, info). Each with a positive case,
 * a clean near-miss, the node(s) it names and its severity. Self-contained.
 */
import { describe, it, expect } from 'vitest';
import { validateStoryGraph } from '@/lib/story/validate';
import type { StoryEdge, StoryFinding, StoryGraph, StoryNode, StoryProfile, StoryVariable } from '@/lib/story/types';

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
const bool = (name: string, writers: string[]): StoryVariable => ({ name, type: 'bool', domain: { values: [true, false] }, initial: false, writers, scope: 'playthrough', external: false });

/**
 * START -> X -> Y -> END plus an alternative Y -> END guarded by `guard`. X writes `w` (if given).
 * Both variables are declared and used twice, so no VAR_* finding muddies the result.
 */
function influence(opts: { xWrites?: string; yReads?: string; endingReads?: string } = {}) {
  const vars = new Set([opts.xWrites, opts.yReads, opts.endingReads].filter((v): v is string => !!v));
  const g = tiny([{ id: 'X', kind: 'event' }, { id: 'Y', kind: 'event' }], [
    { from: 'START', to: 'X', kind: 'then' },
    { from: 'X', to: 'Y', kind: 'then', writes: opts.xWrites ? [{ var: opts.xWrites, op: 'set', value: true }] : undefined },
    { from: 'Y', to: 'END', kind: 'then', when: opts.yReads ? { var: opts.yReads, op: '==', value: true } : undefined },
    { from: 'Y', to: 'END', kind: 'then' },
    { from: 'X', to: 'Y', kind: 'influences' },
  ], { variables: [...vars].map((v) => bool(v, ['X'])) });
  return g;
}

describe('INFLUENCES_UNSUPPORTED (§5: an influences edge asserts what X writes is read by Y\'s guard)', () => {
  it('supported: X writes f, a guard out of Y reads f -> clean', () => {
    expect(run(influence({ xWrites: 'f', yReads: 'f' }))).toEqual([]);
  });

  it('unsupported: X writes f, Y reads g -> one warn naming [X, Y] and both sets, no variables field', () => {
    const f = validateStoryGraph(influence({ xWrites: 'f', yReads: 'g' })).filter((x) => x.code === 'INFLUENCES_UNSUPPORTED');
    expect(f.map(brief)).toEqual(['INFLUENCES_UNSUPPORTED/warn:X,Y']);
    expect(f[0].detail).toBe('influences edge e4 (X -> Y) is not supported by the data: X writes {f}, Y\'s guards read {g}; no variable in common');
    expect('variables' in f[0]).toBe(false);
  });

  it('unsupported with nothing on either side names the empty sets', () => {
    const f = validateStoryGraph(influence());
    expect(f.map(brief)).toEqual(['INFLUENCES_UNSUPPORTED/warn:X,Y']);
    expect(f[0].detail).toContain('X writes {}, Y\'s guards read {}');
  });

  it('an ending `when` on Y counts as a read', () => {
    const g = influence({ xWrites: 'f' });
    const asEnding: StoryGraph = {
      ...g,
      nodes: g.nodes.map((n) => (n.id === 'Y' ? { ...n, kind: 'ending' as const } : n)),
      edges: g.edges.filter((e) => e.from !== 'Y'),
      endings: [...g.endings, { node: 'Y', when: { var: 'f', op: '==', value: true } }],
    };
    expect(validateStoryGraph(asEnding).filter((x) => x.code === 'INFLUENCES_UNSUPPORTED')).toEqual([]);
    // ...and without the ending's guard the same edge is unsupported.
    const unguarded = { ...asEnding, endings: [...g.endings, { node: 'Y' }] };
    expect(run(unguarded).filter((s) => s.startsWith('INFLUENCES'))).toEqual(['INFLUENCES_UNSUPPORTED/warn:X,Y']);
  });

  it('a guard reached through a `ref` definition counts as a read', () => {
    const g = influence({ xWrites: 'f' });
    const viaRef: StoryGraph = {
      ...g,
      definitions: { ready: { var: 'f', op: '==', value: true } },
      edges: g.edges.map((e) => (e.id === 'e2' ? { ...e, when: { ref: 'ready' } } : e)),
    };
    expect(validateStoryGraph(viaRef).filter((x) => x.code === 'INFLUENCES_UNSUPPORTED')).toEqual([]);
  });

  it('container aggregation, source side: a container owns the writes of its descendants', () => {
    // BOX contains K; K's edge writes f; BOX -influences-> Y; Y reads f.
    const g = tiny([{ id: 'BOX', kind: 'container' }, { id: 'K', kind: 'event', parent: 'BOX' }, { id: 'Y', kind: 'event' }], [
      { from: 'START', to: 'BOX', kind: 'then' },
      { from: 'K', to: 'Y', kind: 'then', writes: [{ var: 'f', op: 'set', value: true }] },
      { from: 'Y', to: 'END', kind: 'then', when: { var: 'f', op: '==', value: true } },
      { from: 'Y', to: 'END', kind: 'then' },
      { from: 'BOX', to: 'Y', kind: 'influences' },
    ], { variables: [bool('f', ['K'])] });
    expect(validateStoryGraph(g).filter((x) => x.code === 'INFLUENCES_UNSUPPORTED')).toEqual([]);
    // ...and not the other way round: a child does not own its container's writes.
    const reverse: StoryGraph = { ...g, edges: g.edges.map((e) => (e.kind === 'influences' ? { ...e, from: 'START' } : e)) };
    expect(run(reverse).filter((s) => s.startsWith('INFLUENCES'))).toEqual(['INFLUENCES_UNSUPPORTED/warn:START,Y']);
  });

  it('container aggregation, target side: a container owns the guards of its descendants', () => {
    const g = tiny([{ id: 'X', kind: 'event' }, { id: 'BOX', kind: 'container' }, { id: 'K', kind: 'event', parent: 'BOX' }], [
      { from: 'START', to: 'X', kind: 'then' },
      { from: 'X', to: 'BOX', kind: 'then', writes: [{ var: 'f', op: 'set', value: true }] },
      { from: 'K', to: 'END', kind: 'then', when: { var: 'f', op: '==', value: true } },
      { from: 'K', to: 'END', kind: 'then' },
      { from: 'X', to: 'BOX', kind: 'influences' },
    ], { variables: [bool('f', ['X'])] });
    expect(validateStoryGraph(g).filter((x) => x.code === 'INFLUENCES_UNSUPPORTED')).toEqual([]);
  });

  it('writes on a NON-traversal edge do not count for the source', () => {
    const g = influence({ yReads: 'f' });
    const onInfluence: StoryGraph = { ...g, edges: g.edges.map((e) => (e.kind === 'influences' ? { ...e, writes: [{ var: 'f', op: 'set', value: true }] } : e)) };
    expect(run(onInfluence).filter((s) => s.startsWith('INFLUENCES'))).toEqual(['INFLUENCES_UNSUPPORTED/warn:X,Y']);
  });

  it('a long set is truncated in the detail', () => {
    const names = Array.from({ length: 9 }, (_, i) => `v${i}`);
    const g = influence({ yReads: 'other' });
    const many: StoryGraph = {
      ...g,
      variables: [...g.variables, ...names.map((n) => bool(n, ['X']))],
      edges: g.edges.map((e) => (e.id === 'e1' ? { ...e, writes: names.map((n) => ({ var: n, op: 'set' as const, value: true })) } : e)),
    };
    const f = validateStoryGraph(many).find((x) => x.code === 'INFLUENCES_UNSUPPORTED')!;
    expect(f.detail).toContain('X writes {v0, v1, v2, v3, v4, v5, +3 more}');
  });

  it('a dangling influences edge is DANGLING_EDGE only, never also unsupported', () => {
    const g = influence({ xWrites: 'f', yReads: 'f' });
    const dangling: StoryGraph = { ...g, edges: [...g.edges, { id: 'd1', from: 'X', to: 'NOWHERE', kind: 'influences' }] };
    expect(run(dangling)).toEqual(['DANGLING_EDGE/error:X']);
  });

  it('influences is never walked: a node reached only through one stays an orphan', () => {
    const g = tiny([{ id: 'X', kind: 'event' }, { id: 'Q', kind: 'event' }], [
      { from: 'START', to: 'X', kind: 'then' },
      { from: 'X', to: 'END', kind: 'then' },
      { from: 'Q', to: 'END', kind: 'then' },
      { from: 'X', to: 'Q', kind: 'influences' },
    ]);
    expect(run(g)).toEqual(['ORPHAN_NODE/warn:Q', 'INFLUENCES_UNSUPPORTED/warn:X,Q']);
  });
});

describe('UNKNOWN_KIND for a profile node class (§4: render it as a generic node and report it)', () => {
  const withClasses = (nodeClasses: StoryProfile['nodeClasses']) =>
    tiny([], [{ from: 'START', to: 'END', kind: 'then' }], { profile: { nodeClasses } });

  it('a coreKind outside the seven kinds is info, nodes [], naming the class and the value', () => {
    const f = validateStoryGraph(withClasses([{ id: 'vision', coreKind: 'dreamstate' as StoryNode['kind'], label: 'Vision' }]));
    expect(f.map(brief)).toEqual(['UNKNOWN_KIND/info:']);
    expect(f[0].nodes).toEqual([]);
    expect(f[0].detail).toBe('profile node class "vision" has unknown coreKind "dreamstate": kept and rendered as a generic node class');
  });

  it('near-miss: classes over the seven core kinds are silent; so is a profile with none', () => {
    const kinds = ['entry', 'event', 'choice', 'gate', 'container', 'ending', 'template'] as const;
    expect(run(withClasses(kinds.map((k) => ({ id: `c-${k}`, coreKind: k, label: k }))))).toEqual([]);
    expect(run(withClasses(undefined))).toEqual([]);
  });
});
