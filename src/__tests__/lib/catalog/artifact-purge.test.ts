/**
 * A step lives in FOUR tables. Deleting it must remove all four and report what actually went.
 *
 * `DELETE /api/pipeline-artifacts` used to delete only `pipeline_artifacts` and return
 * `targets.length` — the number of rows ATTEMPTED — while documenting itself as "the number of
 * rows actually removed". So a reset left the judge's verdict and the whole revision archive
 * behind, and the count could not be observably wrong because nothing ever looked.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-purge-${process.pid}.db`;
});

import {
  purgeEntity,
  inventorySyntheticFixtures,
  purgeSyntheticFixtures,
  totalPurged,
} from '@/lib/catalog/artifact-purge';
import { upsertArtifact, listArtifacts, listRevisions } from '@/lib/pipeline-artifacts-db';
import { upsertVerdict, listVerdicts, listVerdictHistory } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { upsertCraftVerdict, listCraftVerdicts, listCraftVerdictHistory } from '@/lib/craft/craft-verdicts-db';
import type { LensId } from '@/lib/craft/lens-map';

const CRAFT_LENS: LensId = 'game-systems-code';

const CAT = 'purge-test';

/** Produce a step twice with DIFFERENT content, so the first version is archived. */
function produceTwice(entityId: string, step: string) {
  upsertArtifact({ catalogId: CAT, entityId, step, data: { v: 1 }, ueAssets: [], status: 'pass', tier: 'L0' });
  upsertArtifact({ catalogId: CAT, entityId, step, data: { v: 2 }, ueAssets: [], status: 'pass', tier: 'L0' });
}

/** Judge a step twice, so the history holds two rows and `judge_verdicts` one. */
function judgeTwice(entityId: string, step: string) {
  for (const score of [40, 70]) {
    upsertVerdict({
      catalogId: CAT, entityId, step, judge: 'llm-panel', verdict: 'pass', score,
      findings: 'seed', model: 'test', rubricVersion: RUBRIC_VERSION,
    });
  }
}

describe('purgeEntity — all four tables, real changes()', () => {
  it('removes the artifact, its revisions, its verdicts and its verdict log', () => {
    produceTwice('pe-1', 'Alpha');
    produceTwice('pe-1', 'Beta');
    judgeTwice('pe-1', 'Alpha');
    // A neighbour that must survive.
    produceTwice('pe-2', 'Alpha');
    judgeTwice('pe-2', 'Alpha');

    expect(listRevisions(CAT, 'pe-1', 'Alpha')).toHaveLength(1);
    expect(listVerdictHistory(CAT, 'pe-1', 'Alpha')).toHaveLength(2);

    const counts = purgeEntity(CAT, 'pe-1');
    expect(counts).toEqual({ artifacts: 2, revisions: 2, verdicts: 1, verdictHistory: 2, craftVerdicts: 0, craftHistory: 0 });
    expect(totalPurged(counts)).toBe(7);

    expect(listArtifacts(CAT, 'pe-1')).toHaveLength(0);
    expect(listRevisions(CAT, 'pe-1', 'Alpha')).toHaveLength(0);
    expect(listVerdictHistory(CAT, 'pe-1', 'Alpha')).toHaveLength(0);
    expect(listVerdicts(CAT).filter((v) => v.entityId === 'pe-1')).toHaveLength(0);

    // The neighbour is untouched.
    expect(listArtifacts(CAT, 'pe-2')).toHaveLength(1);
    expect(listVerdicts(CAT).filter((v) => v.entityId === 'pe-2')).toHaveLength(1);
  });

  it('narrows to one step when `step` is given, and reports zero for a step that never existed', () => {
    produceTwice('pe-3', 'Alpha');
    produceTwice('pe-3', 'Beta');
    judgeTwice('pe-3', 'Alpha');

    expect(purgeEntity(CAT, 'pe-3', 'Alpha')).toEqual({ artifacts: 1, revisions: 1, verdicts: 1, verdictHistory: 2, craftVerdicts: 0, craftHistory: 0 });
    expect(listArtifacts(CAT, 'pe-3').map((a) => a.step)).toEqual(['Beta']);

    // Nothing there — an honest zero, not an attempt count.
    expect(purgeEntity(CAT, 'pe-3', 'Never Produced')).toEqual({ artifacts: 0, revisions: 0, verdicts: 0, verdictHistory: 0, craftVerdicts: 0, craftHistory: 0 });
  });
});

