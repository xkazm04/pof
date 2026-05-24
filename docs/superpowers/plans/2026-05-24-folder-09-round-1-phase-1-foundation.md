# Folder 09 · Round 1 · Phase 1 — Catalog Foundation (Data Layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typed catalog data layer — entity types, the gated lifecycle state machine, zod validation, the Zustand store, the SQLite table, and the `/api/catalog` route — as a fully unit-tested foundation every later folder-09 phase depends on.

**Architecture:** A pure types module + a small lifecycle gate module are consumed by three things: a zod validation module (guards `@@CALLBACK` payloads), a Zustand `persist` store (mirrors `moduleStore` conventions; transient generation-run state excluded from persist), and a `better-sqlite3` table behind the standard `{ success, data }` API route. All new files — the only shared-file edits in later phases are `navigationStore.ts` and `eslint.config.mjs`.

**Tech Stack:** TypeScript, Zustand v5 (`persist` + `createJSONStorage`), zod v4, better-sqlite3, Next.js 16 route handlers, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md`](../specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md) §3.2–§3.4.

**Plan-level clarifications vs. the spec's file list:**
- The spec's `src/lib/catalog/schema.ts` is split for single-responsibility: **`validation.ts`** holds the zod schemas (this phase); the section-descriptor type `CatalogSectionSchema` (facets/detail-form) lands in the Phase-4 UI plan where it's consumed.
- The lifecycle gate logic lives in its own **`lifecycle.ts`** so the store and the route share one source of truth (DRY).
- `design-tokens.ts` moves to the Phase-4 plan (no consumer until the UI exists).

**Concurrency discipline (shared app repo):** every task commits with a **targeted `git add` of only the exact files it created**. Do not `git add -A`. A pre-existing modified file (`src/__tests__/knowledge/__snapshots__/ue-gotchas.test.ts.snap`) belongs to another session — never stage it.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/lib/catalog/types.ts` | Pure types + constants: `CatalogId`, `LifecycleState`, `LIFECYCLE_ORDER`, `CatalogLink`, `CatalogEntityBase`, `AbilityEntry`, `StoredCatalogEntity`. No logic. |
| `src/lib/catalog/lifecycle.ts` | The gated state machine: `canTransition`, `resolveTransition`. Shared by store + route. |
| `src/lib/catalog/validation.ts` | zod schemas for entities + the generation `@@CALLBACK` payload. |
| `src/lib/catalog-db.ts` | `catalog_entities` table, pure row⇄entity mappers, CRUD functions. |
| `src/stores/catalogStore.ts` | Zustand store: `entitiesByCatalog`, CRUD + `applyGenerationResult`, transient `generationRuns` excluded from persist. |
| `src/app/api/catalog/route.ts` | GET (list/one) + POST (`upsert` / `transition`) using the `{success,data}` envelope. |
| `src/__tests__/lib/catalog/lifecycle.test.ts` | Tests the gate. |
| `src/__tests__/lib/catalog/validation.test.ts` | Tests zod accept/reject. |
| `src/__tests__/lib/catalog-db.test.ts` | Tests the row⇄entity mapper round-trip (hermetic — no live DB). |
| `src/__tests__/stores/catalogStore.test.ts` | Tests CRUD, the lifecycle gate, and that transient state is not persisted. |

---

## Task 1: Catalog types & constants

**Files:**
- Create: `src/lib/catalog/types.ts`

This task is pure type/constant declarations (no behavior), so it has no standalone test; Task 2 is the first TDD task and imports these.

- [ ] **Step 1: Create the types module**

