/**
 * Durable catalog entities — a user-created entity must be RESOLVABLE BY THE SERVER.
 *
 * Governing standard (ai-registry `game-production/catalog-pipeline-authoring`):
 * "absence must never read as exemption". A one-shot draft used to live only in
 * `localStorage` while its ~11 pipeline artifacts were written to SQLite, so the server
 * could never resolve the entity again — `seededEntities` missed it, `listEntitySummaries`
 * omitted it, the checker context's `has()` said false, and the static-verify resolver
 * returned `null`, which silently EXEMPTED user-created content from every L2 gate.
 *
 * These are the three resolution seams the fix has to close, plus the collision rule:
 * a persisted row can never shadow a code seed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Isolate from the operator's real ~/.pof/pof.db (see pipeline-artifacts-delete.test.ts).
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-catalog-entities-${process.pid}.db`;
});

import { upsertEntity, listEntities, getEntity, deleteEntity } from '@/lib/catalog-db';
import { seededEntities, codeSeededEntities, entityCollisions } from '@/lib/catalog/seed';
import { listEntitySummaries, gradeArtifact } from '@/lib/catalog/headless';
import { defaultStaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const CATALOG = 'bestiary';
const USER_ID = 'user-ash-revenant';

function entity(id: string, name = 'Ash Revenant'): StoredCatalogEntity {
  return {
    id,
    catalogId: CATALOG,
    name,
    categoryPath: [],
    tags: ['one-shot'],
    lifecycle: 'planned',
    data: { stats: { health: 100, damage: 10, armor: 5, moveSpeed: 400 } },
  };
}

function clear(catalogId: string) {
  for (const r of listEntities(catalogId)) deleteEntity(catalogId, r.entityId);
}

beforeEach(() => {
  clear(CATALOG);
  clear('spellbook');
});

describe('catalog_entities table', () => {
  it('round-trips a user-created entity and reports a REAL deleted row count', () => {
    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'one-shot', entity: entity(USER_ID) });

    const rows = listEntities(CATALOG);
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(USER_ID);
    expect(rows[0].source).toBe('one-shot');
    expect(rows[0].entity.name).toBe('Ash Revenant');
    expect(getEntity(CATALOG, USER_ID)?.entity.data).toEqual(entity(USER_ID).data);

    // The count is `changes()`, not the number of rows ATTEMPTED — a second delete is 0.
    expect(deleteEntity(CATALOG, USER_ID)).toBe(1);
    expect(deleteEntity(CATALOG, USER_ID)).toBe(0);
    expect(listEntities(CATALOG)).toHaveLength(0);
  });

  it('upsert replaces on (catalogId, entityId) and keeps createdAt', () => {
    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'user', entity: entity(USER_ID) });
    const first = getEntity(CATALOG, USER_ID)!;
    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'user', entity: entity(USER_ID, 'Renamed') });
    const second = getEntity(CATALOG, USER_ID)!;
    expect(listEntities(CATALOG)).toHaveLength(1);
    expect(second.entity.name).toBe('Renamed');
    expect(second.createdAt).toBe(first.createdAt);
  });
});

describe('seededEntities is the union of code seeds and persisted rows', () => {
  it('leaves the code seeds byte-identical and appends the persisted entity', () => {
    const before = seededEntities(CATALOG);
    expect(before).toEqual(codeSeededEntities(CATALOG));

    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'one-shot', entity: entity(USER_ID) });
    const after = seededEntities(CATALOG);

    // The walker and the drain must keep resolving code seeds unchanged.
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.map((e) => e.id)).toContain(USER_ID);
  });

  it('a persisted id can NEVER shadow a code seed — the code seed wins and the collision is reported', () => {
    const codeSeed = codeSeededEntities(CATALOG)[0];
    upsertEntity({
      catalogId: CATALOG,
      entityId: codeSeed.id,
      source: 'user',
      entity: { ...entity(codeSeed.id), name: 'IMPOSTOR' },
    });

    const resolved = seededEntities(CATALOG).filter((e) => e.id === codeSeed.id);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toEqual(codeSeed);
    expect(resolved[0].name).not.toBe('IMPOSTOR');

    // Reported, not silently merged.
    const collisions = entityCollisions(CATALOG);
    expect(collisions.map((c) => c.entityId)).toContain(codeSeed.id);
    expect(collisions[0].reason).toMatch(/code seed/i);
  });
});

describe('the three server resolution seams', () => {
  it('listEntitySummaries surfaces the persisted entity', () => {
    expect(listEntitySummaries(CATALOG).map((e) => e.id)).not.toContain(USER_ID);
    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'one-shot', entity: entity(USER_ID) });
    const summaries = listEntitySummaries(CATALOG);
    expect(summaries.map((e) => e.id)).toContain(USER_ID);
    expect(summaries.find((e) => e.id === USER_ID)?.name).toBe('Ash Revenant');
  });

  it('the server CheckerContext `has()` resolves it — a cross-catalog link stops reading as broken', () => {
    const data = {
      abilities: ['spellbook::user-flame-lash Flame Lash'],
      links: [{ catalogId: 'spellbook', entityId: 'user-flame-lash', role: 'primary-ability' }],
      wiringContract: {
        grantedBy: 'UARPGAbilitySystemComponent on AARPGEnemyCharacter',
        activatedBy: 'BehaviorTree task BTTask_UseAbility_FlameLash',
        dependencies: ['spellbook::user-flame-lash'],
        verification: 'L2: spellbook::user-flame-lash present in the catalog',
      },
    };

    const before = gradeArtifact(CATALOG, 'Abilities', data, 'e-any');
    expect(JSON.stringify(before.raw)).toContain('user-flame-lash');

    upsertEntity({
      catalogId: 'spellbook',
      entityId: 'user-flame-lash',
      source: 'user',
      entity: { ...entity('user-flame-lash', 'Flame Lash'), catalogId: 'spellbook' },
    });

    const after = gradeArtifact(CATALOG, 'Abilities', data, 'e-any');
    expect(JSON.stringify(after.raw)).not.toContain('unresolved');
  });

  it('the static-check resolver returns real checks for it instead of null', () => {
    const get = defaultStaticVerifyDeps.getStaticChecks;
    expect(get(CATALOG, USER_ID, 'Stat Block')).toBeNull();

    upsertEntity({ catalogId: CATALOG, entityId: USER_ID, source: 'one-shot', entity: entity(USER_ID) });

    const checks = get(CATALOG, USER_ID, 'Stat Block');
    expect(Array.isArray(checks)).toBe(true);
    expect(checks!.length).toBeGreaterThan(0);
  });
});
