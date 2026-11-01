/**
 * The Orrery's live-walk helpers: "graph + walker report" -> the evidence the lens reads, and
 * "leads" -> Audit rows that never join the structural count.
 */

import { describe, expect, it } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery';
import { lensModeOf, lensValue } from '@/components/story/orrery/render/lod';
import {
  LEADS_GROUP_ID,
  LEADS_GROUP_TITLE,
  buildMergedModel,
  cohortStatuses,
  compactPath,
  mergeWalkEvidence,
  sampledLabel,
  withLeads,
  worstCellStatus,
} from '@/lib/story/orrery/walk';
import { honestyGraph, ix } from '@/__tests__/components/story/orrery/panelFixture';
import { HASH, walkReport } from '@/__tests__/components/story/walkFixture';
import type { StoryFinding, StoryGraph } from '@/lib/story/types';

const noImported = (): StoryGraph => {
  const g = honestyGraph();
  return { ...g, evidence: undefined };
};

describe('mergeWalkEvidence / buildMergedModel', () => {
  it('imported outranks sampled for the same cell, and keeps the sampled value as shadowed', () => {
    const merged = mergeWalkEvidence(honestyGraph(), HASH, walkReport());
    expect(merged.reach['l.half'].all).toMatchObject({ value: 50, source: 'imported', status: 'unverified' });
    expect(merged.reach['l.half'].all.shadowed).toMatchObject({ value: 70, source: 'sampled', status: 'verified' });
    expect(merged.reach['l.half'].uniform).toMatchObject({ value: 100, source: 'sampled', status: 'verified' });
  });

  it('the lens reads the sampled cohort even though the imported run is listed first', () => {
    const g = honestyGraph();
    const model = buildMergedModel(g, 'fixture', mergeWalkEvidence(g, HASH, walkReport()));
    expect(model.cohorts).toEqual(['all', 'uniform']);
    const lens = lensModeOf(model, 'uniform');
    expect(lens).toEqual({ mode: 'cohort', cohort: 'uniform' });
    expect(lensValue(model, model.R[ix(model, 'l.zero')], lens)).toEqual({ state: 'measured', value: 100 });
    // A sampled 0 is a measured zero; an absent node is unmeasured — never 0.
    expect(lensValue(model, model.R[ix(model, 'l.none')], lens)).toEqual({ state: 'measured', value: 0 });
    expect(lensValue(model, model.R[ix(model, 'l.ghost')], lens)).toEqual({ state: 'unmeasured' });
    expect(model.R[ix(model, 'l.ghost')].reach).toBeNull();
    // The imported cohort still reads its own (winning) values.
    expect(lensValue(model, model.R[ix(model, 'l.half')], lensModeOf(model, 'all'))).toEqual({ state: 'measured', value: 50 });
  });

  it('never leaks the internal view run: raw.evidence and prov.runs are the real runs', () => {
    const g = honestyGraph();
    const model = buildMergedModel(g, 'fixture', mergeWalkEvidence(g, HASH, walkReport()));
    expect(model.prov.runs.map((r) => r.runId)).toEqual(['r1', 'w1']);
    expect(model.raw.evidence?.runs.map((r) => r.runId)).toEqual(['r1', 'w1']);
    expect(model.prov.provisional).toBe(true); // the imported run says so
  });

  it('an unverified imported cell badges the whole lens unverified (doubt never passes)', () => {
    const g = honestyGraph();
    const merged = mergeWalkEvidence(g, HASH, walkReport());
    expect(worstCellStatus(merged)).toBe('unverified');
    expect(buildMergedModel(g, 'fixture', merged).prov.unverified).toBe(true);
  });

  it('sampled-only evidence pinned to the current hash reads verified', () => {
    const g = noImported();
    const merged = mergeWalkEvidence(g, HASH, walkReport());
    expect(worstCellStatus(merged)).toBe('verified');
    const model = buildMergedModel(g, 'fixture', merged);
    expect(model.prov.unverified).toBe(false);
    expect(model.prov.provisional).toBe(false);
  });

  it('a stale imported run is reported stale per cohort, and is never verified', () => {
    const g = honestyGraph();
    const stale: StoryGraph = {
      ...g,
      evidence: { ...g.evidence!, runs: [{ ...g.evidence!.runs[0], graphHash: 'sha256:older' }] },
    };
    const merged = mergeWalkEvidence(stale, HASH, walkReport());
    const by = Object.fromEntries(cohortStatuses(merged).map((c) => [c.cohort, c]));
    expect(by.all.status).toBe('stale');
    expect(by.all.sources).toEqual(['imported']);
    expect(by.uniform.status).toBe('verified');
    expect(by.uniform.sources).toEqual(['sampled']);
    expect(buildMergedModel(stale, 'fixture', merged).prov.unverified).toBe(true);
  });

  it('a report hash that does not match the graph read is unverified-or-stale, not verified', () => {
    const g = noImported();
    const merged = mergeWalkEvidence(g, 'sha256:a-later-revision', walkReport());
    expect(worstCellStatus(merged)).toBe('stale');
    expect(buildMergedModel(g, 'fixture', merged).prov.unverified).toBe(true);
  });
});

