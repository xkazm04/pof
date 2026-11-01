/**
 * The Orrery's per-cell STATUS channel (`@/lib/story/orrery/status`, read through `lensStatus`):
 * every displayed figure carries the status of the evidence it came from, the same merged evidence
 * the lens value comes from. Doubt never passes; unmeasured has no status.
 */

import { describe, expect, it } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { buildMergedModel, mergeWalkEvidence } from '@/lib/story/orrery/walk';
import { lensModeOf } from '@/components/story/orrery/render/lod';
import { lensStatus } from '@/components/story/orrery/render/statusMark';
import { HASH, IMPORTED, SAMPLED_REACH, graph, report } from '@/__tests__/lib/story/orrery/_statusFixture';
import type { OrreryModel } from '@/lib/story/orrery';
import type { StoryEvidence, StoryGraph, WalkerReport } from '@/lib/story/types';

function statusOf(model: OrreryModel, id: string, lens: string | null) {
  const i = model.idx.get(id);
  if (i === undefined) throw new Error(`no node ${id}`);
  return lensStatus(model, model.R[i], lensModeOf(model, lens));
}

function merged(g: StoryGraph, r: Pick<WalkerReport, 'evidence'>, hash = HASH): OrreryModel {
  return buildMergedModel(g, 'k', mergeWalkEvidence(g, hash, r));
}

describe('status channel: merged evidence (imported unverified + sampled verified)', () => {
  const model = merged(graph(IMPORTED), report(HASH, SAMPLED_REACH));

  it('each node/cohort pair carries its own cell status', () => {
    expect(statusOf(model, 'l1', 'fighter')).toBe('unverified');
    expect(statusOf(model, 'l2', 'fighter')).toBe('unverified');
    expect(statusOf(model, 'l1', 'uniform')).toBe('verified');
    expect(statusOf(model, 'end', 'uniform')).toBe('verified');
    // `end` has no fighter cell: unmeasured, so no status.
    expect(statusOf(model, 'end', 'fighter')).toBeNull();
  });

  it('switching the lens cohort switches the status', () => {
    for (const id of ['l1', 'l2', 'l3', 'sc1', 'sc2', 'act']) {
      expect(statusOf(model, id, 'fighter')).toBe('unverified');
      expect(statusOf(model, id, 'uniform')).toBe('verified');
    }
  });

  it('the kind lens (no lens) has no status anywhere', () => {
    for (const id of ['l1', 'sc1', 'act', 'end']) expect(statusOf(model, id, null)).toBeNull();
  });

  it('the divergence lens takes the worst over every cohort', () => {
    expect(statusOf(model, 'l1', '__diverge')).toBe('unverified');
  });
});

describe('status channel: stale', () => {
  it('a sampled run pinned to another revision is stale (hash mismatch), never verified', () => {
    const model = merged(graph(), report('sha256:old', SAMPLED_REACH));
    expect(statusOf(model, 'l1', 'uniform')).toBe('stale');
    expect(statusOf(model, 'sc1', 'uniform')).toBe('stale');
  });

  it('a plain document reads its run against the current hash', () => {
    const ev: StoryEvidence = { runs: [{ runId: 'r', engine: 'x', n: 9, graphHash: 'sha256:old', cohorts: ['c'] }], reach: { l1: { c: 5 } } };
    expect(statusOf(buildOrreryModel(graph(ev), 'k', { currentHash: HASH }), 'l1', 'c')).toBe('stale');
    expect(statusOf(buildOrreryModel(graph(ev), 'k', { currentHash: 'sha256:old' }), 'l1', 'c')).toBe('verified');
    // No current hash known at all: a pinned run cannot be checked, so it is unverified (not a pass,
    // and not a stale claim either).
    expect(statusOf(buildOrreryModel(graph(ev), 'k'), 'l1', 'c')).toBe('unverified');
  });

  it('a row cohort no run declares is unverified', () => {
    const ev: StoryEvidence = {
      runs: [{ runId: 'r', engine: 'x', n: 9, graphHash: HASH, cohorts: ['c'] }],
      reach: { l1: { c: 5, stray: 7 } },
    };
    const model = buildOrreryModel(graph(ev), 'k', { currentHash: HASH });
    expect(statusOf(model, 'l1', 'c')).toBe('verified');
    expect(statusOf(model, 'l1', 'stray')).toBe('unverified');
  });
});

describe('status channel: unmeasured and containers', () => {
  const model = merged(graph(IMPORTED), report(HASH, SAMPLED_REACH));

  it('an unmeasured node has no status', () => {
    expect(statusOf(model, 'l4', 'uniform')).toBeNull();
    expect(statusOf(model, 'l5', 'fighter')).toBeNull();
  });

  it('a container with no measured descendant has no status', () => {
    expect(statusOf(model, 'sc3', 'uniform')).toBeNull();
    expect(statusOf(model, 'sc3', 'fighter')).toBeNull();
  });

  it('a derived container takes the WORST status of the measured descendants that fed its mean', () => {
    // One cohort, two sources: l1 is imported (unverified), l3 sampled (verified).
    const imp: StoryEvidence = {
      runs: [{ runId: 'imp', engine: 'fix', n: 50, graphHash: null, cohorts: ['uniform'] }],
      reach: { l1: { uniform: 40 } },
    };
    const m = merged(graph(imp), report(HASH, { l3: { uniform: 20 } }));
    expect(statusOf(m, 'l1', 'uniform')).toBe('unverified');
    expect(statusOf(m, 'l3', 'uniform')).toBe('verified');
    expect(statusOf(m, 'sc1', 'uniform')).toBe('unverified');
    expect(statusOf(m, 'sc2', 'uniform')).toBe('verified');
    // Doubt never passes: the act's mean blends both, so it is unverified.
    expect(statusOf(m, 'act', 'uniform')).toBe('unverified');
  });

  it('stale outranks unverified in a container', () => {
    const imp: StoryEvidence = {
      runs: [{ runId: 'imp', engine: 'fix', n: 50, graphHash: null, cohorts: ['uniform'] }],
      reach: { l1: { uniform: 40 } },
    };
    const m = merged(graph(imp), report('sha256:old', { l3: { uniform: 20 } }));
    expect(statusOf(m, 'act', 'uniform')).toBe('stale');
  });
});

describe('status channel: no evidence', () => {
  it('a document with no evidence has no status for any node or lens', () => {
    const model = buildOrreryModel(graph(), 'k', { currentHash: HASH });
    expect(model.status?.cohorts).toEqual([]);
    for (const n of model.R) {
      expect(lensStatus(model, n, { mode: 'cohort', cohort: 'uniform' })).toBeNull();
      expect(lensStatus(model, n, lensModeOf(model, 'uniform'))).toBeNull();
    }
  });
});
