/** A walker report over the inspector honesty fixture (`panelFixture.ts`), shared by the walk suites. */

import type { WalkerReport } from '@/lib/story/types';

export const HASH = 'sha256:current';

/** A walker report over the honesty fixture: `uniform` sampled, plus an `all` cell imported outranks. */
export function walkReport(over: Partial<WalkerReport> = {}): WalkerReport {
  return {
    engine: 'pof-walker@1',
    graphId: 'fixture.inspector',
    project: 'Inspector Fixture',
    revision: 3,
    seed: 7,
    samples: 400,
    maxSteps: 500,
    cohorts: [{ id: 'uniform', policy: 'uniform' }],
    evidence: {
      runs: [{ runId: 'w1', engine: 'pof-walker@1', n: 400, graphHash: HASH, cohorts: ['uniform', 'all'] }],
      // l.none measured at 0 (a real zero); l.ghost absent (unmeasured).
      reach: { 'l.zero': { uniform: 100 }, 'l.half': { uniform: 100, all: 70 }, 'l.none': { uniform: 0 } },
    },
    outcomes: {},
    findings: [
      {
        code: 'SOFTLOCK_LEAD',
        altitude: 'state',
        severity: 'warn',
        nodes: ['l.half'],
        detail: '12 of 400 walks stopped at l.half. A lead to reproduce, not a proven defect.',
        lead: { seed: 7, engine: 'pof-walker@1', samples: 400, state: { mood: 0 }, path: ['l.zero', 'l.half'] },
      },
    ],
    domainEvents: [],
    truncatedAt: {},
    terminalAt: {},
    gradeable: true,
    untypedEdges: [],
    steps: 1200,
    ...over,
  };
}
