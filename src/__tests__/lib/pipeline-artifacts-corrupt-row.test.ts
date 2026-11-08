import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import {
  listArtifacts, listAllArtifacts, listDeferredArtifacts, getArtifact, upsertArtifact,
  listArtifactVerdicts, CORRUPT_ARTIFACT_PREFIX, isCorruptArtifact,
} from '@/lib/pipeline-artifacts-db';

const CAT = 'corrupt-row-probe';

function seed() {
  upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'Good', data: { a: 1 }, ueAssets: [], status: 'deferred', tier: 'L3' });
  upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'Bad', data: { b: 2 }, ueAssets: [], status: 'deferred', tier: 'L3' });
  getDb().prepare(`UPDATE pipeline_artifacts SET data = '{oops' WHERE catalog_id = ? AND step = 'Bad'`).run(CAT);
}

afterEach(() => {
  getDb().prepare('DELETE FROM pipeline_artifacts WHERE catalog_id = ?').run(CAT);
  getDb().prepare('DELETE FROM pipeline_artifact_revisions WHERE catalog_id = ?').run(CAT);
});

describe('one corrupt row does not fail the full-row readers', () => {
  it('listArtifacts returns both rows with the corrupt one marked', () => {
    seed();
    const rows = listArtifacts(CAT);
    expect(rows).toHaveLength(2);
    const bad = rows.find((r) => r.step === 'Bad')!;
    expect(isCorruptArtifact(bad)).toBe(true);
    expect(bad.status).toBe('fail');
    expect(bad.reason?.startsWith(CORRUPT_ARTIFACT_PREFIX)).toBe(true);
    expect(isCorruptArtifact(rows.find((r) => r.step === 'Good')!)).toBe(false);
  });
  it('listAllArtifacts, listDeferredArtifacts and getArtifact degrade the same way', () => {
    seed();
    expect(listAllArtifacts({ catalogId: CAT })).toHaveLength(2);
    expect(listDeferredArtifacts({ catalogId: CAT })).toHaveLength(2);
    expect(isCorruptArtifact(getArtifact(CAT, 'e1', 'Bad')!)).toBe(true);
    expect(listArtifactVerdicts(CAT)).toHaveLength(2);
  });
  it('upsertArtifact refuses to persist the placeholder', () => {
    seed();
    const bad = getArtifact(CAT, 'e1', 'Bad')!;
    expect(() => upsertArtifact(bad)).toThrow(/corrupt/i);
    const raw = getDb().prepare(`SELECT data FROM pipeline_artifacts WHERE catalog_id = ? AND step = 'Bad'`).pluck().get(CAT);
    expect(raw).toBe('{oops');
  });
  it('a genuine fresh write repairs the row and archives no placeholder', () => {
    seed();
    upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'Bad', data: { fixed: true }, ueAssets: [], status: 'pass', tier: 'L0' });
    expect(getArtifact(CAT, 'e1', 'Bad')!.data).toEqual({ fixed: true });
    const n = getDb().prepare('SELECT COUNT(*) FROM pipeline_artifact_revisions WHERE catalog_id = ?').pluck().get(CAT);
    expect(n).toBe(0);
  });
});
