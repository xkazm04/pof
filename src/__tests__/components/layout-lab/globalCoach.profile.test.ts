/**
 * scan-sweep --challenge catalog-browser-ui/A — the cross-catalog coach derives each entity
 * against ITS OWN step list (profile-scoped steps, /diablo W05 D18), under ITS canon profile.
 *
 * The coach used to derive against the catalog-wide list with a profile-less entity: for a
 * diablo1 dialog it coached the pof-only 'Skill Checks', and its `stepIndex` (a position in the
 * catalog list) opened a different step on the rail (which renders the entity's own list).
 * The reference for "the entity's own list" here is the stepScope rule itself, so these cases
 * stand independent of the module that now applies it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import '@/lib/catalog/pipelines/registry.generated';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepSummary } from '@/components/layout-lab/stepSummary';

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: vi.fn(async () => ({ ok: true, data: [] })),
  fetchStepSummaryResult: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock('@/components/layout-lab/hooks/useStepJudgeVerdicts', () => ({
  useAllJudgeVerdicts: () => [],
  useCatalogJudgeVerdicts: () => [],
  useStepJudgeVerdicts: () => [],
  invalidateJudgeVerdicts: () => {},
  JUDGE_VERDICT_CACHE_TTL_MS: 60_000,
}));
// Deterministic acceptance: each step grades to its data's `__status` (the matrixRows trick).
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));
// Observe exactly which entities the hook feeds the model (the real model still runs).
vi.mock('@/components/layout-lab/globalCoachModel', async (orig) => {
  const actual = await orig<typeof import('@/components/layout-lab/globalCoachModel')>();
  return {
    ...actual,
    buildCatalogCandidates: vi.fn(actual.buildCatalogCandidates),
    buildCatalogCandidatesFromSummary: vi.fn(actual.buildCatalogCandidatesFromSummary),
  };
});

import {
  buildCatalogCandidates, buildCatalogCandidatesFromSummary, groupSummaryByEntity, type CoachCandidate,
} from '@/components/layout-lab/globalCoachModel';
import { useGlobalCoach, _resetGlobalCoachCache } from '@/components/layout-lab/hooks/useGlobalCoach';
import { deriveEntityArtifacts, type StepDisplayStatus } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { pickLadderIssue } from '@/components/layout-lab/coachLadder';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepLabelsForProfile } from '@/lib/catalog/stepScope';
import { useCatalogStore } from '@/stores/catalogStore';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

type Status = Exclude<StepDisplayStatus, 'unproduced'>;
/** The stepScope rule, applied directly: the steps this entity's rail renders. */
const ownSteps = (c: string, e: LabEntity) => stepLabelsForProfile(getCatalogPipeline(c), resolveCatalogSteps(c), e.canonProfile);
const lab = (id: string, canonProfile: string): LabEntity => ({ id, name: id, lifecycle: 'planned', data: {}, canonProfile });
const art = (c: string, entityId: string, step: string, status: Status): PipelineArtifact =>
  ({ catalogId: c, entityId, step, data: { __status: status }, ueAssets: [], status, tier: 'L0', updatedAt: '2026-09-01T00:00:00.000Z' });

interface Fixture { catalogId: string; entity: LabEntity; statuses: Record<string, Status> }
/** Every own step at `fill` except the overrides; a step set to `undefined` stays unproduced. */
function fx(catalogId: string, id: string, profile: string, fill: Status | null, over: Record<string, Status | null> = {}): Fixture {
  const entity = lab(id, profile);
  const statuses: Record<string, Status> = {};
  for (const s of ownSteps(catalogId, entity)) {
    const v = s in over ? over[s] : fill;
    if (v) statuses[s] = v;
  }
  return { catalogId, entity, statuses };
}
const serverOf = (f: Fixture) =>
  new Map([[f.entity.id, new Map(Object.entries(f.statuses).map(([s, st]) => [s, art(f.catalogId, f.entity.id, s, st)]))]]);
const summaryOf = (f: Fixture): StepSummary[] => Object.entries(f.statuses).map(([step, status]) =>
  ({ entityId: f.entity.id, step, status, tier: 'L0', updatedAt: '2026-09-01T00:00:00.000Z', contentHash: 'h', driftHash: 'd' }));
const candidatesFor = (f: Fixture) => buildCatalogCandidates({
  catalogId: f.catalogId, catalogLabel: f.catalogId, steps: resolveCatalogSteps(f.catalogId),
  entities: [f.entity], serverByEntity: serverOf(f), localByEntity: {},
});
const pick = (c: CoachCandidate | undefined) => (c ? { step: c.step, index: c.stepIndex, priority: c.priority } : null);

