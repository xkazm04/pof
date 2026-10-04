/**
 * A tiny, self-contained storygraph for the inspector's tests.
 *
 * It is written in the test tree, not read from `.contest/`, for one reason: the honesty rules it
 * exercises are the ones a port loses first, so their tests must run on every checkout — including
 * one without the contest arena, where the fixture-backed suites skip. It carries, deliberately:
 *
 *   `l.zero`   reach MEASURED at 0 for the only cohort  -> a measured zero
 *   `l.half`   reach measured at 50                     -> an ordinary measured row
 *   `l.none`   NO reach row at all                      -> unmeasured, which is not zero
 *   `mood`     written, and read by no guard and no ending -> a decoration
 *   `fate`     written, and read by the ending's condition -> ending-shaping
 *   `l.ghost`  no edge in and no edge out                  -> one real audit finding, so the Audit
 *                                                           tab has something to walk to
 *   run.graphHash: null, run.provisional: true          -> unverified AND provisional
 */

import { buildOrreryModel } from '@/lib/story/orrery';
import type { OrreryModel } from '@/lib/story/orrery';
import type { StoryGraph } from '@/lib/story/types';

export function honestyGraph(): StoryGraph {
  return {
    format: 'pof.storygraph/1',
    project: 'Inspector Fixture',
    graphId: 'fixture.inspector',
    revision: 3,
    profile: { nodeClasses: [{ id: 'line', coreKind: 'event', label: 'Line' }] },
    variables: [
      {
        name: 'mood',
        type: 'int',
        domain: { min: 0, max: 10 },
        initial: 0,
        writers: ['l.half'],
        scope: 'playthrough',
        external: false,
      },
      {
        name: 'fate',
        type: 'enum',
        domain: { values: ['dim', 'bright'] },
        initial: 'dim',
        writers: ['l.none'],
        scope: 'playthrough',
        external: false,
      },
    ],
    entries: ['l.zero'],
    nodes: [
      { id: 'c.conv', kind: 'container', class: 'conversation', title: 'The Ferryman' },
      { id: 'l.zero', kind: 'event', class: 'line', parent: 'c.conv', title: 'He does not look up', text: 'He does not look up from the rope.' },
      { id: 'l.half', kind: 'event', class: 'line', parent: 'c.conv', title: 'An oath, of a kind' },
      { id: 'l.none', kind: 'event', class: 'line', parent: 'c.conv', title: 'A line nobody measured' },
      { id: 'l.ghost', kind: 'event', class: 'line', parent: 'c.conv', title: 'A line nobody reaches' },
      { id: 'e.end', kind: 'ending', title: 'Across, and poorer' },
    ],
    edges: [
      { id: 'e1', from: 'l.zero', to: 'l.half', kind: 'then' },
      { id: 'e2', from: 'l.half', to: 'l.none', kind: 'then', writes: [{ var: 'mood', op: 'add', value: 1 }] },
      { id: 'e3', from: 'l.none', to: 'e.end', kind: 'then', writes: [{ var: 'fate', op: 'set', value: 'bright' }] },
    ],
    endings: [{ node: 'e.end', label: 'Across, and poorer', when: { var: 'fate', op: '==', value: 'bright' } }],
    budgets: { unit: 'words', basis: 'fixture, hand-written', perClass: { line: 40 } },
    evidence: {
      runs: [
        {
          runId: 'r1',
          engine: 'fixture',
          n: 100,
          graphHash: null,
          cohorts: ['all'],
          provisional: true,
        },
      ],
      reach: { 'l.zero': { all: 0 }, 'l.half': { all: 50 } },
    },
  };
}

export function honestyModel(): OrreryModel {
  return buildOrreryModel(honestyGraph(), 'fixture');
}

/** The index of a node by id, loudly if the fixture drifted. */
export function ix(model: OrreryModel, id: string): number {
  const i = model.idx.get(id);
  if (i === undefined) throw new Error(`fixture has no node ${id}`);
  return i;
}
