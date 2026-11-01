/**
 * The committed seeded-defect case: `seedStructuralDefects(graph, seed)` takes a CLEAN generated
 * graph (`generateStoryGraph`, N >= 4) and plants exactly one defect per structural code (§8),
 * returning the manifest of what it planted. It is the self-contained twin of the staged
 * `synthetic-scale` answer key, which is gitignored: a checkout without the contest arena still
 * proves every structural code is found, and found EXACTLY (no cascade into other codes).
 *
 * Each defect is a small island hung off the entry, built so it trips one code and nothing else:
 * every planted node that is not the defect itself is reachable and leads to an ending. A split of
 * `fixtures.ts` (kept under the file-size rule); that file is unchanged. Pure and deterministic.
 */

import type { StoryEdge, StoryFindingCode, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';
import { mulberry32 } from '@/lib/story/fixtures';

export interface SeededDefect {
  code: StoryFindingCode;
  nodes: string[];
  variables?: string[];
  /** For VAR_NO_REACHING_WRITE: the witness path the finding must report. */
  path?: string[];
}

export interface SeededGraph {
  graph: StoryGraph;
  defects: SeededDefect[];
}

const PROSE = ['ash', 'road', 'oath', 'iron', 'water', 'bread', 'stone', 'watch'];

export function seedStructuralDefects(clean: StoryGraph, seed = 1): SeededGraph {
  const g = structuredClone(clean) as StoryGraph & { nodes: StoryNode[]; edges: StoryEdge[]; variables: StoryVariable[]; endings: { node: string }[] };
  const entry = g.entries[0];
  const sink = g.endings[0]?.node;
  const trust = g.variables.find((v) => v.name === 'trust.0');
  if (!entry || !sink || !trust || g.nodes.length < 4) {
    throw new RangeError('seedStructuralDefects: needs a generateStoryGraph output with N >= 4');
  }
  const rnd = mulberry32(seed);
  const pick = () => PROSE[Math.floor(rnd() * PROSE.length)];
  const writers = trust.writers as string[];
  const defects: SeededDefect[] = [];
  let eid = 0;
  const node = (id: string, kind: StoryNode['kind'], extra: Partial<StoryNode> = {}) =>
    g.nodes.push({ id, kind, class: kind === 'choice' ? 'decision' : kind === 'gate' ? 'branch' : 'beat', title: id, text: kind === 'event' ? `${pick()} ${pick()}` : undefined, ...extra });
  const edge = (from: string, to: string, kind: StoryEdge['kind'] = 'then', extra: Partial<StoryEdge> = {}) =>
    g.edges.push({ id: `x${(eid += 1)}`, from, to, kind, ...extra });
  const hang = (id: string, kind: StoryNode['kind'] = 'event', extra: Partial<StoryNode> = {}) => {
    node(id, kind, extra);
    edge(entry, id);
  };

  // Is it a graph at all.
  hang('X.dangler');
  edge('X.dangler', sink);
  edge('X.dangler', 'X.nowhere');
  defects.push({ code: 'DANGLING_EDGE', nodes: ['X.dangler'] });

  hang('X.dup');
  edge('X.dup', sink);
  g.nodes.push({ id: 'X.dup', kind: 'event', class: 'beat', title: 'a second X.dup' });
  defects.push({ code: 'DUPLICATE_ID', nodes: ['X.dup'] });

  hang('X.ring.a', 'event', { parent: 'X.ring.b' });
  node('X.ring.b', 'event', { parent: 'X.ring.a' });
  edge('X.ring.a', 'X.ring.b');
  edge('X.ring.b', sink);
  defects.push({ code: 'CONTAINMENT_CYCLE', nodes: ['X.ring.a', 'X.ring.b'] });

  // What the walks prove.
  node('X.orphan', 'event');
  edge('X.orphan', sink);
  defects.push({ code: 'ORPHAN_NODE', nodes: ['X.orphan'] });

  node('X.lost', 'ending', { class: 'finale' });
  g.endings.push({ node: 'X.lost' });
  defects.push({ code: 'ENDING_UNREACHABLE', nodes: ['X.lost'] });

  hang('X.dead.a');
  node('X.dead.b', 'event');
  edge('X.dead.a', 'X.dead.b');
  edge('X.dead.b', 'X.dead.a');
  defects.push({ code: 'NO_ENDING_REACHABLE', nodes: ['X.dead.a', 'X.dead.b'] });

  hang('X.term');
  defects.push({ code: 'UNDECLARED_TERMINAL', nodes: ['X.term'] });

  // Variables.
  hang('X.undec', 'gate');
  edge('X.undec', sink, 'gate', { when: { var: 'x.undeclared', op: '==', value: true } });
  defects.push({ code: 'VAR_UNDECLARED', nodes: ['X.undec'], variables: ['x.undeclared'] });

  g.variables.push({ name: 'x.lonely', type: 'bool', domain: { values: [true, false] }, initial: false, writers: [], scope: 'playthrough', external: false });
  hang('X.single', 'gate');
  edge('X.single', sink, 'gate', { when: { var: 'x.lonely', op: '==', value: true } });
  defects.push({ code: 'VAR_SINGLETON', nodes: ['X.single'], variables: ['x.lonely'] });

  hang('X.dom');
  edge('X.dom', sink, 'then', { writes: [{ var: 'trust.0', op: 'set', value: 999 }] });
  writers.push('X.dom');
  defects.push({ code: 'VAR_DOMAIN_VIOLATION', nodes: ['X.dom'], variables: ['trust.0'] });

  hang('X.rogue');
  edge('X.rogue', sink, 'then', { writes: [{ var: 'trust.0', op: 'add', value: 1 }] });
  defects.push({ code: 'VAR_WRITER_NOT_OWNER', nodes: ['X.rogue'], variables: ['trust.0'] });

  // A join: one predecessor writes the verdict, the other does not. The read after the join has
  // a path with no write — the finding must report that path, which per-node review never sees.
  g.variables.push({ name: 'x.verdict', type: 'enum', domain: { values: ['guilty', 'free'] }, initial: null, requiresWrite: true, writers: ['X.join.w'], scope: 'playthrough', external: false });
  hang('X.join.w');
  hang('X.join.skip');
  node('X.join', 'gate');
  edge('X.join.w', 'X.join', 'then', { writes: [{ var: 'x.verdict', op: 'set', value: 'guilty' }] });
  edge('X.join.skip', 'X.join');
  edge('X.join', sink, 'gate', { when: { var: 'x.verdict', op: '==', value: 'guilty' } });
  edge('X.join', sink, 'gate', { when: { var: 'x.verdict', op: '!=', value: 'guilty' } });
  defects.push({ code: 'VAR_NO_REACHING_WRITE', nodes: ['X.join'], variables: ['x.verdict'], path: [entry, 'X.join.skip', 'X.join'] });

  // Choices, budgets, guards.
  hang('X.false', 'choice', { options: [{ id: 'kindly' }, { id: 'plainly' }] });
  for (const optionId of ['kindly', 'plainly']) edge('X.false', sink, 'option', { optionId, writes: [{ var: 'trust.0', op: 'set', value: 5 }] });
  writers.push('X.false');
  defects.push({ code: 'FALSE_CHOICE', nodes: ['X.false'] });

  hang('X.wordy', 'event', { text: Array.from({ length: 100 + Math.floor(rnd() * 50) }, pick).join(' ') });
  edge('X.wordy', sink);
  defects.push({ code: 'TEXT_BUDGET_EXCEEDED', nodes: ['X.wordy'] });

  hang('X.expr', 'gate');
  edge('X.expr', sink, 'gate', { when: { expr: 'the player seems ready' } });
  defects.push({ code: 'UNTYPED_CONDITION', nodes: ['X.expr'] });

  // Drop the `text: undefined` keys the helper left, so the document round-trips through JSON.
  for (const n of g.nodes) if (n.text === undefined) delete n.text;
  return { graph: g, defects };
}
