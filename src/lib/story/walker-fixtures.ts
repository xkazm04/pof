/**
 * Small, deliberate graphs for the walker's acceptance tests (WP3). Each is a complete
 * `pof.storygraph/1` document that passes the schema, built so the state-altitude claim it seeds is
 * known exactly:
 *
 *   `softlockGraph()`  START -> CHOOSE (take: coins+1 | leave) -> COUNT (gate: coins >= 2 -> E.rich,
 *                      coins == 0 -> E.clean). Taking the coin lands COUNT at coins = 1, where no
 *                      gate guard holds: a true softlock at (COUNT, {coins: 1}), about half the walks.
 *   `offerGraph()`     six binary steps each adding 0 or 1 to `x` (domain 0..10), then a choice:
 *                      `plain` (always), `rare` (x == 6, offered on ~1/64 of walks),
 *                      `big` (x >= 7: satisfiable in the domain, never in a reachable state),
 *                      `impossible` (x > 10: unsatisfiable in the domain). Plus `ORPH`, a node no
 *                      edge reaches (WP2's orphan; the walker must leave it absent, not report it).
 * Pure; no randomness.
 */

import type { StoryEdge, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';

function doc(graphId: string, nodes: StoryNode[], edges: StoryEdge[], variables: StoryVariable[], endings: string[]): StoryGraph {
  return {
    format: 'pof.storygraph/1',
    project: 'walker-fixtures',
    graphId,
    revision: 1,
    profile: { lanes: [{ id: 'main', label: 'Main' }], languages: ['en'] },
    variables,
    entries: ['START'],
    nodes,
    edges,
    endings: endings.map((node) => ({ node })),
    budgets: { unit: 'words', basis: 'per node, per language', perClass: {} },
  };
}

export function softlockGraph(): StoryGraph {
  return doc(
    'walker-softlock',
    [
      { id: 'START', kind: 'entry', title: 'Start' },
      { id: 'CHOOSE', kind: 'choice', title: 'The purse', options: [{ id: 'take' }, { id: 'leave' }] },
      { id: 'COUNT', kind: 'gate', title: 'Counting the coins' },
      { id: 'E.rich', kind: 'ending', title: 'Rich' },
      { id: 'E.clean', kind: 'ending', title: 'Clean hands' },
    ],
    [
      { id: 'e0', from: 'START', to: 'CHOOSE', kind: 'then' },
      { id: 'e1', from: 'CHOOSE', to: 'COUNT', kind: 'option', optionId: 'take', writes: [{ var: 'coins', op: 'add', value: 1 }] },
      { id: 'e2', from: 'CHOOSE', to: 'COUNT', kind: 'option', optionId: 'leave' },
      { id: 'e3', from: 'COUNT', to: 'E.rich', kind: 'gate', when: { var: 'coins', op: '>=', value: 2 } },
      { id: 'e4', from: 'COUNT', to: 'E.clean', kind: 'gate', when: { var: 'coins', op: '==', value: 0 } },
    ],
    [{ name: 'coins', type: 'int', domain: { min: 0, max: 5 }, initial: 0, requiresWrite: false, writers: ['CHOOSE'], scope: 'playthrough', external: false }],
    ['E.rich', 'E.clean'],
  );
}

export const OFFER_STEPS = 6;

export function offerGraph(): StoryGraph {
  const nodes: StoryNode[] = [{ id: 'START', kind: 'entry', title: 'Start' }];
  const edges: StoryEdge[] = [{ id: 'in1', from: 'START', to: 'S1', kind: 'then' }];
  const writers: string[] = [];
  for (let i = 1; i <= OFFER_STEPS; i++) {
    const s = `S${i}`;
    nodes.push({ id: s, kind: 'choice', title: `Step ${i}`, options: [{ id: 'up' }, { id: 'stay' }] });
    const next = i === OFFER_STEPS ? 'PICK' : `S${i + 1}`;
    edges.push({ id: `up${i}`, from: s, to: `${s}.up`, kind: 'option', optionId: 'up', writes: [{ var: 'x', op: 'add', value: 1 }] });
    edges.push({ id: `stay${i}`, from: s, to: `${s}.stay`, kind: 'option', optionId: 'stay' });
    nodes.push({ id: `${s}.up`, kind: 'event', title: 'Up' }, { id: `${s}.stay`, kind: 'event', title: 'Stay' });
    edges.push({ id: `j${i}u`, from: `${s}.up`, to: next, kind: 'then' }, { id: `j${i}s`, from: `${s}.stay`, to: next, kind: 'then' });
    writers.push(s);
  }
  nodes.push(
    { id: 'PICK', kind: 'choice', title: 'The reckoning', options: [{ id: 'plain' }, { id: 'rare' }, { id: 'big' }, { id: 'impossible' }] },
    { id: 'E.plain', kind: 'ending', title: 'Plain' },
    { id: 'E.rare', kind: 'ending', title: 'Rare' },
    { id: 'E.big', kind: 'ending', title: 'Big' },
    { id: 'E.impossible', kind: 'ending', title: 'Impossible' },
    { id: 'ORPH', kind: 'event', title: 'Nobody comes here' },
  );
  edges.push(
    { id: 'p1', from: 'PICK', to: 'E.plain', kind: 'option', optionId: 'plain' },
    { id: 'p2', from: 'PICK', to: 'E.rare', kind: 'option', optionId: 'rare', when: { var: 'x', op: '==', value: OFFER_STEPS } },
    { id: 'p3', from: 'PICK', to: 'E.big', kind: 'option', optionId: 'big', when: { var: 'x', op: '>=', value: OFFER_STEPS + 1 } },
    { id: 'p4', from: 'PICK', to: 'E.impossible', kind: 'option', optionId: 'impossible', when: { var: 'x', op: '>', value: 10 } },
    { id: 'o1', from: 'ORPH', to: 'E.plain', kind: 'then' },
  );
  return doc(
    'walker-offer',
    nodes,
    edges,
    [{ name: 'x', type: 'int', domain: { min: 0, max: 10 }, initial: 0, requiresWrite: false, writers, scope: 'playthrough', external: false }],
    ['E.plain', 'E.rare', 'E.big', 'E.impossible'],
  );
}