describe('withLeads', () => {
  it('adds one labelled group and leaves the structural audit untouched', () => {
    const base = buildOrreryModel(honestyGraph(), 'fixture');
    const model = withLeads(base, walkReport().findings);
    expect(model.auditTotal).toBe(base.auditTotal);
    expect(model.audit.slice(0, -1)).toEqual(base.audit);
    const g = model.audit[model.audit.length - 1];
    expect(g.id).toBe(LEADS_GROUP_ID);
    expect(g.title).toBe(LEADS_GROUP_TITLE);
    expect(g.why).toMatch(/NOT defects/);
    expect(g.why).toMatch(/seed 7/);
    expect(g.items).toHaveLength(1);
    expect(g.items[0].i).toBe(ix(model, 'l.half'));
    expect(g.items[0].text).toContain('SOFTLOCK_LEAD');
    expect(g.items[0].text).toContain('seed 7');
    expect(g.items[0].text).toContain('l.zero › l.half (2 steps)');
  });

  it('skips findings without a lead, and an empty walk still shows a measured zero group', () => {
    const base = buildOrreryModel(honestyGraph(), 'fixture');
    const structural: StoryFinding = { code: 'ORPHAN_NODE', altitude: 'structural', severity: 'warn', nodes: ['l.ghost'], detail: 'x' };
    const g = withLeads(base, [structural]).audit.at(-1)!;
    expect(g.id).toBe(LEADS_GROUP_ID);
    expect(g.items).toEqual([]);
  });

  it('a lead on a node the graph does not carry is listed without a jump target', () => {
    const base = buildOrreryModel(honestyGraph(), 'fixture');
    const f = { ...walkReport().findings[0], nodes: ['nowhere'] };
    expect(withLeads(base, [f]).audit.at(-1)!.items[0].i).toBe(-1);
  });
});

describe('labels', () => {
  it('compactPath elides the middle of a long path', () => {
    const p = Array.from({ length: 12 }, (_, k) => `n${k}`);
    expect(compactPath(p)).toBe('n0 › n1 › n2 › … › n9 › n10 › n11 (12 steps)');
    expect(compactPath([])).toBe('(no path)');
  });

  it('sampledLabel names engine, walks and seed', () => {
    expect(sampledLabel(walkReport())).toBe('sampled (pof-walker@1, 400 walks, seed 7)');
    expect(
      sampledLabel(walkReport({ cohorts: [{ id: 'a', policy: 'uniform' }, { id: 'b', policy: 'uniform' }] })),
    ).toBe('sampled (pof-walker@1, 400 walks per cohort × 2, seed 7)');
  });
});