const FIXTURES: Fixture[] = [
  fx('dialog-trees', 'd1-pending-gate', 'diablo1', 'pass', { 'Test Gate': 'pending' }),
  fx('dialog-trees', 'd1-deferred-vo', 'diablo1', 'pass', { 'VO Script': 'deferred', 'UE Packaging': null }),
  fx('dialog-trees', 'd1-fresh', 'diablo1', null),
  fx('dialog-trees', 'pof-skill', 'pof', 'pass', { 'Skill Checks': null, 'Localization': 'pending' }),
  fx('bestiary', 'pof-packaging', 'pof', 'pass', { 'UE Packaging': null }),
  fx('bestiary', 'pof-fail-late', 'pof', 'pass', { 'Test Gate': 'fail', 'Stat Block': 'deferred' }),
  fx('bestiary', 'd1-sprite', 'diablo1', 'pass', { 'Sprite Render': null, 'Abilities': 'deferred' }),
  fx('bestiary', 'd1-fresh', 'diablo1', null),
];

beforeEach(() => { _resetArtifactCache(); _resetGlobalCoachCache(); useLabPipelineStore.setState({ byEntity: {} }); });
afterEach(cleanup);

describe('coach candidates are derived against the entity\'s own step list', () => {
  it('a diablo1 dialog whose own steps all pass has NO candidate (never the pof-only "Skill Checks")', () => {
    const f = fx('dialog-trees', 'd1-done', 'diablo1', 'pass');
    expect(Object.keys(f.statuses)).not.toContain('Skill Checks');
    expect(candidatesFor(f)).toEqual([]);
  });

  it('every candidate equals the per-entity NextStepCoach pick, and its index round-trips through the own list', () => {
    for (const f of FIXTURES) {
      const own = ownSteps(f.catalogId, f.entity);
      const server = serverOf(f).get(f.entity.id)!;
      const effective = Object.fromEntries([...server].map(([s, a]) => [s, { done: true, data: a.data, ueAssets: [], at: '' }]));
      const d = deriveEntityArtifacts(f.catalogId, f.entity, own, effective, Object.fromEntries(server));
      const expected = pickLadderIssue(own, d.displayStatus, d.driftByStep);
      const [c] = candidatesFor(f);
      expect({ entity: f.entity.id, pick: pick(c) }).toEqual({ entity: f.entity.id, pick: expected });
      if (c) expect(own[c.stepIndex]).toBe(c.step);
      // The blob-free first-paint path names the same step at the same index.
      const [s] = buildCatalogCandidatesFromSummary({
        catalogId: f.catalogId, catalogLabel: f.catalogId, steps: resolveCatalogSteps(f.catalogId),
        entities: [f.entity], summaryByEntity: groupSummaryByEntity(summaryOf(f)), localByEntity: {},
      });
      expect({ entity: f.entity.id, pick: pick(s) }).toEqual({ entity: f.entity.id, pick: expected });
    }
  });

  it('[guard] the matrix row opens the same index the coach candidate names (matrixRows unchanged)', () => {
    for (const f of FIXTURES) {
      const [c] = candidatesFor(f);
      if (!c) continue;
      const [row] = buildMatrixRows(f.catalogId, [f.entity], serverOf(f), {}, resolveCatalogSteps(f.catalogId));
      expect({ entity: f.entity.id, index: row.stepIndex(c.step) }).toEqual({ entity: f.entity.id, index: c.stepIndex });
    }
  });
});

describe('useGlobalCoach builds its entities through the lab constructor', () => {
  it('feeds the model a diablo1 row WITH canonProfile — the same entity useLabDetail renders', async () => {
    const row = {
      id: 'd1-dialog-X', catalogId: 'dialog-trees', name: 'X', categoryPath: [], tags: [], lifecycle: 'planned', data: {},
      provenance: {
        kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'p', sourceFile: 'f', sourceRow: 'X',
        licenceNote: 'n', ingestedAt: '2026-01-01', canonProfile: 'diablo1',
      },
    };
    useCatalogStore.setState({ entitiesByCatalog: { 'dialog-trees': { [row.id]: row } } } as never);
    const spy = vi.mocked(buildCatalogCandidatesFromSummary);
    spy.mockClear();
    renderHook(() => useGlobalCoach());
    await waitFor(() => expect(spy.mock.calls.some(([cin]) => cin.catalogId === 'dialog-trees')).toBe(true));
    const fed = spy.mock.calls.find(([cin]) => cin.catalogId === 'dialog-trees')![0].entities[0];
    expect(fed.canonProfile).toBe('diablo1');
    const detail = renderHook(() => useLabDetail('dialog-trees')).result.current!;
    expect(fed).toEqual(detail.entities[0]);
  });
});
