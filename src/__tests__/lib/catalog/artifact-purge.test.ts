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
    expect(counts).toEqual({ artifacts: 2, revisions: 2, verdicts: 1, verdictHistory: 2 });
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

    expect(purgeEntity(CAT, 'pe-3', 'Alpha')).toEqual({ artifacts: 1, revisions: 1, verdicts: 1, verdictHistory: 2 });
    expect(listArtifacts(CAT, 'pe-3').map((a) => a.step)).toEqual(['Beta']);

    // Nothing there — an honest zero, not an attempt count.
    expect(purgeEntity(CAT, 'pe-3', 'Never Produced')).toEqual({ artifacts: 0, revisions: 0, verdicts: 0, verdictHistory: 0 });
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
      .toEqual({ artifacts: 1, revisions: 1, verdicts: 1, verdictHistory: 2 });
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
