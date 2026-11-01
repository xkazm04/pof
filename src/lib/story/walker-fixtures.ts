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
 *   `forkGraph()`      START forks (`mode: 'all'`) into threads A and B, plus C whose guard (x >= 1)
 *                      never holds, so C never spawns. A writes a, B writes b; both run on to J,
 *                      whose way on (a AND b) is a JOIN: the first thread there waits (blocked)
 *                      until the other's write lands, then merges. Every walk ends at E.done, C is
 *                      a measured 0. With `{ needsC: true }` J also needs c, which only C's thread
 *                      writes: every walk stalls at J with both threads blocked.
 *   `livelockGraph(k)` START -> HUB (choice: loop | out). `loop` enters L1 <-> L2, counting n
 *                      (0..3, clamped) on L1 -> L2; L2 -> E.out only when n >= k. With k = 3 the
 *                      loop can always still exit (a long walk is only `truncated`); with k = 5 no
 *                      state in the domain opens it: a closed loop with no ending, a LIVELOCK.
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

export function forkGraph(opts: { needsC?: boolean } = {}): StoryGraph {
  const bool = (name: string, writer: string): StoryVariable =>
    ({ name, type: 'bool', domain: { values: [true, false] }, initial: false, requiresWrite: false, writers: [writer], scope: 'playthrough', external: false });
  const has = (v: string) => ({ var: v, op: '==' as const, value: true });
  return doc(
    opts.needsC ? 'walker-fork-stall' : 'walker-fork',
    [
      { id: 'START', kind: 'entry', title: 'Three threads' },
      { id: 'A', kind: 'event', title: 'Thread A' },
      { id: 'B', kind: 'event', title: 'Thread B' },
      { id: 'C', kind: 'event', title: 'Thread C (never opens)' },
      { id: 'J', kind: 'event', title: 'The threads meet' },
      { id: 'E.done', kind: 'ending', title: 'Done' },
    ],
    [
      { id: 'f1', from: 'START', to: 'A', kind: 'then', mode: 'all' },
      { id: 'f2', from: 'START', to: 'B', kind: 'then', mode: 'all' },
      { id: 'f3', from: 'START', to: 'C', kind: 'then', mode: 'all', when: { var: 'x', op: '>=', value: 1 } },
      { id: 'a1', from: 'A', to: 'J', kind: 'then', writes: [{ var: 'a', op: 'set', value: true }] },
      { id: 'b1', from: 'B', to: 'J', kind: 'then', writes: [{ var: 'b', op: 'set', value: true }] },
      { id: 'c1', from: 'C', to: 'J', kind: 'then', writes: [{ var: 'c', op: 'set', value: true }] },
      { id: 'j1', from: 'J', to: 'E.done', kind: 'then', when: { all: [has('a'), has('b'), ...(opts.needsC ? [has('c')] : [])] } },
    ],
    [
      bool('a', 'A'), bool('b', 'B'), bool('c', 'C'),
      { name: 'x', type: 'int', domain: { min: 0, max: 1 }, initial: 0, requiresWrite: false, writers: [], scope: 'playthrough', external: false },
    ],
    ['E.done'],
  );
}

export function livelockGraph(exitAt: number): StoryGraph {
  return doc(
    `walker-livelock-${exitAt}`,
    [
      { id: 'START', kind: 'entry', title: 'Start' },
      { id: 'HUB', kind: 'choice', title: 'The side road', options: [{ id: 'loop' }, { id: 'out' }] },
      { id: 'L1', kind: 'event', title: 'Round the well' },
      { id: 'L2', kind: 'event', title: 'Back to the well' },
      { id: 'E.out', kind: 'ending', title: 'Out of the loop' },
      { id: 'E.home', kind: 'ending', title: 'Home' },
    ],
    [
      { id: 'l0', from: 'START', to: 'HUB', kind: 'then' },
      { id: 'l1', from: 'HUB', to: 'L1', kind: 'option', optionId: 'loop', writes: [{ var: 'n', op: 'set', value: 0 }] },
      { id: 'l2', from: 'HUB', to: 'E.home', kind: 'option', optionId: 'out' },
      { id: 'l3', from: 'L1', to: 'L2', kind: 'then', writes: [{ var: 'n', op: 'add', value: 1 }] },
      { id: 'l4', from: 'L2', to: 'L1', kind: 'then' },
      { id: 'l5', from: 'L2', to: 'E.out', kind: 'gate', when: { var: 'n', op: '>=', value: exitAt } },
    ],
    [{ name: 'n', type: 'int', domain: { min: 0, max: 3 }, initial: 0, requiresWrite: false, writers: ['HUB', 'L1'], scope: 'playthrough', external: false }],
    ['E.out', 'E.home'],
  );
}
