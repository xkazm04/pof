/**
 * The test suite must not be able to reach the operator's real database.
 *
 * `src/lib/db.ts` resolves `POF_DB_PATH || ~/.pof/pof.db`, and the override used to be
 * per-suite opt-in — so every suite that forgot it wrote into `~/.pof/pof.db`. That is not a
 * hypothetical: measured on the live DB on 2026-08-19, 344 of 817 `pipeline_artifacts` (42%),
 * 114 `judge_verdicts`, 255 `judge_verdict_history` and 383 `pipeline_artifact_revisions` rows
 * belonged to synthetic harness entities, the newest stamped by a `npm run validate` run.
 *
 * This file deliberately sets NO `vi.hoisted` override of its own. It is the proof that the
 * floor in `vitest.config.ts` (`test.env.POF_DB_PATH`, applied before a worker loads a single
 * module, so no import order can race it) is actually in force — remove that line and this
 * suite goes red instead of quietly writing to the operator's data.
 */
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

const REAL_DB = path.join(os.homedir(), '.pof', 'pof.db');

/** Unique per run so a stale row from an earlier run can never make this pass by luck. */
const ENTITY = `test-headless-containment-${process.pid}-${Date.now()}`;
const CAT = 'db-containment-test';

/** Count rows for our marker entity in the REAL database, read-only. `null` = cannot look. */
function realDbRowsFor(entityId: string): number | null {
  if (!fs.existsSync(REAL_DB)) return null;
  let db: Database.Database | null = null;
  try {
    db = new Database(REAL_DB, { readonly: true, fileMustExist: true });
    let total = 0;
    for (const table of ['pipeline_artifacts', 'pipeline_artifact_revisions', 'judge_verdicts', 'judge_verdict_history']) {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) continue;
      total += (db.prepare(`SELECT count(*) AS c FROM ${table} WHERE entity_id = ?`).get(entityId) as { c: number }).c;
    }
    return total;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

describe('test DB containment', () => {
  it('resolves the app database to a throwaway file, never ~/.pof/pof.db', () => {
    expect(process.env.POF_DB_PATH, 'vitest.config.ts must set test.env.POF_DB_PATH').toBeTruthy();
    // `.name` is the file better-sqlite3 actually opened — the resolved truth, not the intent.
    const opened = path.resolve(getDb().name);
    expect(opened).not.toBe(path.resolve(REAL_DB));
    expect(opened.startsWith(path.resolve(os.tmpdir()))).toBe(true);
  });

  it('writes through the real code paths land in the test DB and NOT in the real one', () => {
    // Exactly the two writes the two known offenders made (`submitStepArtifact` /
    // `upsertVerdict`), under a marker entity that has never existed anywhere.
    upsertArtifact({ catalogId: CAT, entityId: ENTITY, step: 'Containment', data: { probe: true }, ueAssets: [], status: 'pass', tier: 'L0' });
    upsertVerdict({
      catalogId: CAT, entityId: ENTITY, step: 'Containment', judge: 'human', verdict: 'fail',
      score: 1, findings: 'containment probe', model: 'test', rubricVersion: RUBRIC_VERSION,
    });

    // The write really happened — otherwise the assertion below would pass vacuously.
    const written = getDb()
      .prepare('SELECT count(*) AS c FROM pipeline_artifacts WHERE entity_id = ?')
      .get(ENTITY) as { c: number };
    expect(written.c).toBe(1);

    const leaked = realDbRowsFor(ENTITY);
    // `null` means the real DB could not be read at all (no DB on this machine) — nothing to
    // assert, and failing for the inability to look would be a lie of a different kind.
    if (leaked !== null) expect(leaked).toBe(0);
  });
});
