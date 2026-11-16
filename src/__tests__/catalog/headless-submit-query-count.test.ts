/**
 * One headless submit reads the catalog's judge verdicts a BOUNDED number of times.
 *
 * `submitStepArtifact` answers "what next?" by walking the entity's whole pipeline
 * (`nextEntityStep`), and every produced step went through `bridgeAcceptance`, which re-read
 * `listVerdicts(catalogId)` — EVERY verdict in the catalog — and `listArtifacts` for the entity,
 * once per step. So one submit cost (produced steps + 1) full-catalog verdict reads: an N+1
 * that grows with both the pipeline length and the catalog's judging history.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-headless-query-count-${process.pid}.db`;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.hoisted runs before ESM imports
  const fs = require('node:fs') as typeof import('node:fs');
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
  }
  process.env.POF_DB_PATH = dbPath;
});

const calls = vi.hoisted(() => ({ listVerdicts: 0 }));
vi.mock('@/lib/status/judge-verdicts-db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/status/judge-verdicts-db')>();
  return {
    ...orig,
    listVerdicts: (...args: Parameters<typeof orig.listVerdicts>) => { calls.listVerdicts++; return orig.listVerdicts(...args); },
  };
});

import '@/lib/catalog/pipelines/registry.generated';
import { submitStepArtifact } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { seededEntities } from '@/lib/catalog/seed';
import { stepsForProfile } from '@/lib/catalog/stepScope';
import { canonProfileOf } from '@/lib/catalog/canon/profiles';

describe('submitStepArtifact — verdict reads per submit', () => {
  it('does not re-read the catalog verdicts once per produced step', () => {
    const catalogId = 'spellbook';
    const entity = seededEntities(catalogId)[0];
    const steps = stepsForProfile(getCatalogPipeline(catalogId)!, canonProfileOf(entity));
    expect(steps.length).toBeGreaterThanOrEqual(8);
    // Produce the first 8 steps, so the "what next?" walk has 8 persisted verdicts to bridge.
    for (const s of steps.slice(0, 8)) submitStepArtifact(catalogId, entity.id, s.label, { note: 'x' }, []);

    calls.listVerdicts = 0;
    const res = submitStepArtifact(catalogId, entity.id, steps[0].label, { note: 'y' }, []);
    expect(res.next.entityStep === null || typeof res.next.entityStep.step === 'string').toBe(true);
    // Grade (1) + the returned acceptance (1) + ONE read for the whole next-step walk.
    expect(calls.listVerdicts).toBeLessThanOrEqual(3);
  });
});