/** Gauge a step twice on the A-axis, so `craft_verdicts` holds one row and its history two. */
function craftTwice(entityId: string, step: string) {
  for (const aLevel of ['A1', 'A2'] as const) {
    upsertCraftVerdict({
      catalogId: CAT, entityId, step, lens: CRAFT_LENS, lensVersion: 1, aLevel,
      findings: [], model: 'test',
    });
  }
}

describe('purgeEntity — craft verdicts are step-keyed too', () => {
  // Measured on the real DB (2026-11-08): 374 of 845 `craft_verdicts` rows had no artifact,
  // 342 of them (plus 342 history rows) on the purged fixture `test-headless-mcp` — the purge
  // removed the step and left its A-axis gauge behind.
  it('removes the craft verdict and its history with the step, and counts them', () => {
    produceTwice('pc-1', 'Alpha');
    craftTwice('pc-1', 'Alpha');
    craftTwice('pc-2', 'Alpha'); // a neighbour that must survive

    const counts = purgeEntity(CAT, 'pc-1', 'Alpha');
    expect(counts.craftVerdicts).toBe(1);
    expect(counts.craftHistory).toBe(2);
    expect(listCraftVerdicts(CAT).filter((v) => v.entityId === 'pc-1')).toHaveLength(0);
    expect(listCraftVerdictHistory(CAT, 'pc-1', 'Alpha')).toHaveLength(0);
    expect(listCraftVerdicts(CAT).filter((v) => v.entityId === 'pc-2')).toHaveLength(1);
    purgeEntity(CAT, 'pc-2');
  });

  it('inventories and purges a fixture entity\'s craft rows', () => {
    craftTwice('test-headless-mcp', 'Craft Only');
    const inv = inventorySyntheticFixtures();
    const fixture = inv.entities.find((e) => e.entityId === 'test-headless-mcp');
    expect(fixture?.counts.craftVerdicts).toBe(1);
    expect(fixture?.counts.craftHistory).toBe(2);
    purgeSyntheticFixtures();
    expect(listCraftVerdicts(CAT).filter((v) => v.entityId === 'test-headless-mcp')).toHaveLength(0);
  });
});

describe('synthetic fixture inventory + purge', () => {
  it('inventories exactly the entities isSyntheticEntity recognises, and writes nothing', () => {
    produceTwice('test-headless-mcp', 'Alpha');
    judgeTwice('test-headless-mcp', 'Alpha');
    produceTwice('item-mcp-smoke', 'Alpha');
    produceTwice('hero-real', 'Alpha');
    // Looks test-ish but is NOT synthetic under the shared predicate — must survive.
    produceTwice('test-dummy-real-entity', 'Alpha');

    const inv = inventorySyntheticFixtures();
    expect(inv.purged).toBe(false);
    expect(inv.entities.map((e) => e.entityId)).toEqual(['item-mcp-smoke', 'test-headless-mcp']);
    expect(inv.entities.find((e) => e.entityId === 'test-headless-mcp')!.counts)
      .toEqual({ artifacts: 1, revisions: 1, verdicts: 1, verdictHistory: 2, craftVerdicts: 0, craftHistory: 0 });
    expect(totalPurged(inv.total)).toBe(7);

    // A dry run must not delete: measuring twice gives the same answer.
    expect(totalPurged(inventorySyntheticFixtures().total)).toBe(7);
    expect(listArtifacts(CAT, 'test-headless-mcp')).toHaveLength(1);
  });

  it('purges them and reports the rows that actually went, leaving real entities alone', () => {
    const before = totalPurged(inventorySyntheticFixtures().total);
    expect(before).toBeGreaterThan(0);

    const result = purgeSyntheticFixtures();
    expect(result.purged).toBe(true);
    expect(totalPurged(result.total)).toBe(before);

    expect(inventorySyntheticFixtures().entities).toHaveLength(0);
    expect(listArtifacts(CAT, 'hero-real')).toHaveLength(1);
    expect(listArtifacts(CAT, 'test-dummy-real-entity')).toHaveLength(1);

    // Purging an already-clean DB reports honest zeros rather than pretending to work.
    expect(totalPurged(purgeSyntheticFixtures().total)).toBe(0);
  });
});
