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

import type { FindingSeverity, StoryEdge, StoryEnding, StoryFindingCode, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';
import { mulberry32 } from '@/lib/story/fixtures';

export interface SeededDefect {
  code: StoryFindingCode;
  nodes: string[];
  variables?: string[];
  /** For VAR_NO_REACHING_WRITE: the witness path the finding must report. */
  path?: string[];
  /** Only where one code carries two severities (PRECEDENCE_NOT_TOTAL). */
  severity?: FindingSeverity;
}

export interface SeededGraph {
  graph: StoryGraph;
  defects: SeededDefect[];
}

const PROSE = ['ash', 'road', 'oath', 'iron', 'water', 'bread', 'stone', 'watch'];

export function seedStructuralDefects(clean: StoryGraph, seed = 1): SeededGraph {
  const g = structuredClone(clean) as StoryGraph & { nodes: StoryNode[]; edges: StoryEdge[]; variables: StoryVariable[]; endings: StoryEnding[] };
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

  // Wave 4 (§12 amendments): the six MUSTs that had no code. Appended AFTER every earlier defect so
  // the PRNG draws above — and therefore everything earlier in the manifest — are unchanged.
  hang('X.lone', 'choice', { options: [{ id: 'only' }] });
  edge('X.lone', sink, 'option', { optionId: 'only' });
  defects.push({ code: 'CHOICE_TOO_FEW_OPTIONS', nodes: ['X.lone'] });

  hang('X.bare', 'gate');
  edge('X.bare', sink, 'gate');
  defects.push({ code: 'GATE_WITHOUT_CONDITION', nodes: ['X.bare'] });

  // An unknown node kind (walked as ordinary) and an unknown edge kind beside a real edge (not walked).
  hang('X.odd', 'event', { kind: 'vignette' as StoryNode['kind'] });
  edge('X.odd', sink);
  edge('X.odd', sink, 'echoes' as StoryEdge['kind']);
  defects.push({ code: 'UNKNOWN_KIND', nodes: ['X.odd'] }, { code: 'UNKNOWN_KIND', nodes: ['X.odd', sink] });

  // X.kid says X.box.a; a contains edge says X.box.b. Both boxes continue to the ending.
  hang('X.box.a', 'container');
  edge('X.box.a', sink);
  hang('X.box.b', 'container');
  edge('X.box.b', sink);
  node('X.kid', 'event', { parent: 'X.box.a' });
  edge('X.box.b', 'X.kid', 'contains');
  defects.push({ code: 'PARENT_CONTAINS_MISMATCH', nodes: ['X.kid', 'X.box.a', 'X.box.b'] });

  g.variables.push({ name: 'x.callsign', type: 'string', domain: {}, initial: '', writers: [], scope: 'playthrough', external: false });
  defects.push({ code: 'STRING_VAR_NO_VALUES', nodes: [], variables: ['x.callsign'] });

  // The two generated endings tie at precedence 1 (error); X.lost declares none (warn).
  for (const e of g.endings) if (e.node !== 'X.lost') e.precedence = 1;
  const tied = g.endings.filter((e) => e.node !== 'X.lost').map((e) => e.node).sort();
  defects.push({ code: 'PRECEDENCE_NOT_TOTAL', nodes: tied, severity: 'error' }, { code: 'PRECEDENCE_NOT_TOTAL', nodes: ['X.lost'], severity: 'warn' });

  // Wave 5. Appended after everything above (its PRNG draws come last), so the earlier manifest is unchanged.
  // A gate node whose only ways on are unguarded `then` edges branches on nothing (one node finding).
  hang('X.hollow', 'gate');
  edge('X.hollow', sink);
  edge('X.hollow', sink);
  defects.push({ code: 'GATE_WITHOUT_CONDITION', nodes: ['X.hollow'] });

  // A declared influence the data does not support: the source writes nothing the target's guards read.
  hang('X.cause');
  edge('X.cause', sink);
  hang('X.effect');
  edge('X.effect', sink);
  edge('X.cause', 'X.effect', 'influences');
  defects.push({ code: 'INFLUENCES_UNSUPPORTED', nodes: ['X.cause', 'X.effect'] });

  // A profile node class with a coreKind outside the seven kinds (§4: render generic AND report).
  const profile = g.profile as { nodeClasses?: { id: string; coreKind: string; label: string }[] };
  profile.nodeClasses = [...(profile.nodeClasses ?? []), { id: 'x.mystery', coreKind: 'vignette', label: 'Mystery' }];
  defects.push({ code: 'UNKNOWN_KIND', nodes: [] });

  // Drop the `text: undefined` keys the helper left, so the document round-trips through JSON.
  for (const n of g.nodes) if (n.text === undefined) delete n.text;
  return { graph: g, defects };
}
