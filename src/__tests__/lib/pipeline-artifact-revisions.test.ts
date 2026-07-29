/**
 * Artifact revision history. Uses a throwaway DB (POF_DB_PATH set before the import graph
 * loads) so it never touches the user's real ~/.pof/pof.db.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-revisions-${process.pid}.db`;
});

import {
  upsertArtifact, listRevisions, getRevision, contentChanged, MAX_REVISIONS,
} from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const CAT = 'rev-test';
const ENT = 'e1';
const STEP = 'Concept Brief';

const art = (over: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: CAT, entityId: ENT, step: STEP,
  data: { brief: 'v1' }, ueAssets: [], status: 'pass', tier: 'L0', ...over,
});

beforeEach(() => {
  listRevisions(CAT, ENT, STEP); // forces the lazy DDL before the cleanup DELETEs
  const db = getDb();
  db.prepare('DELETE FROM pipeline_artifacts WHERE catalog_id = ?').run(CAT);
  db.prepare('DELETE FROM pipeline_artifact_revisions WHERE catalog_id = ?').run(CAT);
});

describe('contentChanged', () => {
  it('is false for an identical re-write', () => {
    expect(contentChanged(art(), art())).toBe(false);
  });

  it('is false when only the VERDICT moved — that is what a gate drain does', () => {
    expect(contentChanged(art(), art({ status: 'deferred', tier: 'L3', reason: 'waiting on UE' }))).toBe(false);
  });

  it('is true when the produced data differs', () => {
    expect(contentChanged(art(), art({ data: { brief: 'v2' } }))).toBe(true);
  });

  it('is true when the declared UE assets differ', () => {
    expect(contentChanged(art(), art({ ueAssets: ['/Game/X'] }))).toBe(true);
  });
});

describe('revision archiving', () => {
  it('archives nothing for a step written once', () => {
    upsertArtifact(art());
    expect(listRevisions(CAT, ENT, STEP)).toEqual([]);
  });

  it('archives the SUPERSEDED version when a re-produce changes the content', () => {
    upsertArtifact(art({ data: { brief: 'v1' } }));
    upsertArtifact(art({ data: { brief: 'v2' } }));

    const revs = listRevisions(CAT, ENT, STEP);
    expect(revs).toHaveLength(1);
    // The archive holds the OLD version; the live row holds the new one.
    expect(revs[0].data).toEqual({ brief: 'v1' });
  });

  it('does not archive a drain that only moves the verdict', () => {
    upsertArtifact(art({ data: { brief: 'v1' }, status: 'deferred', tier: 'L3' }));
    upsertArtifact(art({ data: { brief: 'v1' }, status: 'pass', tier: 'L3', reason: 'UE test passed' }));
    expect(listRevisions(CAT, ENT, STEP)).toEqual([]);
  });

  it('orders revisions newest-first', () => {
    upsertArtifact(art({ data: { brief: 'v1' } }));
    upsertArtifact(art({ data: { brief: 'v2' } }));
    upsertArtifact(art({ data: { brief: 'v3' } }));

    const revs = listRevisions(CAT, ENT, STEP);
    expect(revs.map((r) => r.data)).toEqual([{ brief: 'v2' }, { brief: 'v1' }]);
  });

  it('keeps each archived version’s own verdict, not the current one', () => {
    upsertArtifact(art({ data: { brief: 'v1' }, status: 'fail', reason: 'too short' }));
    upsertArtifact(art({ data: { brief: 'v2' }, status: 'pass' }));

    const [rev] = listRevisions(CAT, ENT, STEP);
    expect(rev.status).toBe('fail');
    expect(rev.reason).toBe('too short');
  });

  it('keeps history per step — one step’s versions never leak into another’s', () => {
    upsertArtifact(art({ data: { brief: 'v1' } }));
    upsertArtifact(art({ data: { brief: 'v2' } }));
    upsertArtifact(art({ step: 'Attributes', data: { a: 1 } }));
    upsertArtifact(art({ step: 'Attributes', data: { a: 2 } }));

    expect(listRevisions(CAT, ENT, STEP)).toHaveLength(1);
    expect(listRevisions(CAT, ENT, 'Attributes')).toHaveLength(1);
    expect(listRevisions(CAT, ENT, 'Attributes')[0].data).toEqual({ a: 1 });
  });

  it(`prunes to the newest ${MAX_REVISIONS} versions`, () => {
    for (let i = 1; i <= MAX_REVISIONS + 5; i++) upsertArtifact(art({ data: { brief: `v${i}` } }));
    const revs = listRevisions(CAT, ENT, STEP);
    expect(revs).toHaveLength(MAX_REVISIONS);
    // The oldest fell off; the most recent superseded version is still the newest entry.
    expect(revs[0].data).toEqual({ brief: `v${MAX_REVISIONS + 4}` });
    expect(revs.some((r) => JSON.stringify(r.data) === JSON.stringify({ brief: 'v1' }))).toBe(false);
  });

  it('fetches one revision by id, and null for an unknown id', () => {
    upsertArtifact(art({ data: { brief: 'v1' } }));
    upsertArtifact(art({ data: { brief: 'v2' } }));
    const [rev] = listRevisions(CAT, ENT, STEP);

    expect(getRevision(rev.id)?.data).toEqual({ brief: 'v1' });
    expect(getRevision(999999)).toBeNull();
  });

  it('dates an archived version by when it was WRITTEN, not when it was archived', () => {
    upsertArtifact(art({ data: { brief: 'v1' } }));
    const live = getDb()
      .prepare('SELECT updated_at FROM pipeline_artifacts WHERE catalog_id=? AND entity_id=? AND step=?')
      .get(CAT, ENT, STEP) as { updated_at: string };

    upsertArtifact(art({ data: { brief: 'v2' } }));
    const [rev] = listRevisions(CAT, ENT, STEP);
    expect(rev.updatedAt).toBe(live.updated_at);
    expect(rev.archivedAt).toBeTruthy();
  });
});
