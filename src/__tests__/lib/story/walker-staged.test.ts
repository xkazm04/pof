/**
 * WP3 acceptance 6, the staged-graph leads, and the wave-4 amendments on real data.
 *
 *   - 2,000 walks over the 10,739-node staged `synthetic-scale` document in UNDER 30 s, measured;
 *   - the same over a COMMITTED 10k-node `generateStoryGraph` document, so CI has a number even
 *     where the staged data is absent;
 *   - every SOFTLOCK_LEAD and LIVELOCK_LEAD found on the three staged documents replays;
 *   - IDENTITY: graphs without `mode: 'all'` walk exactly as before the wave-4 amendments — the
 *     report, with the new explicit zeros dropped and livelocked walks folded back into
 *     `truncated`, hashes to the value the pre-amendment walker produced (pinned below, measured
 *     2026-11-01 at seed 1 x 2,000 walks);
 *   - mage-arena's START as a three-thread `mode: 'all'` fork.
 *
 * The staged files are gitignored contest data, looked up where WP1/WP2 look. The staged blocks
 * SKIP LOUDLY when they are absent: a missing input is not a passing gate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ARENA_DATA_DIR } from './orrery/_fixtures';
import { parseStoryGraph } from '@/lib/story/importer';
import { canonicalize } from '@/lib/story/canonical';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { createWalker, sampleGraph } from '@/lib/story/walker';
import { replayFinding } from '@/lib/story/walker-replay';
import { offerGraph, softlockGraph } from '@/lib/story/walker-fixtures';
import { countFindings } from '@/lib/story/validate';
import { logger } from '@/lib/logger';
import type { StoryGraph, WalkerReport } from '@/lib/story/types';

const DIRS = [
  ARENA_DATA_DIR,
  path.resolve(process.cwd(), 'public', 'orrery-fixtures'),
  path.resolve(process.cwd(), '.contest', 'staging', 'storymap', 'data'),
];
const find = (file: string) => DIRS.map((d) => path.join(d, file)).find((p) => fs.existsSync(p));
const STAGED = ['synthetic-scale', 'mage-arena-season', 'pof-exemplars'] as const;
const FILES = Object.fromEntries(STAGED.map((n) => [n, find(`${n}.json`)]));
const missing = STAGED.filter((n) => !FILES[n]);
if (missing.length > 0) {
  console.error(`[storygraph-walker] staged ${missing.join(', ')} not found in ${DIRS.join(' | ')} — the staged timing and lead replay are SKIPPED, not passing.`);
}
const load = (name: string): StoryGraph => {
  const r = parseStoryGraph(fs.readFileSync(FILES[name]!, 'utf8'));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const BUDGET_MS = 30_000;

/** The report as the pre-amendment walker shaped it: no explicit zeros, livelocks counted as truncations. */
function legacyHash(r: WalkerReport): string {
  const reach: Record<string, Record<string, number>> = {};
  for (const [n, row] of Object.entries(r.evidence.reach)) {
    const kept = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== 0));
    if (Object.keys(kept).length > 0) reach[n] = kept;
  }
  const outcomes = Object.fromEntries(Object.entries(r.outcomes).map(([c, { livelocked, ...o }]) => [c, { ...o, truncated: o.truncated + (livelocked ?? 0) }]));
  const truncatedAt: Record<string, number> = { ...r.truncatedAt };
  for (const [k, v] of Object.entries(r.livelockedAt ?? {})) truncatedAt[k] = (truncatedAt[k] ?? 0) + v;
  const rest: Partial<WalkerReport> = { ...r };
  delete rest.livelockedAt;
  const legacy = { ...rest, evidence: { ...r.evidence, reach }, outcomes, truncatedAt, findings: r.findings.filter((f) => f.code !== 'LIVELOCK_LEAD') };
  return createHash('sha256').update(canonicalize(legacy)).digest('hex').slice(0, 16);
}
/** Pre-amendment report hashes (seed 1, 2,000 walks), measured before the wave-4 change landed. */
const PINNED: Record<string, string> = {
  'synthetic-scale': 'da1c6b6870ee9533', 'mage-arena-season': '40c7c325f60780c1', 'pof-exemplars': '58ce8bab0aa41975',
  gen600: 'dfb77d9dfcdb8334', softlock: '16c68f3bd9d09ac6', offer: '48ad627ed1bbe4fa',
};

describe('committed 10k-node fixture (CI timing)', () => {
  it('2,000 walks over generateStoryGraph({nodes: 10000}) complete under 30 s, measured', () => {
    const g = generateStoryGraph({ nodes: 10000, seed: 1 });
    const t0 = performance.now();
    const r = sampleGraph(g, { seed: 1, samples: 2000 });
    const ms = performance.now() - t0;
    logger.info(`[storygraph-walker] generated 10,000 nodes x 2,000 walks: ${ms.toFixed(0)} ms, ${r.steps} steps`);
    expect(ms).toBeLessThan(BUDGET_MS);
    // A clean graph: every walk ends at one of its two endings.
    const o = r.outcomes.uniform;
    expect(Object.values(o.endings).reduce((a, b) => a + b, 0)).toBe(2000);
    expect(r.findings.filter((f) => f.code === 'SOFTLOCK_LEAD')).toEqual([]);
  });
});

describe('identity without mode: all (committed graphs)', () => {
  const cases: [string, () => StoryGraph][] = [['gen600', () => generateStoryGraph({ nodes: 600, seed: 7 })], ['softlock', softlockGraph], ['offer', offerGraph]];
  for (const [name, make] of cases) {
    it(`${name}: same leads and outcomes as the pre-amendment walker (only explicit zeros are new)`, () => {
      expect(legacyHash(sampleGraph(make(), { seed: 1, samples: 2000 }))).toBe(PINNED[name]);
    });
  }
});

