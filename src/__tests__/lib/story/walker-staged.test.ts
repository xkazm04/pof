/**
 * WP3 acceptance 6 and the staged-graph leads.
 *
 *   - 2,000 walks over the 10,739-node staged `synthetic-scale` document in UNDER 30 s, measured;
 *   - the same over a COMMITTED 10k-node `generateStoryGraph` document, so CI has a number even
 *     where the staged data is absent;
 *   - every SOFTLOCK_LEAD found on the three staged documents replays (`replayLead`).
 *
 * The staged files are gitignored contest data, looked up where WP1/WP2 look. The staged block
 * SKIPS LOUDLY when they are absent: a missing input is not a passing gate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ARENA_DATA_DIR } from './orrery/_fixtures';
import { parseStoryGraph } from '@/lib/story/importer';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { sampleGraph } from '@/lib/story/walker';
import { replayLead } from '@/lib/story/walker-replay';
import { countFindings } from '@/lib/story/validate';
import { logger } from '@/lib/logger';
import type { StoryGraph } from '@/lib/story/types';

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
    it(`${name}: every finding is a state-altitude lead, and every SOFTLOCK_LEAD replays`, () => {
      const g = load(name);
      const r = sampleGraph(g, { seed: 1, samples: 2000 });
      for (const f of r.findings) {
        expect(f.altitude).toBe('state');
        expect(f.lead).toBeDefined();
      }
      const locks = r.findings.filter((f) => f.code === 'SOFTLOCK_LEAD');
      for (const f of locks) {
        const replay = replayLead(g, f.lead!);
        expect(replay.reproduced, `${name} ${f.nodes[0]}: ${replay.reason}`).toBe(true);
        expect(replay.node).toBe(f.nodes[0]);
      }
      // Hand-verified true leads (the graph, not the walker): pof-exemplars' Q.collect gate needs
      // coresCollected >= 3 and nothing but that gate's own edge ever writes it; synthetic-scale's
      // ACT8.gate has no edge for "every standing < 60 and renown >= 20".
      if (name === 'pof-exemplars') expect(locks.map((f) => f.nodes[0])).toContain('Q.collect');
      if (name === 'synthetic-scale') expect(locks.map((f) => f.nodes[0])).toContain('ACT8.gate');
    });
  }
});
