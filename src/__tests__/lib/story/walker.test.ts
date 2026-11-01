/**
 * WP3 acceptance 1-5 on committed graphs: determinism, the §11 minimum graph's 50/50 endings,
 * OPTION_NEVER_OFFERED (and not on a rare-but-reachable option), a softlock lead that replays, and
 * the two silences of reach (wave 4): a covered node no walk reached is an explicit MEASURED 0, a
 * node the run does not cover stays ABSENT. Plus the lead contract on every state finding.
 *
 * The minimum graph is read FROM THE STANDARD ITSELF, as WP1's import test does.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryGraph } from '@/lib/story/importer';
import { canonicalize } from '@/lib/story/canonical';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { createWalker, sampleGraph, WALKER_ENGINE } from '@/lib/story/walker';
import { replayLead } from '@/lib/story/walker-replay';
import { offerGraph, OFFER_STEPS, softlockGraph } from '@/lib/story/walker-fixtures';
import { storyGraphSchema } from '@/lib/story/schema';
import type { StoryFinding, StoryGraph } from '@/lib/story/types';

const STANDARD = path.resolve(process.cwd(), 'docs', 'architecture', 'storygraph-standard.md');
function minimumGraph(): StoryGraph {
  const doc = fs.readFileSync(STANDARD, 'utf8');
  const at = doc.indexOf('**Minimum viable graph**');
  expect(at).toBeGreaterThan(-1);
  const m = /```jsonc\r?\n([\s\S]*?)```/.exec(doc.slice(at));
  const r = parseStoryGraph(JSON.parse(m![1]));
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

const expectLead = (f: StoryFinding) => {
  expect(f.altitude).toBe('state');
  expect(f.lead).toBeDefined();
  expect(f.lead!.engine).toBe(WALKER_ENGINE);
  expect(typeof f.lead!.seed).toBe('number');
  expect(f.lead!.samples).toBeGreaterThan(0);
  expect(Array.isArray(f.lead!.path)).toBe(true);
  expect(typeof f.lead!.state).toBe('object');
  expect(f.detail).toContain('A lead to reproduce, not a proven defect.');
};

describe('determinism (acceptance 1)', () => {
  it('two runs at one seed are byte-identical; another seed differs', () => {
    const g = generateStoryGraph({ nodes: 600, seed: 7 });
    const a = canonicalize(sampleGraph(g, { seed: 42, samples: 300 }));
    const b = canonicalize(sampleGraph(g, { seed: 42, samples: 300 }));
    const c = canonicalize(sampleGraph(g, { seed: 43, samples: 300 }));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('chunking the run does not change a byte', () => {
    const g = generateStoryGraph({ nodes: 300, seed: 3 });
    const whole = canonicalize(sampleGraph(g, { seed: 5, samples: 120 }));
    const w = createWalker(g, { seed: 5, samples: 120 });
    while (w.done() < w.total) w.run(7);
    expect(canonicalize(w.report())).toBe(whole);
  });
});

describe('§11 minimum viable graph (acceptance 2)', () => {
  it('both endings reach ~50% over 2,000 walks (tolerance +/-5 points), neither is 0', () => {
    const r = sampleGraph(minimumGraph(), { seed: 1, samples: 2000 });
    const e1 = r.evidence.reach.E1?.uniform;
    const e2 = r.evidence.reach.E2?.uniform;
    expect(e1).toBeGreaterThan(45);
    expect(e1).toBeLessThan(55);
    expect(e2).toBeGreaterThan(45);
    expect(e2).toBeLessThan(55);
    expect(e1! + e2!).toBe(100);
    expect(r.outcomes.uniform.endings).toEqual({ E1: r.outcomes.uniform.endings.E1, E2: r.outcomes.uniform.endings.E2 });
    expect(r.outcomes.uniform.stalled + r.outcomes.uniform.truncated + r.outcomes.uniform.terminal).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.gradeable).toBe(true);
  });
});

describe('OPTION_NEVER_OFFERED (acceptance 3)', () => {
  const g = offerGraph();
  const r = sampleGraph(g, { seed: 11, samples: 2000 });
  const never = r.findings.filter((f) => f.code === 'OPTION_NEVER_OFFERED');

  it('the fixture is a valid document', () => {
    expect(storyGraphSchema.safeParse(g).success).toBe(true);
  });

  it('fires on an option no reachable state satisfies (x >= 7 when x tops out at 6)', () => {
    expect(never.map((f) => f.detail.match(/option "([^"]+)"/)![1]).sort()).toEqual(['big', 'impossible']);
    for (const f of never) {
      expect(f.nodes).toEqual(['PICK']);
      expect(f.variables).toEqual(['x']);
      expectLead(f);
      expect(f.lead!.path[f.lead!.path.length - 1]).toBe('PICK');
    }
  });

  it(`does NOT fire on the rare-but-reachable option (x == ${OFFER_STEPS}, ~1/${2 ** OFFER_STEPS} of walks)`, () => {
    const rare = r.evidence.reach['E.rare']?.uniform;
    expect(rare).toBeGreaterThan(0);
    expect(rare).toBeLessThan(5);
    expect(never.some((f) => f.detail.includes('"rare"'))).toBe(false);
  });

  it('GUARD_UNSATISFIABLE only for the domain-impossible guard, not the merely unreached one', () => {
    const unsat = r.findings.filter((f) => f.code === 'GUARD_UNSATISFIABLE');
    expect(unsat).toHaveLength(1);
    expect(unsat[0].detail).toContain('p4');
    expectLead(unsat[0]);
  });
});

describe('SOFTLOCK_LEAD (acceptance 4)', () => {
  const g = softlockGraph();
  const r = sampleGraph(g, { seed: 9, samples: 2000 });
  const locks = r.findings.filter((f) => f.code === 'SOFTLOCK_LEAD');

  it('a deliberate softlock yields one lead carrying the stuck state', () => {
    expect(storyGraphSchema.safeParse(g).success).toBe(true);
    expect(locks).toHaveLength(1);
    expect(locks[0].nodes).toEqual(['COUNT']);
    expect(locks[0].lead!.state).toEqual({ coins: 1 });
    expect(locks[0].lead!.path).toEqual(['START', 'CHOOSE', 'COUNT']);
    expectLead(locks[0]);
    expect(r.outcomes.uniform.stalled).toBeGreaterThan(900);
    expect(r.outcomes.uniform.stalled).toBeLessThan(1100);
  });

  it('replaying lead.state + lead.path stalls at the same node', () => {
    const replay = replayLead(g, locks[0].lead!);
    expect(replay.reproduced).toBe(true);
    expect(replay.node).toBe('COUNT');
  });

  it('a doctored lead does not reproduce (the replay can fail)', () => {
    expect(replayLead(g, { ...locks[0].lead!, state: { coins: 0 } }).reproduced).toBe(false);
    expect(replayLead(g, { ...locks[0].lead!, path: ['START', 'COUNT'] }).reproduced).toBe(false);
  });

  it('a long-but-progressing walk that hits the step cap is truncated, never a softlock', () => {
    const t = sampleGraph(generateStoryGraph({ nodes: 400, seed: 2 }), { seed: 1, samples: 50, maxSteps: 5 });
    expect(t.outcomes.uniform.truncated).toBe(50);
    expect(t.findings.filter((f) => f.code === 'SOFTLOCK_LEAD')).toEqual([]);
  });
});

describe('measured zero vs unmeasured (acceptance 5, wave-4 rule)', () => {
  const r = sampleGraph(offerGraph(), { seed: 11, samples: 2000 });

  it('a covered node no walk reached is an explicit 0; an uncovered node (orphan) stays ABSENT', () => {
    expect('ORPH' in r.evidence.reach).toBe(false); // not covered by the run: unmeasured, never 0
    expect(r.evidence.reach['E.big']).toEqual({ uniform: 0 }); // covered, never reached: a measured 0
    expect(r.evidence.reach['E.impossible']).toEqual({ uniform: 0 });
    const zeros = Object.entries(r.evidence.reach).filter(([, row]) => row.uniform === 0).map(([id]) => id).sort();
    const nnr = r.findings.filter((f) => f.code === 'NODE_NEVER_REACHED').map((f) => f.nodes[0]).sort();
    expect(zeros).toEqual(nnr); // every NODE_NEVER_REACHED lead has its 0 row, and only those are 0
    for (const [id, row] of Object.entries(r.evidence.reach)) if (!zeros.includes(id)) expect(row.uniform).toBeGreaterThan(0);
  });

  it('with no walks nothing is measured: no row is 0', () => {
    expect(sampleGraph(offerGraph(), { seed: 11, samples: 0 }).evidence.reach).toEqual({});
  });

  it('a node behind an unknown edge kind is not covered: absent, and not a NODE_NEVER_REACHED lead', () => {
    const g = offerGraph();
    const island = {
      ...g,
      nodes: [...g.nodes, { id: 'ISLE', kind: 'event' as const, title: 'Behind a portal' }],
      edges: [...g.edges, { id: 'tp', from: 'PICK', to: 'ISLE', kind: 'portal' as unknown as 'then' }, { id: 'ti', from: 'ISLE', to: 'E.plain', kind: 'then' as const }],
    };
    const ri = sampleGraph(island, { seed: 11, samples: 200 });
    expect('ISLE' in ri.evidence.reach).toBe(false);
    expect(ri.findings.some((f) => f.nodes.includes('ISLE'))).toBe(false);
  });

  it('NODE_NEVER_REACHED for a structurally reachable node only — never for WP2 orphans', () => {
    const nnr = r.findings.filter((f) => f.code === 'NODE_NEVER_REACHED').map((f) => f.nodes[0]).sort();
    expect(nnr).toEqual(['E.big', 'E.impossible']);
    expect(sampleGraph(offerGraph(), { seed: 11, samples: 0 }).findings.some((f) => f.code === 'NODE_NEVER_REACHED')).toBe(false);
  });
});

describe('domains, cohorts, floors', () => {
  it('a write that leaves the domain is clamped AND recorded', () => {
    const g = softlockGraph();
    const many = { ...g, edges: g.edges.map((e) => (e.id === 'e1' ? { ...e, writes: [{ var: 'coins', op: 'add' as const, value: 9 }] } : e)) };
    const r = sampleGraph(many, { seed: 1, samples: 200 });
    expect(r.domainEvents).toEqual([{ var: 'coins', edge: 'e1', kind: 'clamped', attempted: 9, count: r.outcomes.uniform.endings['E.rich'] }]);
  });

  it('named cohorts key the reach map; a weighted cohort follows its weights', () => {
    const r = sampleGraph(minimumGraph(), {
      seed: 1, samples: 500,
      cohorts: [{ id: 'uniform', policy: 'uniform' }, { id: 'taker', policy: 'weighted', weights: { take: 1, refuse: 0 } }],
    });
    expect(r.evidence.reach.E1).toEqual({ uniform: r.evidence.reach.E1.uniform, taker: 100 });
    expect(r.evidence.reach.E2.taker).toBe(0); // the taker cohort covered E2 and never reached it: measured
    expect(r.evidence.runs[0].cohorts).toEqual(['uniform', 'taker']);
    expect(r.evidence.runs[0].n).toBe(1000);
  });

  it('ENDING_BELOW_FLOOR fires per cohort under a declared floor', () => {
    const r = sampleGraph(minimumGraph(), { seed: 1, samples: 400, floors: { E1: 60 } });
    const f = r.findings.filter((x) => x.code === 'ENDING_BELOW_FLOOR');
    expect(f).toHaveLength(1);
    expect(f[0].nodes).toEqual(['E1']);
    expectLead(f[0]);
  });

  it('a sampled run without a graph hash is unverified (null), with one it is pinned', () => {
    expect(sampleGraph(minimumGraph(), { seed: 1, samples: 10 }).evidence.runs[0].graphHash).toBeNull();
    expect(sampleGraph(minimumGraph(), { seed: 1, samples: 10, graphHash: 'sha256:x' }).evidence.runs[0].graphHash).toBe('sha256:x');
  });
});
