/**
 * One artifact write door (`commitArtifact`) — the in-process / headless half.
 *
 * `submitStepArtifact` is the door every scripts/diablo producer and the MCP `pof_submit_artifact`
 * go through. It used to persist `data` verbatim: a smuggled `_provenance` claim landed as-is and
 * an honest write carried no stamp at all (1,679 of 1,679 live rows), so prompt fitness had a
 * population of 0 and the EvidenceModal said every row predated stamping.
 *
 * The regrade cases are [guard]s: scripts/diablo/regrade.ts re-submits each stored row's data
 * UNCHANGED, and `contentChanged` compares the whole `data` object (stamp included). A door that
 * stamped `{ engine: 'unknown' }` on that re-submit would archive a revision on every regrade
 * and erase a real stamp — so an unchanged re-submit with no attestation keeps the row's stamp.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-commit-${process.pid}.db`;
});

import '@/lib/catalog/pipelines/registry.generated';
import { submitStepArtifact } from '@/lib/catalog/headless';
import { getArtifact, listRevisions, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { seededEntities } from '@/lib/catalog/seed';
import { describeProducer, readProvenance } from '@/lib/provenance';

const CAT = 'bestiary';
const STEP = 'Lore / Codex';
/** PoF-profile bestiary seeds (no reference provenance) — each case takes its own entity. */
const pofSeeds = seededEntities(CAT).filter((e) => !e.provenance);
const entity = (i: number) => pofSeeds[i].id;
const lore = (tag: string) => ({ lore: `${tag} `.repeat(60) });

function stored(entityId: string) {
  return getArtifact(CAT, entityId, STEP);
}

describe('submitStepArtifact — the in-process door stamps who produced the row', () => {
  it('refuses an engine claim smuggled inside data._provenance (records unknown)', () => {
    const e = entity(0);
    submitStepArtifact(CAT, e, STEP, { ...lore('smuggled'), _provenance: { engine: 'Tripo' } }, []);
    expect(readProvenance(stored(e)?.data)?.engine).toBe('unknown');
  });

  it('records the engine trusted server code attests', () => {
    const e = entity(1);
    submitStepArtifact(CAT, e, STEP, lore('attested'), [], { attest: { engine: 'Leonardo (Lucid Origin)' } });
    expect(readProvenance(stored(e)?.data)?.engine).toBe('Leonardo (Lucid Origin)');
  });

  it('with no attestation the stamp is the stated absence — never a prompt version', () => {
    const e = entity(2);
    submitStepArtifact(CAT, e, STEP, lore('plain'), []);
    expect(stored(e)?.data._provenance).toEqual({ engine: 'unknown' });
  });
});

describe('[guard] an unchanged re-submit (scripts/diablo/regrade.ts) neither churns nor erases', () => {
  it('a legacy unstamped row stays unstamped and archives no revision', () => {
    const e = entity(3);
    upsertArtifact({ catalogId: CAT, entityId: e, step: STEP, data: lore('legacy'), ueAssets: ['/Game/X'], status: 'pass', tier: 'L0' });
    const before = stored(e)!;
    const revs = listRevisions(CAT, e, STEP).length;

    submitStepArtifact(CAT, e, STEP, before.data, before.ueAssets);

    const after = stored(e)!;
    expect(listRevisions(CAT, e, STEP)).toHaveLength(revs);
    expect(after.data).not.toHaveProperty('_provenance');
    expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
  });

  it('a stamped row keeps its engine and promptVersion byte-identical', () => {
    const e = entity(4);
    const stamp = { engine: 'Leonardo (Lucid Origin)', promptVersion: 'q1', at: '2026-09-27T00:00:00Z' };
    upsertArtifact({ catalogId: CAT, entityId: e, step: STEP, data: { ...lore('stamped'), _provenance: stamp }, ueAssets: [], status: 'pass', tier: 'L0' });
    const before = stored(e)!;
    const revs = listRevisions(CAT, e, STEP).length;

    submitStepArtifact(CAT, e, STEP, before.data, before.ueAssets);

    const after = stored(e)!;
    expect(listRevisions(CAT, e, STEP)).toHaveLength(revs);
    expect(JSON.stringify(after.data._provenance)).toBe(JSON.stringify(stamp));
    expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
  });
});

describe('describeProducer splits a legacy unstamped row from a stamped-unknown one', () => {
  it('a stamped unknown says the producer was not attested — not that it predates stamping', () => {
    const text = describeProducer({ engine: 'unknown' });
    expect(text).toMatch(/not attested/i);
    expect(text).toMatch(/not recorded/i);
    expect(text).not.toContain('written before produce paths stamped');
  });

  it('a row with no stamp at all is still the legacy case', () => {
    expect(describeProducer(null)).toContain('written before produce paths stamped');
  });
});
