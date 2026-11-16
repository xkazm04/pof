/** A small nested graph for the Orrery's status channel: imported (unverified) + sampled cells. */

import type { StoryEvidence, StoryGraph, WalkerReport } from '@/lib/story/types';

export const HASH = 'sha256:current';

/** act > sc1 (l1, l2), sc2 (l3, l4), sc3 (l5); end. l4 and l5 are never measured. */
export function graph(evidence?: StoryEvidence): StoryGraph {
  return {
    format: 'pof.storygraph/1',
    project: 'Status',
    graphId: 'status',
    revision: 1,
    profile: { nodeClasses: [] },
    variables: [],
    entries: ['l1'],
    nodes: [
      { id: 'act', kind: 'container', title: 'Act' },
      { id: 'sc1', kind: 'container', title: 'Scene 1', parent: 'act' },
      { id: 'l1', kind: 'event', title: 'L1', parent: 'sc1' },
      { id: 'l2', kind: 'event', title: 'L2', parent: 'sc1' },
      { id: 'sc2', kind: 'container', title: 'Scene 2', parent: 'act' },
      { id: 'l3', kind: 'event', title: 'L3', parent: 'sc2' },
      { id: 'l4', kind: 'event', title: 'L4', parent: 'sc2' },
      { id: 'sc3', kind: 'container', title: 'Scene 3', parent: 'act' },
      { id: 'l5', kind: 'event', title: 'L5', parent: 'sc3' },
      { id: 'end', kind: 'ending', title: 'End', parent: 'act' },
    ],
    edges: [
      { id: 'e1', from: 'l1', to: 'l2', kind: 'then' },
      { id: 'e2', from: 'l2', to: 'l3', kind: 'then' },
      { id: 'e3', from: 'l3', to: 'l4', kind: 'then' },
      { id: 'e4', from: 'l4', to: 'l5', kind: 'then' },
      { id: 'e5', from: 'l5', to: 'end', kind: 'then' },
    ],
    endings: [{ node: 'end' }],
    budgets: { unit: 'words', basis: 'none', perClass: {} },
    evidence,
  } as StoryGraph;
}

/** Imported: `fighter`, not pinned (unverified). */
export const IMPORTED: StoryEvidence = {
  runs: [{ runId: 'imp', engine: 'fix', n: 50, graphHash: null, cohorts: ['fighter'] }],
  reach: { l1: { fighter: 40 }, l2: { fighter: 0 }, l3: { fighter: 10 } },
};

export function report(graphHash: string | null, reach: StoryEvidence['reach']): Pick<WalkerReport, 'evidence'> {
  return { evidence: { runs: [{ runId: 'w', engine: 'pof-walker@1', n: 400, graphHash, cohorts: ['uniform'] }], reach } };
}

export const SAMPLED_REACH = { l1: { uniform: 50 }, l2: { uniform: 0 }, l3: { uniform: 20 }, end: { uniform: 30 } };

