/**
 * `currentStepBinding` — the ONE door both verdict write seams stamp through.
 *
 * Judge verdicts and craft gauges answer the same question — which content did this verdict
 * read? — and used to answer it two ways (judge: a content fingerprint; craft: the row's write
 * time, which every drain / static-verify re-upsert bumps without changing a byte). Both routes
 * now bind through this module, so they cannot drift apart again.
 *
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-step-binding-${process.pid}.db`;
});
import { getDb } from '@/lib/db';
import { currentStepBinding } from '@/lib/judge/stepBinding';
import { stepContentHash } from '@/lib/judge/contentHash';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { listCraftVerdicts } from '@/lib/craft/craft-verdicts-db';
import { POST as postJudge } from '@/app/api/judge-verdicts/route';
import { POST as postCraft } from '@/app/api/craft-verdicts/route';

function req(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const DATA = { stats: { hp: 40, armor: 12 }, statBudget: 52 };

describe('craft_verdicts gains content_hash additively (existing tables are migrated, no row rewritten)', () => {
  // Must run FIRST in this file: the tables are created lazily, so a pre-existing OLD-shape table
  // is what a machine that gauged before this change holds.
  it('an old-shape table keeps its legacy row hash-less and accepts a bound gauge', async () => {
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS craft_verdicts (
        catalog_id TEXT NOT NULL, entity_id TEXT NOT NULL, step TEXT NOT NULL, lens TEXT NOT NULL,
        lens_version INTEGER NOT NULL DEFAULT 1,
        a_level TEXT NOT NULL CHECK(a_level IN ('A1','A2','A3','A4')),
        findings TEXT NOT NULL DEFAULT '[]', model TEXT NOT NULL DEFAULT '', effort TEXT NOT NULL DEFAULT '',
        artifact_updated_at TEXT, judged_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (catalog_id, entity_id, step)
      );
      INSERT INTO craft_verdicts (catalog_id, entity_id, step, lens, a_level, findings, model, artifact_updated_at)
        VALUES ('items', 'legacy', 'Stats', 'game-systems-code', 'A2', '[]', 'old', '2026-08-01 10:00:00');
    `);
    const legacy = listCraftVerdicts('items').find((v) => v.entityId === 'legacy');
    expect(legacy?.artifactUpdatedAt).toBe('2026-08-01 10:00:00');
    expect(legacy?.contentHash).toBeUndefined();

    upsertArtifact({ catalogId: 'items', entityId: 'legacy', step: 'Stats', status: 'pass', tier: 'L0', data: DATA, ueAssets: [] });
    const res = await postCraft(
      req('/api/craft-verdicts', {
        catalogId: 'items',
        entityId: 'legacy',
        step: 'Stats',
        lens: 'game-systems-code',
        lensVersion: 1,
        aLevel: 'A3',
        findings: [{ criterion: 'stat-curve', detail: 'budget curve present but untuned per tier', class: 'content' }],
        model: 'opus-craft-fleet-test',
      }),
    );
    expect(((await res.json()) as { success: boolean }).success).toBe(true);
    expect(listCraftVerdicts('items').find((v) => v.entityId === 'legacy')?.contentHash).toBe(stepContentHash(DATA));
  });
});

describe('currentStepBinding', () => {
  it('returns the stored artifact’s content fingerprint and write time, read by primary key', () => {
    const art = upsertArtifact({ catalogId: 'items', entityId: 'e1', step: 'Stats', status: 'pass', tier: 'L0', data: DATA, ueAssets: [] });
    expect(currentStepBinding('items', 'e1', 'Stats')).toEqual({ contentHash: stepContentHash(DATA), updatedAt: art.updatedAt });
  });

  it('returns null when the step has no artifact (never a fabricated binding)', () => {
    expect(currentStepBinding('items', 'e1', 'No Such Step')).toBeNull();
    expect(currentStepBinding('items', 'nobody', 'Stats')).toBeNull();
  });
});

describe('[guard] POST /api/judge-verdicts still binds through the same door', () => {
  const VERDICT = {
    catalogId: 'items',
    judge: 'llm-panel',
    verdict: 'pass',
    score: 91,
    findings: 'stat budget reconciles with the tier curve',
    model: 'judge-test',
  };

  it('a verdict without contentHash for a step with an artifact is stamped stepContentHash(artifact.data)', async () => {
    upsertArtifact({ catalogId: 'items', entityId: 'e2', step: 'Stats', status: 'pass', tier: 'L0', data: DATA, ueAssets: [] });
    const res = await postJudge(req('/api/judge-verdicts', { ...VERDICT, entityId: 'e2', step: 'Stats' }));
    expect(((await res.json()) as { success: boolean }).success).toBe(true);
    const stored = listVerdicts('items').find((v) => v.entityId === 'e2' && v.step === 'Stats');
    expect(stored?.contentHash).toBe(stepContentHash(DATA));
  });

  it('a verdict for a step with no artifact stores no contentHash', async () => {
    const res = await postJudge(req('/api/judge-verdicts', { ...VERDICT, entityId: 'e3', step: 'Stats' }));
    expect(((await res.json()) as { success: boolean }).success).toBe(true);
    const stored = listVerdicts('items').find((v) => v.entityId === 'e3' && v.step === 'Stats');
    expect(stored).toBeTruthy();
    expect(stored!.contentHash).toBeUndefined();
  });
});