describe.skipIf(missing.length > 0)('staged documents', () => {
  it('2,000 walks over the 10,739-node synthetic-scale document complete under 30 s, measured', () => {
    const g = load('synthetic-scale');
    expect(g.nodes).toHaveLength(10739);
    const t0 = performance.now();
    const r = sampleGraph(g, { seed: 1, samples: 2000 });
    const ms = performance.now() - t0;
    logger.info(`[storygraph-walker] synthetic-scale 10,739 nodes x 2,000 walks: ${ms.toFixed(0)} ms, ${r.steps} steps, ${JSON.stringify(countFindings(r.findings).byCode)}`);
    expect(ms).toBeLessThan(BUDGET_MS);
    expect(r.gradeable).toBe(false); // ACT7.hub carries an `expr` guard (§6)
  });

  for (const name of STAGED) {
    it(`${name}: leads and outcomes unchanged, every SOFTLOCK/LIVELOCK lead replays, zeros are exactly the never-reached`, () => {
      const g = load(name);
      const r = sampleGraph(g, { seed: 1, samples: 2000 });
      expect(legacyHash(r)).toBe(PINNED[name]);
      for (const f of r.findings) {
        expect(f.altitude).toBe('state');
        expect(f.lead).toBeDefined();
      }
      // Measured zero: a node every cohort shows as 0 is exactly a NODE_NEVER_REACHED lead.
      const zeros = Object.entries(r.evidence.reach).filter(([, row]) => Object.values(row).every((v) => v === 0)).map(([id]) => id).sort();
      expect(zeros).toEqual(r.findings.filter((f) => f.code === 'NODE_NEVER_REACHED').map((f) => f.nodes[0]).sort());
      const locks = r.findings.filter((f) => f.code === 'SOFTLOCK_LEAD');
      for (const f of locks) {
        const replay = replayFinding(g, f);
        expect(replay.reproduced, `${name} ${f.nodes[0]}: ${replay.reason}`).toBe(true);
        expect(replay.node).toBe(f.nodes[0]);
      }
      const loops = r.findings.filter((f) => f.code === 'LIVELOCK_LEAD');
      for (const f of loops) {
        const replay = replayFinding(g, f);
        expect(replay.reproduced, `${name} ${f.nodes.join('+')}: ${replay.reason}`).toBe(true);
        expect(f.nodes).toContain(replay.node);
      }
      const o = r.outcomes.uniform;
      logger.info(`[storygraph-walker] ${name}: ${loops.length} LIVELOCK_LEAD (${o.livelocked ?? 0} walks), truncated ${o.truncated}, explicit zeros ${zeros.length}`);
      // Hand-verified true leads (the graph, not the walker): pof-exemplars' Q.collect gate needs
      // coresCollected >= 3 and nothing but that gate's own edge ever writes it; synthetic-scale's
      // ACT8.gate has no edge for "every standing < 60 and renown >= 20".
      if (name === 'pof-exemplars') expect(locks.map((f) => f.nodes[0])).toContain('Q.collect');
      if (name === 'synthetic-scale') {
        expect(locks.map((f) => f.nodes[0])).toContain('ACT8.gate');
        // The seeded DEAD1/DEAD2 side roads loop with no way out: every walk caught there was only
        // `truncated` before; each is now a livelock, and no walk is merely truncated.
        expect(loops.map((f) => f.nodes.join('+')).sort()).toEqual(['DEAD1a+DEAD1b', 'DEAD2a+DEAD2b']);
        expect(o.truncated).toBe(0);
        expect(o.livelocked).toBe(Object.values(r.livelockedAt ?? {}).reduce((a, b) => a + b, 0));
      } else expect(loops).toEqual([]);
    });
  }
});

describe.skipIf(missing.length > 0)("mage-arena's START as a three-thread fork (mode: 'all')", () => {
  it('every thread runs in every walk, one outcome per walk; seeded and chunk-invariant; leads carry threads', () => {
    const base = load('mage-arena-season');
    const g: StoryGraph = { ...base, edges: base.edges.map((e) => (e.from === 'START' ? { ...e, mode: 'all' as const } : e)) };
    const r = sampleGraph(g, { seed: 1, samples: 2000 });
    const one = sampleGraph(base, { seed: 1, samples: 2000 });
    for (const id of ['CP1.1', 'CP1.2', 'B1.4']) {
      expect(r.evidence.reach[id].uniform).toBe(100);
      expect(one.evidence.reach[id].uniform).toBeLessThan(50); // one-of: about a third each
    }
    const o = r.outcomes.uniform;
    expect(Object.values(o.endings).reduce((a, b) => a + b, 0) + o.stalled + o.terminal + o.truncated).toBe(2000);
    expect(canonicalize(sampleGraph(g, { seed: 1, samples: 2000 }))).toBe(canonicalize(r));
    const w = createWalker(g, { seed: 1, samples: 2000 });
    while (w.done() < w.total) w.run(37);
    expect(canonicalize(w.report())).toBe(canonicalize(r));
    const threaded = r.findings.filter((f) => f.lead?.threads);
    expect(threaded.length).toBeGreaterThan(0);
    for (const f of threaded) expect(f.lead!.threads).toHaveLength(f.lead!.path.length);
    for (const f of r.findings.filter((x) => x.code === 'SOFTLOCK_LEAD' || x.code === 'LIVELOCK_LEAD')) expect(replayFinding(g, f).reproduced).toBe(true);
  });
});
