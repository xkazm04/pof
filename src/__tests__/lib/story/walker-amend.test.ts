/**
 * The section-12 walker amendments (wave 4): `mode: 'all'` parallel threads, ending floors in both
 * forms, and LIVELOCK_LEAD — each with a positive and a negative case, each lead replayed. The
 * measured-zero rule is in `walker.test.ts`; the staged graphs (mage-arena's three-thread START,
 * synthetic-scale's DEAD loops, the identity pins) in `walker-staged.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { canonicalize } from '@/lib/story/canonical';
import { createWalker, sampleGraph, WALKER_ENGINE } from '@/lib/story/walker';
import { replayFinding, replayLead } from '@/lib/story/walker-replay';
import { forkGraph, livelockGraph, softlockGraph } from '@/lib/story/walker-fixtures';
import { storyGraphSchema } from '@/lib/story/schema';
import type { StoryGraph } from '@/lib/story/types';

const LEAD = 'A lead to reproduce, not a proven defect.';

describe("mode: 'all' — parallel threads", () => {
  const g = forkGraph();
  const r = sampleGraph(g, { seed: 3, samples: 2000 });

  it('every holding parallel edge spawns a thread; a failing guard spawns none (C is a measured 0)', () => {
    expect(storyGraphSchema.safeParse(g).success).toBe(true);
    expect(r.evidence.reach.A.uniform).toBe(100);
    expect(r.evidence.reach.B.uniform).toBe(100);
    expect(r.evidence.reach.C).toEqual({ uniform: 0 });
    expect(r.findings.filter((f) => f.code === 'NODE_NEVER_REACHED').map((f) => f.nodes[0])).toEqual(['C']);
  });

  it('a guard is a join: the first thread at J waits for the other write, then the threads merge — one ending per walk', () => {
    expect(r.outcomes.uniform).toEqual({ samples: 2000, endings: { 'E.done': 2000 }, stalled: 0, terminal: 0, truncated: 0 });
    expect(r.evidence.reach.J.uniform).toBe(100); // reach counts J once per walk, whichever threads arrive
    expect(r.findings.some((f) => f.code === 'SOFTLOCK_LEAD')).toBe(false);
  });

  it('seeded, byte-identical and chunking-invariant', () => {
    const again = sampleGraph(g, { seed: 3, samples: 2000 });
    expect(canonicalize(again)).toBe(canonicalize(r));
    const w = createWalker(g, { seed: 3, samples: 2000 });
    while (w.done() < w.total) w.run(13);
    expect(canonicalize(w.report())).toBe(canonicalize(r));
  });

  it('every live thread blocked is a stall; the lead carries thread identity and replays', () => {
    const gs = forkGraph({ needsC: true });
    const rs = sampleGraph(gs, { seed: 3, samples: 500 });
    expect(rs.outcomes.uniform.stalled).toBe(500);
    const lock = rs.findings.find((f) => f.code === 'SOFTLOCK_LEAD')!;
    expect(lock.nodes).toEqual(['J']);
    expect(lock.lead!.state).toMatchObject({ a: true, b: true, c: false });
    expect(lock.lead!.threads).toHaveLength(lock.lead!.path.length);
    expect(new Set(lock.lead!.threads)).toEqual(new Set([0, 1]));
    const replay = replayFinding(gs, lock);
    expect(replay.reproduced, replay.reason).toBe(true);
    expect(replay.node).toBe('J');
    // Without thread identity the path is not one walk: the replay refuses it.
    expect(replayLead(gs, { ...lock.lead!, threads: undefined }).reproduced).toBe(false);
    expect(replayLead(gs, { ...lock.lead!, state: { ...lock.lead!.state, b: false } }).reproduced).toBe(false);
  });

  it("an explicit mode: 'any' is the default: byte-identical to mode omitted", () => {
    const base = softlockGraph();
    const anyMode: StoryGraph = { ...base, edges: base.edges.map((e) => (e.kind === 'then' ? { ...e, mode: 'any' as const } : e)) };
    expect(canonicalize(sampleGraph(anyMode, { seed: 5, samples: 300 }))).toBe(canonicalize(sampleGraph(base, { seed: 5, samples: 300 })));
  });
});

describe('ending floors (endings[].floor)', () => {
  // E.home: uniform ~49%, `home` cohort 100%, `looper` cohort 0%.
  const cohorts = [
    { id: 'uniform', policy: 'uniform' as const },
    { id: 'home', policy: 'weighted' as const, weights: { loop: 0, out: 1 } },
    { id: 'looper', policy: 'weighted' as const, weights: { loop: 1, out: 0 } },
  ];
  const withFloor = (floor: number | Record<string, number>): StoryGraph => {
    const g = livelockGraph(3);
    return { ...g, endings: g.endings.map((e) => (e.node === 'E.home' ? { ...e, floor } : e)) };
  };
  const below = (g: StoryGraph, floors?: Record<string, number>) =>
    sampleGraph(g, { seed: 2, samples: 400, cohorts, floors }).findings.filter((f) => f.code === 'ENDING_BELOW_FLOOR');
  const cohortOf = (detail: string) => /% of (\w+) walks/.exec(detail)![1];

  it('a number applies to every cohort; an ending exactly AT its floor is not flagged', () => {
    const f = below(withFloor(100));
    expect(f.map((x) => cohortOf(x.detail)).sort()).toEqual(['looper', 'uniform']); // home is at 100, not under
    for (const x of f) {
      expect(x.nodes).toEqual(['E.home']);
      expect(x.altitude).toBe('state');
      expect(x.detail).toContain(LEAD);
      expect(x.lead).toMatchObject({ seed: 2, engine: WALKER_ENGINE, samples: 400 });
    }
    expect(below(withFloor(100))).toEqual(f); // the seed reproduces the lead exactly
  });

  it('a record applies only to the cohorts it names; an omitted cohort has no floor', () => {
    expect(below(withFloor({ uniform: 60 })).map((x) => cohortOf(x.detail))).toEqual(['uniform']);
    expect(below(withFloor({ home: 100, looper: 0 }))).toEqual([]); // both exactly at their floors
    expect(below(withFloor({ nobody: 50 }))).toEqual([]);
  });

  it('WalkerOptions.floors overrides the declared floor by ending id', () => {
    expect(below(withFloor(100), { 'E.home': 0 })).toEqual([]);
    expect(below(livelockGraph(3), { 'E.home': 100 }).map((x) => cohortOf(x.detail)).sort()).toEqual(['looper', 'uniform']);
  });
});

describe('LIVELOCK_LEAD', () => {
  it('a closed loop with no ending in any domain state is a livelock lead, not a truncation; it replays', () => {
    const g = livelockGraph(5);
    const r = sampleGraph(g, { seed: 4, samples: 1000 });
    const ll = r.findings.filter((f) => f.code === 'LIVELOCK_LEAD');
    expect(ll).toHaveLength(1);
    expect(ll[0].nodes).toEqual(['L1', 'L2']);
    expect(ll[0].detail).toContain(LEAD);
    expect(ll[0].lead!.state).toEqual({ n: 3 }); // the first state inside the loop: the counter saturated
    const o = r.outcomes.uniform;
    expect(o.truncated).toBe(0);
    expect(o.livelocked).toBe(1000 - o.endings['E.home']);
    expect(Object.values(r.livelockedAt!).reduce((a, b) => a + b, 0)).toBe(o.livelocked);
    const replay = replayFinding(g, ll[0]);
    expect(replay.reproduced, replay.reason).toBe(true);
    expect(ll[0].nodes).toContain(replay.node);
    // Before the counter saturates the walk is not yet inside the loop: the claim does not replay there.
    expect(replayLead(g, { ...ll[0].lead!, path: ['START', 'HUB', 'L1', 'L2'], state: { n: 1 } }, undefined, 'livelock').reproduced).toBe(false);
    expect(replayLead(g, ll[0].lead!, undefined, 'softlock').reproduced).toBe(false); // it moves: not a softlock
  });

  it('a long walk that can still exit stays truncated only', () => {
    const r = sampleGraph(livelockGraph(3), { seed: 4, samples: 1000, maxSteps: 3 });
    expect(r.outcomes.uniform.truncated).toBeGreaterThan(400);
    expect(r.outcomes.uniform.livelocked).toBeUndefined();
    expect(r.livelockedAt).toBeUndefined();
    expect(r.findings.some((f) => f.code === 'LIVELOCK_LEAD')).toBe(false);
  });

  it('guards nobody can read stay optimistic: an expr exit is never claimed closed', () => {
    const g = livelockGraph(5);
    const untyped: StoryGraph = { ...g, edges: g.edges.map((e) => (e.id === 'l5' ? { ...e, when: { expr: 'the well runs dry' } } : e)) };
    const r = sampleGraph(untyped, { seed: 4, samples: 300, maxSteps: 3 });
    expect(r.gradeable).toBe(false);
    expect(r.findings.some((f) => f.code === 'LIVELOCK_LEAD')).toBe(false);
  });

  it('walk history is abstracted, never guessed: a visited-guarded exit is not claimed closed', () => {
    const g = livelockGraph(5);
    const hist: StoryGraph = { ...g, edges: g.edges.map((e) => (e.id === 'l5' ? { ...e, when: { not: { visited: 'L2' } } } : e)) };
    const r = sampleGraph(hist, { seed: 4, samples: 300 });
    expect(r.findings.some((f) => f.code === 'LIVELOCK_LEAD')).toBe(false);
    expect(r.outcomes.uniform.truncated).toBeGreaterThan(0); // stuck in practice, but no sound claim
  });
});
