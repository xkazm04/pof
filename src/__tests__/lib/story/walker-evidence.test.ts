/**
 * WP3 acceptance 7: imported evidence outranks sampled; a mismatched graphHash is stale; a null
 * graphHash is unverified; only verified passes; unmeasured stays absent.
 */
import { describe, it, expect } from 'vitest';
import { cellPasses, mergeEvidence, runStatus, toStoryEvidence } from '@/lib/story/evidence';
import type { StoryEvidence } from '@/lib/story/types';

const H = 'sha256:current';
const imported = (graphHash: string | null): StoryEvidence => ({
  runs: [{ runId: 'sim', engine: 'season-sim', n: 960, graphHash, cohorts: ['schemer', 'uniform'] }],
  reach: { 'S-5': { schemer: 98.1, uniform: 40 }, 'E.x': { schemer: 3 } },
  unit: 'percent of runs, per cohort',
});
const sampled: StoryEvidence = {
  runs: [{ runId: 'walk', engine: 'pof-walker@1', n: 2000, graphHash: H, cohorts: ['uniform'] }],
  reach: { 'S-5': { uniform: 55.5 }, 'S-6': { uniform: 12 } },
};

describe('mergeEvidence', () => {
  it('imported outranks sampled for the same (node, cohort); the sampled value is kept as shadowed', () => {
    const m = mergeEvidence({ currentHash: H, imported: imported(H), sampled });
    expect(m.reach['S-5'].uniform).toMatchObject({ value: 40, source: 'imported', runId: 'sim', status: 'verified' });
    expect(m.reach['S-5'].uniform.shadowed).toMatchObject({ value: 55.5, source: 'sampled', status: 'verified' });
    expect(m.reach['S-6'].uniform).toMatchObject({ value: 12, source: 'sampled', runId: 'walk', status: 'verified' });
    expect(cellPasses(m.reach['S-5'].uniform)).toBe(true);
  });

  it('a mismatched graphHash is STALE and never passes', () => {
    const m = mergeEvidence({ currentHash: H, imported: imported('sha256:older'), sampled });
    expect(m.runs.find((r) => r.runId === 'sim')!.status).toBe('stale');
    expect(m.reach['S-5'].schemer.status).toBe('stale');
    expect(m.reach['S-5'].uniform.status).toBe('stale'); // still outranks; renders stale
    expect(cellPasses(m.reach['S-5'].schemer)).toBe(false);
  });

  it('a null graphHash is UNVERIFIED and never passes', () => {
    const m = mergeEvidence({ currentHash: H, imported: imported(null) });
    expect(m.reach['E.x'].schemer.status).toBe('unverified');
    expect(cellPasses(m.reach['E.x'].schemer)).toBe(false);
    expect(runStatus({ graphHash: null }, H)).toBe('unverified');
  });

  it('a cohort no run declares is unverified; unmeasured nodes stay absent', () => {
    const m = mergeEvidence({ currentHash: H, sampled: { runs: sampled.runs, reach: { A: { ghost: 5 } } } });
    expect(m.reach.A.ghost).toMatchObject({ runId: null, status: 'unverified' });
    expect('S-5' in m.reach).toBe(false);
  });

  it('the plain StoryEvidence carries every run and the winning values', () => {
    const e = toStoryEvidence(mergeEvidence({ currentHash: H, imported: imported(H), sampled }));
    expect(e.runs.map((r) => r.runId)).toEqual(['sim', 'walk']);
    expect(e.reach['S-5']).toEqual({ schemer: 98.1, uniform: 40 });
    expect('source' in e.runs[0]).toBe(false);
  });
});