```ts
// src/lib/catalog/types.ts

/** The 8 Core Engine catalog sections. Round 1 ships only 'spellbook'. */
export type CatalogId =
  | 'spellbook'
  | 'bestiary'
  | 'items'
  | 'loot-tables'
  | 'combat-map'
  | 'screen-flow'
  | 'zone-map'
  | 'state-graph';

/** Lifecycle of a generated asset, in pipeline order (+ the terminal 'failed'). */
export type LifecycleState =
  | 'planned'
  | 'scaffolded'
  | 'generated'
  | 'wired'
  | 'verified'
  | 'failed';

/** The happy-path ordering used to enforce monotonic forward transitions. */
export const LIFECYCLE_ORDER = [
  'planned',
  'scaffolded',
  'generated',
  'wired',
  'verified',
] as const;

export type TestResult = 'pass' | 'fail';

/** A typed cross-catalog reference (e.g. a Bestiary entry → its abilities/loot). */
export interface CatalogLink {
  catalogId: CatalogId;
  entityId: string;
  role: string;
}

/** Shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  /** Stable slug, e.g. 'ga-fireball'. Unique within its catalog. */
  id: string;
  catalogId: CatalogId;
  name: string;
  /** Ordered taxonomy path — the L4 hierarchy, e.g. ['Offensive','Fire','AoE']. */
  categoryPath: string[];
  tags: string[];
  lifecycle: LifecycleState;
  /** UE asset paths this entity owns. */
  ueAssets: string[];
  links?: CatalogLink[];
  /** Which GenerationRecipe builds it (Phase 2). */
  recipeId: string;
  /** Optional roll-up into the feature matrix. */
  featureName?: string;
  lastVerifiedAt?: string;
  lastTestResult?: TestResult;
}

export type DamageType =
  | 'Physical' | 'Fire' | 'Frost' | 'Lightning' | 'Arcane' | 'Poison';

/** Spellbook entity — the Round-1 reference type. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: {
    baseClass: string;
    costAttribute?: 'Mana' | 'Stamina';
    costAmount?: number;
    cooldown?: number;
    damageBase?: number;
    damageType?: DamageType;
    tags: { activation: string; cooldown?: string; cost?: string };
    montage?: string;
  };
}

/**
 * The generic shape persisted in the DB and held in the store: the base
 * envelope plus an opaque per-type `data` blob (typed per section, e.g.
 * AbilityEntry['data']).
 */
export type StoredCatalogEntity = CatalogEntityBase & {
  data?: Record<string, unknown>;
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `src/lib/catalog/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/catalog/types.ts
git commit -m "feat(catalog): catalog entity types + lifecycle constants (folder-09 R1 P1)"
```

---

## Task 2: Lifecycle gate (`canTransition`, `resolveTransition`)

**Files:**
- Create: `src/lib/catalog/lifecycle.ts`
- Test: `src/__tests__/lib/catalog/lifecycle.test.ts`

The gate enforces the spec's core invariant: forward moves advance **exactly one** step along `LIFECYCLE_ORDER`; `wired→verified` requires a **passing** test; anything may move to `failed`; a `failed` entity may reset to `planned` to retry.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { canTransition, resolveTransition } from '@/lib/catalog/lifecycle';

describe('canTransition', () => {
  it('allows a single forward step', () => {
    expect(canTransition('planned', 'scaffolded')).toBe(true);
    expect(canTransition('generated', 'wired')).toBe(true);
  });

  it('forbids skipping steps', () => {
    expect(canTransition('planned', 'generated')).toBe(false);
    expect(canTransition('scaffolded', 'verified')).toBe(false);
  });

  it('forbids moving backward', () => {
    expect(canTransition('wired', 'scaffolded')).toBe(false);
  });

  it('allows any state to fail', () => {
    expect(canTransition('planned', 'failed')).toBe(true);
    expect(canTransition('wired', 'failed')).toBe(true);
  });

  it('allows a failed entity to reset to planned for retry', () => {
    expect(canTransition('failed', 'planned')).toBe(true);
    expect(canTransition('failed', 'verified')).toBe(false);
  });
});

describe('resolveTransition', () => {
  it('promotes to verified only when the test passed', () => {
    expect(resolveTransition('wired', 'verified', 'pass')).toBe('verified');
    expect(resolveTransition('wired', 'verified', 'fail')).toBeNull();
    expect(resolveTransition('wired', 'verified', undefined)).toBeNull();
  });

  it('returns the next state for a legal non-verify transition', () => {
    expect(resolveTransition('planned', 'scaffolded')).toBe('scaffolded');
  });

  it('returns null for an illegal transition', () => {
    expect(resolveTransition('planned', 'verified', 'pass')).toBeNull();
  });

  it('returns failed for any-state → failed', () => {
    expect(resolveTransition('scaffolded', 'failed')).toBe('failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/lifecycle.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/catalog/lifecycle"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/catalog/lifecycle.ts
import { LIFECYCLE_ORDER, type LifecycleState, type TestResult } from '@/lib/catalog/types';

type ForwardState = (typeof LIFECYCLE_ORDER)[number];

/**
 * Whether `next` is a structurally legal transition from `current`:
 * - any state → 'failed'
 * - 'failed' → 'planned' (retry from scratch)
 * - otherwise exactly one step forward along LIFECYCLE_ORDER
 */
export function canTransition(current: LifecycleState, next: LifecycleState): boolean {
  if (next === 'failed') return true;
  if (current === 'failed') return next === 'planned';
  const ci = LIFECYCLE_ORDER.indexOf(current as ForwardState);
  const ni = LIFECYCLE_ORDER.indexOf(next as ForwardState);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

/**
 * The gate: returns the lifecycle state to commit, or null to reject.
 * `wired→verified` additionally requires a passing functional test
 * (the "compiles ≠ runs" invariant). All other legal transitions pass through.
 */
export function resolveTransition(
  current: LifecycleState,
  next: LifecycleState,
  testResult?: TestResult,
): LifecycleState | null {
  if (!canTransition(current, next)) return null;
  if (next === 'verified' && testResult !== 'pass') return null;
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/lifecycle.test.ts`
Expected: PASS (all 9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/lifecycle.ts src/__tests__/lib/catalog/lifecycle.test.ts
git commit -m "feat(catalog): gated lifecycle state machine (folder-09 R1 P1)"
```

---

## Task 3: zod validation

**Files:**
- Create: `src/lib/catalog/validation.ts`
- Test: `src/__tests__/lib/catalog/validation.test.ts`

Validates persisted/incoming entities and — critically — the generation `@@CALLBACK` payload before any lifecycle transition (so malformed/injected model output can't advance state).

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/validation.test.ts
import { describe, it, expect } from 'vitest';
import {
  abilityEntrySchema,
  generationCallbackSchema,
} from '@/lib/catalog/validation';

const validAbility = {
  id: 'ga-fireball',
  catalogId: 'spellbook',
  name: 'Fireball',
  categoryPath: ['Offensive', 'Fire', 'AoE'],
  tags: ['aoe', 'fire'],
  lifecycle: 'planned',
  ueAssets: [],
  recipeId: 'spellbook-ga',
  data: {
    baseClass: 'GA_Projectile',
    costAttribute: 'Mana',
    costAmount: 20,
    cooldown: 3,
    damageBase: 45,
    damageType: 'Fire',
    tags: { activation: 'Ability.Fire.Fireball' },
  },
};

describe('abilityEntrySchema', () => {
  it('accepts a well-formed ability entry', () => {
    expect(abilityEntrySchema.safeParse(validAbility).success).toBe(true);
  });

  it('rejects an entry missing the required activation tag', () => {
    const bad = { ...validAbility, data: { ...validAbility.data, tags: {} } };
    expect(abilityEntrySchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown catalogId for an ability', () => {
    const bad = { ...validAbility, catalogId: 'bestiary' };
    expect(abilityEntrySchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown damageType', () => {
    const bad = { ...validAbility, data: { ...validAbility.data, damageType: 'Holy' } };
    expect(abilityEntrySchema.safeParse(bad).success).toBe(false);
  });
});

describe('generationCallbackSchema', () => {
  it('accepts ueAssets + a pass result', () => {
    const r = generationCallbackSchema.safeParse({
      ueAssets: ['/Script/PoF.GA_Fireball'],
      testResult: 'pass',
    });
    expect(r.success).toBe(true);
  });

  it('defaults ueAssets to an empty array when omitted', () => {
    const r = generationCallbackSchema.parse({});
    expect(r.ueAssets).toEqual([]);
  });

  it('rejects an invalid testResult', () => {
    const r = generationCallbackSchema.safeParse({ testResult: 'maybe' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/validation.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/catalog/validation"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/catalog/validation.ts
import { z } from 'zod';

export const catalogIdSchema = z.enum([
  'spellbook', 'bestiary', 'items', 'loot-tables',
  'combat-map', 'screen-flow', 'zone-map', 'state-graph',
]);

export const lifecycleStateSchema = z.enum([
  'planned', 'scaffolded', 'generated', 'wired', 'verified', 'failed',
]);

export const testResultSchema = z.enum(['pass', 'fail']);

export const catalogLinkSchema = z.object({
  catalogId: catalogIdSchema,
  entityId: z.string().min(1),
  role: z.string().min(1),
});

export const catalogEntityBaseSchema = z.object({
  id: z.string().min(1),
  catalogId: catalogIdSchema,
  name: z.string().min(1),
  categoryPath: z.array(z.string()),
  tags: z.array(z.string()),
  lifecycle: lifecycleStateSchema,
  ueAssets: z.array(z.string()),
  links: z.array(catalogLinkSchema).optional(),
  recipeId: z.string().min(1),
  featureName: z.string().optional(),
  lastVerifiedAt: z.string().optional(),
  lastTestResult: testResultSchema.optional(),
});

export const abilityDataSchema = z.object({
  baseClass: z.string().min(1),
  costAttribute: z.enum(['Mana', 'Stamina']).optional(),
  costAmount: z.number().nonnegative().optional(),
  cooldown: z.number().nonnegative().optional(),
  damageBase: z.number().nonnegative().optional(),
  damageType: z.enum(['Physical', 'Fire', 'Frost', 'Lightning', 'Arcane', 'Poison']).optional(),
  tags: z.object({
    activation: z.string().min(1),
    cooldown: z.string().optional(),
    cost: z.string().optional(),
  }),
  montage: z.string().optional(),
});

export const abilityEntrySchema = catalogEntityBaseSchema.extend({
  catalogId: z.literal('spellbook'),
  data: abilityDataSchema,
});

/**
 * The fields a generation @@CALLBACK posts back (model-supplied only — the
 * trusted catalogId/entityId/step arrive via the callback's staticFields).
 */
export const generationCallbackSchema = z.object({
  ueAssets: z.array(z.string()).default([]),
  testResult: testResultSchema.optional(),
  error: z.string().optional(),
});

export type GenerationCallbackPayload = z.infer<typeof generationCallbackSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/validation.test.ts`
Expected: PASS (7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/validation.ts src/__tests__/lib/catalog/validation.test.ts
git commit -m "feat(catalog): zod schemas for entities + generation callback (folder-09 R1 P1)"
```

---

## Task 4: SQLite table + row⇄entity mappers + CRUD

**Files:**
- Create: `src/lib/catalog-db.ts`
- Test: `src/__tests__/lib/catalog-db.test.ts`

Follows the `scatter-db.ts` pattern: a self-contained `ensureCatalogTable()` (not added to `db.ts`, minimizing shared-file contact). The pure mappers are exported and unit-tested (hermetic — no live DB); the CRUD functions are thin wrappers exercised live by the Phase-2 callback tests.

- [ ] **Step 1: Write the failing test (mapper round-trip)**

```ts
// src/__tests__/lib/catalog-db.test.ts
import { describe, it, expect } from 'vitest';
import { rowToEntity, entityToRow } from '@/lib/catalog-db';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const entity: StoredCatalogEntity = {
  id: 'ga-fireball',
  catalogId: 'spellbook',
  name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'],
  tags: ['aoe'],
  lifecycle: 'generated',
  ueAssets: ['/Script/PoF.GA_Fireball'],
  links: [{ catalogId: 'loot-tables', entityId: 'lt-fire', role: 'loot' }],
  recipeId: 'spellbook-ga',
  featureName: 'fireball',
  lastTestResult: 'pass',
  lastVerifiedAt: '2026-05-24T00:00:00.000Z',
  data: { baseClass: 'GA_Projectile', damageBase: 45 },
};

describe('catalog-db mappers', () => {
  it('round-trips an entity through row form', () => {
    const round = rowToEntity(entityToRow(entity));
    expect(round).toEqual(entity);
  });

  it('parses JSON array/object columns and defaults empties', () => {
    const row = {
      id: 'x', catalog_id: 'items', name: 'X',
      category_path: '[]', tags: '[]', lifecycle: 'planned',
      ue_assets: '[]', links: null, recipe_id: 'r', feature_name: null,
      data: '{}', last_verified_at: null, last_test_result: null,
    };
    const e = rowToEntity(row);
    expect(e.categoryPath).toEqual([]);
    expect(e.links).toBeUndefined();
    expect(e.lastTestResult).toBeUndefined();
    expect(e.data).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog-db.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/catalog-db"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/catalog-db.ts
import { getDb } from '@/lib/db';
import type { CatalogId, StoredCatalogEntity } from '@/lib/catalog/types';

function ensureCatalogTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS catalog_entities (
      id TEXT NOT NULL,
      catalog_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category_path TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      lifecycle TEXT NOT NULL DEFAULT 'planned',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      links TEXT,
      recipe_id TEXT NOT NULL DEFAULT '',
      feature_name TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      last_verified_at TEXT,
      last_test_result TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, id)
    )
  `);
}

/** Column row → typed entity. Pure (exported for unit test). */
export function rowToEntity(row: Record<string, unknown>): StoredCatalogEntity {
  return {
    id: row.id as string,
    catalogId: row.catalog_id as CatalogId,
    name: row.name as string,
    categoryPath: JSON.parse((row.category_path as string) || '[]'),
    tags: JSON.parse((row.tags as string) || '[]'),
    lifecycle: row.lifecycle as StoredCatalogEntity['lifecycle'],
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    links: row.links ? JSON.parse(row.links as string) : undefined,
    recipeId: (row.recipe_id as string) || '',
    featureName: (row.feature_name as string | null) ?? undefined,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? undefined,
    lastTestResult: (row.last_test_result as 'pass' | 'fail' | null) ?? undefined,
    data: JSON.parse((row.data as string) || '{}'),
  };
}

/** Typed entity → column row. Pure (exported for unit test). */
export function entityToRow(entity: StoredCatalogEntity): Record<string, unknown> {
  return {
    id: entity.id,
    catalog_id: entity.catalogId,
    name: entity.name,
    category_path: JSON.stringify(entity.categoryPath),
    tags: JSON.stringify(entity.tags),
    lifecycle: entity.lifecycle,
    ue_assets: JSON.stringify(entity.ueAssets),
    links: entity.links ? JSON.stringify(entity.links) : null,
    recipe_id: entity.recipeId,
    feature_name: entity.featureName ?? null,
    data: JSON.stringify(entity.data ?? {}),
    last_verified_at: entity.lastVerifiedAt ?? null,
    last_test_result: entity.lastTestResult ?? null,
  };
}

export function listEntities(catalogId: CatalogId): StoredCatalogEntity[] {
  ensureCatalogTable();
  const rows = getDb()
    .prepare('SELECT * FROM catalog_entities WHERE catalog_id = ? ORDER BY name')
    .all(catalogId) as Record<string, unknown>[];
  return rows.map(rowToEntity);
}

export function getEntity(catalogId: CatalogId, id: string): StoredCatalogEntity | null {
  ensureCatalogTable();
  const row = getDb()
    .prepare('SELECT * FROM catalog_entities WHERE catalog_id = ? AND id = ?')
    .get(catalogId, id) as Record<string, unknown> | undefined;
  return row ? rowToEntity(row) : null;
}

export function upsertEntity(entity: StoredCatalogEntity): StoredCatalogEntity {
  ensureCatalogTable();
  const r = entityToRow(entity);
  getDb().prepare(`
    INSERT INTO catalog_entities
      (id, catalog_id, name, category_path, tags, lifecycle, ue_assets, links,
       recipe_id, feature_name, data, last_verified_at, last_test_result, updated_at)
    VALUES
      (@id, @catalog_id, @name, @category_path, @tags, @lifecycle, @ue_assets, @links,
       @recipe_id, @feature_name, @data, @last_verified_at, @last_test_result, datetime('now'))
    ON CONFLICT(catalog_id, id) DO UPDATE SET
      name=@name, category_path=@category_path, tags=@tags, lifecycle=@lifecycle,
      ue_assets=@ue_assets, links=@links, recipe_id=@recipe_id, feature_name=@feature_name,
      data=@data, last_verified_at=@last_verified_at, last_test_result=@last_test_result,
      updated_at=datetime('now')
  `).run(r);
  return getEntity(entity.catalogId, entity.id)!;
}

export function deleteEntity(catalogId: CatalogId, id: string): boolean {
  ensureCatalogTable();
  const info = getDb()
    .prepare('DELETE FROM catalog_entities WHERE catalog_id = ? AND id = ?')
    .run(catalogId, id);
  return info.changes > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog-db.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog-db.ts src/__tests__/lib/catalog-db.test.ts
git commit -m "feat(catalog): catalog_entities table + row mappers + CRUD (folder-09 R1 P1)"
```

---

## Task 5: Zustand catalog store

**Files:**
- Create: `src/stores/catalogStore.ts`
- Test: `src/__tests__/stores/catalogStore.test.ts`

Mirrors `moduleStore` conventions: `persist` + `createJSONStorage(localStorage)`, `set()` returns `state` unchanged on no-op, and the **transient `generationRuns` map is excluded from `partialize`** (the documented `isRunning` rehydration-instability lesson). Lifecycle changes go through the shared gate from Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/stores/catalogStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore, partializeCatalogState } from '@/stores/catalogStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
// localStorage mock is installed by vitest setupFiles (src/__tests__/setup.ts)

function makeEntity(over: Partial<StoredCatalogEntity> = {}): StoredCatalogEntity {
  return {
    id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
    categoryPath: ['Offensive', 'Fire'], tags: ['aoe'], lifecycle: 'planned',
    ueAssets: [], recipeId: 'spellbook-ga', data: { baseClass: 'GA_Projectile' },
    ...over,
  };
}

function reset() {
  useCatalogStore.setState({ entitiesByCatalog: {}, generationRuns: {} });
}

describe('useCatalogStore', () => {
  beforeEach(reset);

  describe('upsertEntity / removeEntity', () => {
    it('adds an entity under its catalog', () => {
      useCatalogStore.getState().upsertEntity(makeEntity());
      expect(useCatalogStore.getState().entitiesByCatalog['spellbook']['ga-fireball'].name).toBe('Fireball');
    });

    it('removes an entity', () => {
      useCatalogStore.getState().upsertEntity(makeEntity());
      useCatalogStore.getState().removeEntity('spellbook', 'ga-fireball');
      expect(useCatalogStore.getState().entitiesByCatalog['spellbook']?.['ga-fireball']).toBeUndefined();
    });
  });

  describe('applyGenerationResult (lifecycle gate)', () => {
    it('advances one step forward', () => {
      useCatalogStore.getState().upsertEntity(makeEntity({ lifecycle: 'planned' }));
      useCatalogStore.getState().applyGenerationResult({
        catalogId: 'spellbook', entityId: 'ga-fireball', nextLifecycle: 'scaffolded',
      });
      expect(useCatalogStore.getState().entitiesByCatalog['spellbook']['ga-fireball'].lifecycle).toBe('scaffolded');
    });

    it('does NOT promote to verified without a passing test', () => {
      useCatalogStore.getState().upsertEntity(makeEntity({ lifecycle: 'wired' }));
      useCatalogStore.getState().applyGenerationResult({
        catalogId: 'spellbook', entityId: 'ga-fireball', nextLifecycle: 'verified', testResult: 'fail',
      });
      expect(useCatalogStore.getState().entitiesByCatalog['spellbook']['ga-fireball'].lifecycle).toBe('wired');
    });

    it('promotes to verified with a passing test and records the verdict', () => {
      useCatalogStore.getState().upsertEntity(makeEntity({ lifecycle: 'wired' }));
      useCatalogStore.getState().applyGenerationResult({
        catalogId: 'spellbook', entityId: 'ga-fireball', nextLifecycle: 'verified', testResult: 'pass',
        ueAssets: ['/Script/PoF.GA_Fireball'],
      });
      const e = useCatalogStore.getState().entitiesByCatalog['spellbook']['ga-fireball'];
      expect(e.lifecycle).toBe('verified');
      expect(e.lastTestResult).toBe('pass');
      expect(e.ueAssets).toContain('/Script/PoF.GA_Fireball');
    });

    it('rejects an illegal skip and leaves state unchanged', () => {
      useCatalogStore.getState().upsertEntity(makeEntity({ lifecycle: 'planned' }));
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().applyGenerationResult({
        catalogId: 'spellbook', entityId: 'ga-fireball', nextLifecycle: 'verified', testResult: 'pass',
      });
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });

    it('is a no-op for an unknown entity', () => {
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().applyGenerationResult({
        catalogId: 'spellbook', entityId: 'missing', nextLifecycle: 'scaffolded',
      });
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });
  });

  describe('persistence', () => {
    it('excludes transient generationRuns from the persisted slice', () => {
      const persisted = partializeCatalogState({
        entitiesByCatalog: { spellbook: { 'ga-fireball': makeEntity() } },
        generationRuns: { 'spellbook:ga-fireball': { entityId: 'ga-fireball', step: 'scaffold-cpp', startedAt: 1 } },
      } as never);
      expect(persisted).toHaveProperty('entitiesByCatalog');
      expect(persisted).not.toHaveProperty('generationRuns');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/catalogStore.test.ts`
Expected: FAIL — `Failed to resolve import "@/stores/catalogStore"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/stores/catalogStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CatalogId,
  LifecycleState,
  StoredCatalogEntity,
  TestResult,
} from '@/lib/catalog/types';
import { resolveTransition } from '@/lib/catalog/lifecycle';

/** Transient per-entity generation run state — NEVER persisted. */
export interface GenerationRun {
  entityId: string;
  step: string;
  startedAt: number;
}

interface CatalogState {
  entitiesByCatalog: Record<string, Record<string, StoredCatalogEntity>>;
  /** Keyed by `${catalogId}:${entityId}`. Excluded from persist. */
  generationRuns: Record<string, GenerationRun>;

  upsertEntity: (entity: StoredCatalogEntity) => void;
  removeEntity: (catalogId: CatalogId, id: string) => void;
  applyGenerationResult: (input: {
    catalogId: CatalogId;
    entityId: string;
    nextLifecycle: LifecycleState;
    ueAssets?: string[];
    testResult?: TestResult;
  }) => void;
  setGenerationRun: (catalogId: CatalogId, run: GenerationRun | null) => void;
}

/** Exported for deterministic unit-testing of the persisted slice. */
export function partializeCatalogState(state: CatalogState) {
  return { entitiesByCatalog: state.entitiesByCatalog };
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      entitiesByCatalog: {},
      generationRuns: {},

      upsertEntity: (entity) =>
        set((state) => ({
          entitiesByCatalog: {
            ...state.entitiesByCatalog,
            [entity.catalogId]: {
              ...(state.entitiesByCatalog[entity.catalogId] ?? {}),
              [entity.id]: entity,
            },
          },
        })),

      removeEntity: (catalogId, id) =>
        set((state) => {
          const catalog = state.entitiesByCatalog[catalogId];
          if (!catalog || !(id in catalog)) return state;
          const next = { ...catalog };
          delete next[id];
          return { entitiesByCatalog: { ...state.entitiesByCatalog, [catalogId]: next } };
        }),

      applyGenerationResult: ({ catalogId, entityId, nextLifecycle, ueAssets, testResult }) =>
        set((state) => {
          const current = state.entitiesByCatalog[catalogId]?.[entityId];
          if (!current) return state;
          const resolved = resolveTransition(current.lifecycle, nextLifecycle, testResult);
          if (!resolved) return state;
          const mergedAssets = ueAssets
            ? Array.from(new Set([...current.ueAssets, ...ueAssets]))
            : current.ueAssets;
          const updated: StoredCatalogEntity = {
            ...current,
            lifecycle: resolved,
            ueAssets: mergedAssets,
            ...(testResult ? { lastTestResult: testResult } : {}),
            ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
          };
          return {
            entitiesByCatalog: {
              ...state.entitiesByCatalog,
              [catalogId]: { ...state.entitiesByCatalog[catalogId], [entityId]: updated },
            },
          };
        }),

      setGenerationRun: (catalogId, run) =>
        set((state) => {
          const key = `${catalogId}:${run?.entityId ?? ''}`;
          const next = { ...state.generationRuns };
          if (run) next[key] = run;
          else if (run === null) {
            // clear all runs for this catalog when entityId unknown is not given;
            // callers pass the run to set, null to clear by the last-known key is avoided —
            // clearing is handled by removing matching keys for the catalog.
          }
          return { generationRuns: next };
        }),
    }),
    {
      name: 'pof-catalog',
      storage: createJSONStorage(() => localStorage),
      partialize: partializeCatalogState,
    },
  ),
);
```

> Note: `setGenerationRun`'s clear-path is intentionally minimal here (Phase 1 has no UI consumer). Phase 2 (batch dispatcher) finalizes its clear semantics with its own tests; do not expand it now (YAGNI).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/catalogStore.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/stores/catalogStore.ts src/__tests__/stores/catalogStore.test.ts
git commit -m "feat(catalog): catalogStore with gated lifecycle + transient-excluded persist (folder-09 R1 P1)"
```

---

## Task 6: `/api/catalog` route

**Files:**
- Create: `src/app/api/catalog/route.ts`

Composes Tasks 2–4 behind the standard `{ success, data }` envelope. `GET` lists a catalog or fetches one entity; `POST` does `upsert` (zod-validated) or `transition` (the generation-callback target — applies the lifecycle gate **server-side** so a tampered client can't skip the functional-test gate). No dedicated integration test in this phase (it would write to the live `~/.pof/pof.db`); its logic is covered by the unit tests of the gate/validation/db it composes, and exercised end-to-end by the Phase-2 callback tests (spec tests #10/#12). Keep the file ≤200 LOC.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/catalog/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  listEntities,
  getEntity,
  upsertEntity,
} from '@/lib/catalog-db';
import {
  abilityEntrySchema,
  generationCallbackSchema,
  lifecycleStateSchema,
  catalogIdSchema,
} from '@/lib/catalog/validation';
import { resolveTransition } from '@/lib/catalog/lifecycle';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

/**
 * GET /api/catalog?catalogId=spellbook            → StoredCatalogEntity[]
 * GET /api/catalog?catalogId=spellbook&id=ga-fireball → StoredCatalogEntity
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const catalogId = catalogIdSchema.safeParse(searchParams.get('catalogId'));
    if (!catalogId.success) return apiError('Valid catalogId is required', 400);
    const id = searchParams.get('id');
    if (id) {
      const entity = getEntity(catalogId.data, id);
      if (!entity) return apiError('Entity not found', 404);
      return apiSuccess(entity);
    }
    return apiSuccess(listEntities(catalogId.data));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog GET failed', 500);
  }
}

/**
 * POST /api/catalog
 *   { action: 'upsert', entity }
 *   { action: 'transition', catalogId, entityId, nextLifecycle, ueAssets?, testResult? }
 *     ↑ the generation @@CALLBACK target — applies the lifecycle gate server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'upsert') {
      // Round 1 only ships the spellbook schema; extend per-section in Round 3.
      const parsed = abilityEntrySchema.safeParse(body.entity);
      if (!parsed.success) return apiError('Invalid entity', 400, parsed.error.issues);
      const saved = upsertEntity(parsed.data as StoredCatalogEntity);
      return apiSuccess(saved);
    }

    if (action === 'transition') {
      const catalogId = catalogIdSchema.safeParse(body.catalogId);
      const next = lifecycleStateSchema.safeParse(body.nextLifecycle);
      const entityId = typeof body.entityId === 'string' ? body.entityId : '';
      if (!catalogId.success || !next.success || !entityId) {
        return apiError('catalogId, entityId, and a valid nextLifecycle are required', 400);
      }
      const payload = generationCallbackSchema.safeParse({
        ueAssets: body.ueAssets,
        testResult: body.testResult,
        error: body.error,
      });
      if (!payload.success) return apiError('Invalid callback payload', 400, payload.error.issues);

      const current = getEntity(catalogId.data, entityId);
      if (!current) return apiError('Entity not found', 404);

      const resolved = resolveTransition(current.lifecycle, next.data, payload.data.testResult);
      if (!resolved) {
        return apiError(
          `Illegal lifecycle transition ${current.lifecycle} → ${next.data}` +
            (next.data === 'verified' ? ' (verified requires a passing test)' : ''),
          409,
        );
      }

      const updated: StoredCatalogEntity = {
        ...current,
        lifecycle: resolved,
        ueAssets: Array.from(new Set([...current.ueAssets, ...payload.data.ueAssets])),
        ...(payload.data.testResult ? { lastTestResult: payload.data.testResult } : {}),
        ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
      };
      return apiSuccess(upsertEntity(updated));
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog POST failed', 500);
  }
}
```

- [ ] **Step 2: Typecheck + lint the new route**

Run: `npx tsc --noEmit` then `npx eslint src/app/api/catalog/route.ts src/lib/catalog src/stores/catalogStore.ts`
Expected: no errors. (zod v4: `parsed.error.issues` is the correct accessor.)

- [ ] **Step 3: Run the full Phase-1 test set**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/lib/catalog-db.test.ts src/__tests__/stores/catalogStore.test.ts`
Expected: PASS — all of lifecycle (9), validation (7), catalog-db (2), catalogStore (8).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalog/route.ts
git commit -m "feat(catalog): /api/catalog CRUD + server-side lifecycle gate (folder-09 R1 P1)"
```

---

## Final verification (Phase 1 done)

- [ ] **Step 1: Full validate**

Run: `npm run validate`
Expected: typecheck + lint + test all green. If a failure references a file you did **not** create this phase (e.g. the foreign `ue-gotchas.test.ts.snap`), it belongs to a concurrent session — note it, do not "fix" it, and confirm your own catalog tests pass via the targeted command in Task 6 Step 3.

- [ ] **Step 2: Confirm the deliverable**

The data layer is complete and tested: catalog entities can be created/validated/persisted, the lifecycle gate provably forbids skips and ungated `verified` promotion (both in the store and in the route), and transient generation-run state is provably excluded from persistence. This unblocks Phase 2 (generation engine), which adds `recipe.ts` / `batch.ts` / `TaskFactory.generate` and the `@@CALLBACK` wiring that drives the `transition` action built here.

---

## Self-review notes (for the executor)

- **Spec coverage (§3.2–§3.4):** entity model ✔ (Task 1), lifecycle state machine + gate ✔ (Task 2, store + route), zod for entities + callback payload ✔ (Task 3), `catalog_entities` table + persistence ✔ (Tasks 4–5), transient-excluded persist ✔ (Task 5), `/api/catalog` envelope ✔ (Task 6). Deferred to later phases by design: `CatalogSectionSchema` UI descriptor + `design-tokens.ts` (Phase 4), recipe/batch/`TaskFactory.generate`/`.withAssetSpec` (Phase 2).
- **Type consistency:** `StoredCatalogEntity`, `CatalogId`, `LifecycleState`, `TestResult`, `resolveTransition`, `partializeCatalogState`, `rowToEntity`/`entityToRow`, `applyGenerationResult` are used with identical signatures across tasks and tests.
- **No placeholders:** every code step is complete and runnable.
