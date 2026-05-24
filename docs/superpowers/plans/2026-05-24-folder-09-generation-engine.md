# Folder 09 · Round 1 (revised, extends Step-1) — Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the *generation* layer on top of the already-merged folder-09 "Step-1" catalog (catalog core + `catalogStore` seed + Spellbook retrofit): a gated lifecycle state machine, zod-validated server-side lifecycle persistence (the dispatched-CLI `@@CALLBACK` target), the recipe/batch generation engine, and a **live-UE Spellbook generate+verify** for `GA_Fireball`.

**Architecture:** Step-1's `src/lib/catalog/types.ts` + `src/stores/catalogStore.ts` are reused; this plan **extends them additively** (optional fields + new actions) and adds new, non-conflicting modules. The generation flow: a Spellbook "(Re)generate" affordance → `recipe`/`TaskFactory.generate` dispatches a Claude-Code CLI session (writes UE files, builds, runs a functional test) → the session emits a `@@CALLBACK` → the terminal POSTs to `/api/catalog` → server validates + applies the lifecycle gate + persists → the client store merges the result and the existing `LifecycleBadge` updates.

**Tech Stack:** TypeScript, Zustand v5 (`persist`/`useShallow`), zod v4, better-sqlite3, Next.js 16 route handlers, Vitest. UE5 C++ + Python + `AFunctionalTest` for the live proof.

**Spec:** [`docs/superpowers/specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md`](../specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md) — see **§0 REVISION**.

**Reuse from Step-1 (do NOT rebuild/replace):** `src/lib/catalog/types.ts`, `src/lib/catalog/seed-spellbook.ts`, `src/stores/catalogStore.ts` (+ `useCatalogEntities`/`useCatalogEntity`/`useSpellbookEntries`), `src/components/catalog/LifecycleBadge.tsx`, the `AbilitySpellbook` unique-tab UI, and the existing `src/__tests__/lib/catalog-seed.test.ts` + `src/__tests__/stores/catalogStore.test.ts`. **Edits to Step-1 files must be additive** (new optional fields / new store actions) — they must not break the existing seed tests or the Spellbook UI.

**Concurrency discipline (shared app repo, 50+ live worktrees):** re-read every Step-1 file immediately before editing it; commit with a **targeted `git add` of only the exact files each task changes** (never `git add -A`); never stage the foreign `ue-gotchas.test.ts.snap` or other sessions' files; commit locally to master (operator pushes). UE side: `-abslog`, narrow commits, coordinate the single editor.

---

## Phases

- **Phase A — Lifecycle + persistence foundation (this plan, fully detailed below).** Extend types, the shared gate, zod validation, `catalog_lifecycle` DB + `/api/catalog`, and additive store actions. Pure/server, fully unit-tested. Unblocks B.
- **Phase B — Generation engine (planned after A lands).** `recipe.ts`/`batch.ts`, `PromptBuilder.withAssetSpec`, a `'generate'` `CLITaskType` + `TaskFactory.generate`, the `useGeneration` hook, and the Spellbook "(Re)generate" affordance on the existing tab. Tests: recipe prompt snapshot, `@@CALLBACK` merge, batch single-dispatch isolation, lifecycle-gate end-to-end.
- **Phase C — Live UE proof (planned after B lands).** The Spellbook recipe generates gray-box `GA_Fireball` into the UE project; `AVSAbility_GA_Fireball` `AFunctionalTest` passes live; lifecycle reaches `verified`.

Phases B and C get their own detailed task plans once A is green (later phases depend on A's exact shapes). This file details **Phase A**.

---

## Phase A file structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/catalog/types.ts` | + optional `ueAssets?`/`lastTestResult?`/`lastVerifiedAt?` on `CatalogEntityBase`; + `TestResult`, `LifecycleRecord` | **Modify (additive)** |
| `src/lib/catalog/lifecycle.ts` | `canTransition`, `resolveTransition` — the shared gate | Create |
| `src/lib/catalog/validation.ts` | zod `lifecycleStateSchema`, `generationCallbackSchema` | Create |
| `src/lib/catalog-db.ts` | `catalog_lifecycle` table, row mapper, CRUD | Create |
| `src/app/api/catalog/route.ts` | GET lifecycle list / POST `transition` (server-side gate) | Create |
| `src/stores/catalogStore.ts` | + `applyLifecycle` + `loadLifecycle` actions | **Modify (additive)** |
| `src/__tests__/lib/catalog/lifecycle.test.ts` | gate tests | Create |
| `src/__tests__/lib/catalog/validation.test.ts` | zod tests | Create |
| `src/__tests__/lib/catalog-db.test.ts` | mapper round-trip (hermetic) | Create |
| `src/__tests__/stores/catalogStore-lifecycle.test.ts` | additive store-action tests (separate file — do not touch the Step-1 store test) | Create |

---

## Task A1: Extend catalog types additively

**Files:**
- Modify: `src/lib/catalog/types.ts`

Add only optional fields + two new exports. The existing `AbilityEntry`, `CatalogEntityBase` required fields, and `LifecycleState` stay byte-identical so Step-1's seed converter, store, UI, and tests are unaffected.

- [ ] **Step 1: Re-read the current file, then replace its contents**

Re-read `src/lib/catalog/types.ts` (another session owns it). Confirm it still matches the block below's "existing" portion; if it has diverged, stop and reconcile. Then write:

```ts
import type { SpellbookAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** Functional-test verdict from the verify step. */
export type TestResult = 'pass' | 'fail';

/** The shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  id: string;
  catalogId: string;        // 'spellbook' (more catalogs added by later 09 steps)
  name: string;
  categoryPath: string[];   // e.g. ['Offensive','Fire'] — the future L4 hierarchy
  tags: string[];           // e.g. ['basic']
  lifecycle: LifecycleState;
  // ── Generation outputs (added by the Round-1 generation engine). Optional so
  //    statically-seeded entities remain valid without them. ──
  /** UE asset paths this entity owns once generated. */
  ueAssets?: string[];
  /** Last functional-test verdict from the verify step. */
  lastTestResult?: TestResult;
  /** ISO timestamp of the last passing verify. */
  lastVerifiedAt?: string;
}

/** Ability catalog entity — payload reuses the existing UI shape, rendered unchanged. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: SpellbookAbility;
}

/**
 * A lifecycle/generation record persisted server-side (DB) and merged over the
 * statically-seeded entities at load time. The DB owns lifecycle/ueAssets/test
 * results; the static seed owns the design `data`.
 */
export interface LifecycleRecord {
  catalogId: string;
  entityId: string;
  lifecycle: LifecycleState;
  ueAssets: string[];
  lastTestResult?: TestResult;
  lastVerifiedAt?: string;
}
```

- [ ] **Step 2: Verify Step-1 tests still pass (no regression from the additive change)**

Run: `npx vitest run src/__tests__/lib/catalog-seed.test.ts src/__tests__/stores/catalogStore.test.ts`
Expected: PASS (the added fields are optional; nothing existing references them).

- [ ] **Step 3: Commit**

```bash
git add src/lib/catalog/types.ts
git commit -m "feat(catalog): additive generation fields + LifecycleRecord on catalog types (folder-09 R1)"
```

---

## Task A2: Lifecycle gate (`canTransition`, `resolveTransition`)

**Files:**
- Create: `src/lib/catalog/lifecycle.ts`
- Test: `src/__tests__/lib/catalog/lifecycle.test.ts`

Forward moves advance **exactly one** step along the lifecycle; `wired→verified` requires a **passing** test; anything may move to `failed`; a `failed` entity may reset to `planned`.

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
import type { LifecycleState, TestResult } from '@/lib/catalog/types';

const ORDER: LifecycleState[] = ['planned', 'scaffolded', 'generated', 'wired', 'verified'];

/**
 * Structurally legal transition?  any → 'failed'; 'failed' → 'planned' (retry);
 * otherwise exactly one step forward along ORDER.
 */
export function canTransition(current: LifecycleState, next: LifecycleState): boolean {
  if (next === 'failed') return true;
  if (current === 'failed') return next === 'planned';
  const ci = ORDER.indexOf(current);
  const ni = ORDER.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

/**
 * The gate: returns the lifecycle to commit, or null to reject. `wired→verified`
 * additionally requires a passing functional test (the "compiles ≠ runs" rule).
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
Expected: PASS (9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/lifecycle.ts src/__tests__/lib/catalog/lifecycle.test.ts
git commit -m "feat(catalog): gated lifecycle state machine (folder-09 R1)"
```

---

## Task A3: zod validation for the generation callback

**Files:**
- Create: `src/lib/catalog/validation.ts`
- Test: `src/__tests__/lib/catalog/validation.test.ts`

Validates the `@@CALLBACK` payload (model-supplied `ueAssets`/`testResult`/`error`) and the `nextLifecycle` before any lifecycle transition, so malformed/injected output can't advance state.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/validation.test.ts
import { describe, it, expect } from 'vitest';
import { generationCallbackSchema, lifecycleStateSchema } from '@/lib/catalog/validation';

describe('generationCallbackSchema', () => {
  it('accepts ueAssets + a pass result', () => {
    expect(generationCallbackSchema.safeParse({
      ueAssets: ['/Script/PoF.GA_Fireball'], testResult: 'pass',
    }).success).toBe(true);
  });
  it('defaults ueAssets to an empty array when omitted', () => {
    expect(generationCallbackSchema.parse({}).ueAssets).toEqual([]);
  });
  it('rejects an invalid testResult', () => {
    expect(generationCallbackSchema.safeParse({ testResult: 'maybe' }).success).toBe(false);
  });
  it('rejects non-string ueAssets entries', () => {
    expect(generationCallbackSchema.safeParse({ ueAssets: [42] }).success).toBe(false);
  });
});

describe('lifecycleStateSchema', () => {
  it('accepts a known state', () => {
    expect(lifecycleStateSchema.safeParse('scaffolded').success).toBe(true);
  });
  it('rejects an unknown state', () => {
    expect(lifecycleStateSchema.safeParse('done').success).toBe(false);
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

export const lifecycleStateSchema = z.enum([
  'planned', 'scaffolded', 'generated', 'wired', 'verified', 'failed',
]);

export const testResultSchema = z.enum(['pass', 'fail']);

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
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/validation.ts src/__tests__/lib/catalog/validation.test.ts
git commit -m "feat(catalog): zod validation for generation callback payload (folder-09 R1)"
```

---

## Task A4: `catalog_lifecycle` table + mapper + CRUD

**Files:**
- Create: `src/lib/catalog-db.ts`
- Test: `src/__tests__/lib/catalog-db.test.ts`

Server-side persistence of lifecycle/generation results, keyed by `(catalog_id, entity_id)` — the durable store the `@@CALLBACK` writes and the client merges over the static seed. Follows the `scatter-db.ts` self-contained-`ensure` pattern. The pure `rowToLifecycle` mapper is unit-tested (hermetic).

- [ ] **Step 1: Write the failing test (mapper)**

```ts
// src/__tests__/lib/catalog-db.test.ts
import { describe, it, expect } from 'vitest';
import { rowToLifecycle } from '@/lib/catalog-db';

describe('rowToLifecycle', () => {
  it('maps a full row', () => {
    const rec = rowToLifecycle({
      catalog_id: 'spellbook', entity_id: 'off-fire-01', lifecycle: 'verified',
      ue_assets: '["/Script/PoF.GA_Fireball"]', last_test_result: 'pass',
      last_verified_at: '2026-05-24T00:00:00.000Z',
    });
    expect(rec).toEqual({
      catalogId: 'spellbook', entityId: 'off-fire-01', lifecycle: 'verified',
      ueAssets: ['/Script/PoF.GA_Fireball'], lastTestResult: 'pass',
      lastVerifiedAt: '2026-05-24T00:00:00.000Z',
    });
  });
  it('defaults empty ue_assets and omits null optionals', () => {
    const rec = rowToLifecycle({
      catalog_id: 'spellbook', entity_id: 'x', lifecycle: 'planned',
      ue_assets: '[]', last_test_result: null, last_verified_at: null,
    });
    expect(rec.ueAssets).toEqual([]);
    expect(rec.lastTestResult).toBeUndefined();
    expect(rec.lastVerifiedAt).toBeUndefined();
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
import type { LifecycleRecord, LifecycleState, TestResult } from '@/lib/catalog/types';

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS catalog_lifecycle (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      lifecycle TEXT NOT NULL DEFAULT 'planned',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      last_test_result TEXT,
      last_verified_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);
}

/** Column row → LifecycleRecord. Pure (exported for unit test). */
export function rowToLifecycle(row: Record<string, unknown>): LifecycleRecord {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    lifecycle: row.lifecycle as LifecycleState,
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    lastTestResult: (row.last_test_result as TestResult | null) ?? undefined,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? undefined,
  };
}

export function listLifecycle(catalogId: string): LifecycleRecord[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT * FROM catalog_lifecycle WHERE catalog_id = ?')
    .all(catalogId) as Record<string, unknown>[];
  return rows.map(rowToLifecycle);
}

export function getLifecycle(catalogId: string, entityId: string): LifecycleRecord | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM catalog_lifecycle WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToLifecycle(row) : null;
}

export function upsertLifecycle(rec: LifecycleRecord): LifecycleRecord {
  ensureTable();
  getDb().prepare(`
    INSERT INTO catalog_lifecycle
      (catalog_id, entity_id, lifecycle, ue_assets, last_test_result, last_verified_at, updated_at)
    VALUES (@catalog_id, @entity_id, @lifecycle, @ue_assets, @last_test_result, @last_verified_at, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      lifecycle=@lifecycle, ue_assets=@ue_assets, last_test_result=@last_test_result,
      last_verified_at=@last_verified_at, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    lifecycle: rec.lifecycle,
    ue_assets: JSON.stringify(rec.ueAssets),
    last_test_result: rec.lastTestResult ?? null,
    last_verified_at: rec.lastVerifiedAt ?? null,
  });
  return getLifecycle(rec.catalogId, rec.entityId)!;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog-db.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog-db.ts src/__tests__/lib/catalog-db.test.ts
git commit -m "feat(catalog): catalog_lifecycle table + mapper + CRUD (folder-09 R1)"
```

---

## Task A5: Additive store actions (`applyLifecycle`, `loadLifecycle`)

**Files:**
- Modify: `src/stores/catalogStore.ts`
- Test: `src/__tests__/stores/catalogStore-lifecycle.test.ts` (new file — leave the Step-1 `catalogStore.test.ts` untouched)

`applyLifecycle` updates an entity's lifecycle in-memory through the shared gate (optimistic UI + post-callback sync). `loadLifecycle` merges server-side `LifecycleRecord[]` over seeded entities on app load. Both are additive; the existing seed/selectors/`merge` are unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/stores/catalogStore-lifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
// localStorage mock installed by src/__tests__/setup.ts

const SEED_ID = 'off-fire-01'; // 'Fireball' — present in SPELLBOOK_ABILITIES

function lifecycleOf(id: string) {
  return useCatalogStore.getState().entitiesByCatalog.spellbook[id].lifecycle;
}

describe('catalogStore lifecycle actions', () => {
  beforeEach(() => {
    // restore the seeded Fireball to 'planned' without disturbing other entries
    const s = useCatalogStore.getState();
    const e = s.entitiesByCatalog.spellbook[SEED_ID];
    s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
      x.id === SEED_ID ? { ...e, lifecycle: 'planned', ueAssets: undefined, lastTestResult: undefined } : x,
    ));
  });

  describe('applyLifecycle', () => {
    it('advances one legal step and merges ueAssets', () => {
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'scaffolded',
        ueAssets: ['/Script/PoF.GA_Fireball'],
      });
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('scaffolded');
      expect(e.ueAssets).toContain('/Script/PoF.GA_Fireball');
    });

    it('does NOT promote to verified without a passing test', () => {
      const s = useCatalogStore.getState();
      s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
        x.id === SEED_ID ? { ...x, lifecycle: 'wired' } : x));
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'fail',
      });
      expect(lifecycleOf(SEED_ID)).toBe('wired');
    });

    it('promotes to verified with a pass and records the verdict', () => {
      const s = useCatalogStore.getState();
      s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
        x.id === SEED_ID ? { ...x, lifecycle: 'wired' } : x));
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'pass',
      });
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('verified');
      expect(e.lastTestResult).toBe('pass');
      expect(e.lastVerifiedAt).toBeTruthy();
    });

    it('rejects an illegal skip (state unchanged)', () => {
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'pass',
      });
      expect(lifecycleOf(SEED_ID)).toBe('planned');
    });

    it('is a no-op for an unknown entity', () => {
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: 'nope', nextLifecycle: 'scaffolded',
      });
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });
  });

  describe('loadLifecycle', () => {
    it('merges DB lifecycle records over seeded entities', () => {
      useCatalogStore.getState().loadLifecycle([
        { catalogId: 'spellbook', entityId: SEED_ID, lifecycle: 'generated', ueAssets: ['/x'] },
      ]);
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('generated');
      expect(e.ueAssets).toEqual(['/x']);
      expect(e.name).toBe('Fireball'); // design data preserved
    });

    it('ignores records for unknown entities', () => {
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().loadLifecycle([
        { catalogId: 'spellbook', entityId: 'ghost', lifecycle: 'wired', ueAssets: [] },
      ]);
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });
  });
});
```

> Note on `SEED_ID`: the Step-1 store test asserts `entitiesByCatalog.spellbook['off-fire-01'].name === 'Fireball'`, so `off-fire-01` is a stable seeded id. If `npx vitest run src/__tests__/stores/catalogStore.test.ts` shows a different id, use that id here.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/catalogStore-lifecycle.test.ts`
Expected: FAIL — `applyLifecycle is not a function`.

- [ ] **Step 3: Re-read `catalogStore.ts`, then add the two actions (additive)**

Re-read `src/stores/catalogStore.ts`. Add `LifecycleState`, `TestResult`, `LifecycleRecord` to the type import, add the two action signatures to `CatalogState`, import `resolveTransition`, and add the two implementations inside `create(persist(...))` — leaving `entitiesByCatalog`, `setEntities`, the `merge`, and all selectors unchanged.

Add to the import block:
```ts
import type { CatalogEntityBase, AbilityEntry, LifecycleState, TestResult, LifecycleRecord } from '@/lib/catalog/types';
import { resolveTransition } from '@/lib/catalog/lifecycle';
```

Add to the `CatalogState` interface:
```ts
  applyLifecycle: (input: {
    catalogId: string; entityId: string; nextLifecycle: LifecycleState;
    ueAssets?: string[]; testResult?: TestResult;
  }) => void;
  loadLifecycle: (records: LifecycleRecord[]) => void;
```

Add inside the store body (after `setEntities`):
```ts
      applyLifecycle: ({ catalogId, entityId, nextLifecycle, ueAssets, testResult }) =>
        set((s) => {
          const current = s.entitiesByCatalog[catalogId]?.[entityId];
          if (!current) return s;
          const resolved = resolveTransition(current.lifecycle, nextLifecycle, testResult);
          if (!resolved) return s;
          const mergedAssets = ueAssets
            ? Array.from(new Set([...(current.ueAssets ?? []), ...ueAssets]))
            : current.ueAssets;
          const updated: CatalogEntityBase = {
            ...current,
            lifecycle: resolved,
            ...(mergedAssets ? { ueAssets: mergedAssets } : {}),
            ...(testResult ? { lastTestResult: testResult } : {}),
            ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
          };
          return {
            entitiesByCatalog: {
              ...s.entitiesByCatalog,
              [catalogId]: { ...s.entitiesByCatalog[catalogId], [entityId]: updated },
            },
          };
        }),

      loadLifecycle: (records) =>
        set((s) => {
          if (records.length === 0) return s;
          let changed = false;
          const next = { ...s.entitiesByCatalog };
          for (const r of records) {
            const ent = next[r.catalogId]?.[r.entityId];
            if (!ent) continue;
            changed = true;
            next[r.catalogId] = {
              ...next[r.catalogId],
              [r.entityId]: {
                ...ent,
                lifecycle: r.lifecycle,
                ueAssets: r.ueAssets,
                ...(r.lastTestResult ? { lastTestResult: r.lastTestResult } : {}),
                ...(r.lastVerifiedAt ? { lastVerifiedAt: r.lastVerifiedAt } : {}),
              },
            };
          }
          return changed ? { entitiesByCatalog: next } : s;
        }),
```

- [ ] **Step 4: Run both the new and the Step-1 store tests**

Run: `npx vitest run src/__tests__/stores/catalogStore-lifecycle.test.ts src/__tests__/stores/catalogStore.test.ts`
Expected: PASS — new (7 cases) + Step-1 (unchanged) both green.

- [ ] **Step 5: Commit**

```bash
git add src/stores/catalogStore.ts src/__tests__/stores/catalogStore-lifecycle.test.ts
git commit -m "feat(catalog): additive applyLifecycle + loadLifecycle store actions (folder-09 R1)"
```

---

## Task A6: `/api/catalog` route + Phase-A validation

**Files:**
- Create: `src/app/api/catalog/route.ts`

`GET` returns the persisted `LifecycleRecord[]` for a catalog (the client merges via `loadLifecycle`). `POST { action: 'transition', ... }` is the generation `@@CALLBACK` target: it reads the entity's **current persisted lifecycle** (default `planned`), applies the gate server-side, and persists. No dedicated integration test this phase (it would write to live `~/.pof/pof.db`); its logic is the unit-tested gate + validation + db it composes, and Phase B's callback test exercises it end-to-end. Keep ≤200 LOC.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/catalog/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listLifecycle, getLifecycle, upsertLifecycle } from '@/lib/catalog-db';
import { generationCallbackSchema, lifecycleStateSchema } from '@/lib/catalog/validation';
import { resolveTransition } from '@/lib/catalog/lifecycle';
import type { LifecycleRecord } from '@/lib/catalog/types';

/** GET /api/catalog?catalogId=spellbook → LifecycleRecord[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listLifecycle(catalogId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog GET failed', 500);
  }
}

/**
 * POST /api/catalog
 *   { action: 'transition', catalogId, entityId, nextLifecycle, ueAssets?, testResult? }
 *   ↑ the generation @@CALLBACK target — applies the lifecycle gate server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action !== 'transition') return apiError(`Unknown action: ${body.action}`, 400);

    const next = lifecycleStateSchema.safeParse(body.nextLifecycle);
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!next.success || !catalogId || !entityId) {
      return apiError('catalogId, entityId, and a valid nextLifecycle are required', 400);
    }
    const payload = generationCallbackSchema.safeParse({
      ueAssets: body.ueAssets, testResult: body.testResult, error: body.error,
    });
    if (!payload.success) return apiError('Invalid callback payload', 400, payload.error.issues);

    const existing = getLifecycle(catalogId, entityId);
    const currentState = existing?.lifecycle ?? 'planned';
    const resolved = resolveTransition(currentState, next.data, payload.data.testResult);
    if (!resolved) {
      return apiError(
        `Illegal lifecycle transition ${currentState} → ${next.data}` +
          (next.data === 'verified' ? ' (verified requires a passing test)' : ''),
        409,
      );
    }

    const merged = Array.from(new Set([...(existing?.ueAssets ?? []), ...payload.data.ueAssets]));
    const record: LifecycleRecord = {
      catalogId, entityId, lifecycle: resolved, ueAssets: merged,
      ...(payload.data.testResult ? { lastTestResult: payload.data.testResult } : {}),
      ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
    };
    return apiSuccess(upsertLifecycle(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog POST failed', 500);
  }
}
```

- [ ] **Step 2: Typecheck + lint the new/changed catalog files**

Run: `npx tsc --noEmit`
Then: `npx eslint src/app/api/catalog/route.ts src/lib/catalog src/lib/catalog-db.ts src/stores/catalogStore.ts`
Expected: no errors. (zod v4: `payload.error.issues` is correct.)

- [ ] **Step 3: Run all Phase-A + Step-1 catalog tests**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/lib/catalog-db.test.ts src/__tests__/lib/catalog-seed.test.ts src/__tests__/stores/catalogStore.test.ts src/__tests__/stores/catalogStore-lifecycle.test.ts`
Expected: PASS — lifecycle (9) + validation (6) + catalog-db (2) + catalog-seed (Step-1) + catalogStore (Step-1) + catalogStore-lifecycle (7).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalog/route.ts
git commit -m "feat(catalog): /api/catalog lifecycle GET + gated transition POST (folder-09 R1)"
```

- [ ] **Step 5: Full validate**

Run: `npm run validate`
Expected: green. If a failure references a file you did NOT touch (foreign session), note it and confirm your catalog tests pass via Step 3's targeted command — do not "fix" foreign files.

---

## Phase A done

The generation layer's foundation exists and is tested: a shared lifecycle gate, zod-validated callback handling, durable server-side lifecycle persistence behind `/api/catalog`, and additive store actions that update/merge lifecycle over Step-1's seeded entities — with Step-1's seed/UI/tests untouched. Next: **Phase B** (recipe/batch engine + `TaskFactory.generate` + `.withAssetSpec` + the Spellbook "(Re)generate" affordance), then **Phase C** (live-UE `GA_Fireball` generate+verify). Each gets its own detailed plan referencing the exact shapes built here.

---

## Self-review notes (for the executor)

- **Spec coverage (revised §0):** additive type fields ✔ (A1), shared lifecycle gate ✔ (A2, store + route), zod callback validation ✔ (A3), server-side lifecycle persistence ✔ (A4) + `/api/catalog` ✔ (A6), additive store actions (no Step-1 breakage) ✔ (A5). Engine + live-UE are Phases B/C.
- **Reuse, not replace:** A1/A5 modify Step-1 files **additively only**; A5's tests live in a separate file so the Step-1 store test is untouched; the existing seed/selectors/`merge`/Spellbook UI are unchanged.
- **Type consistency:** `LifecycleState`, `TestResult`, `LifecycleRecord`, `resolveTransition`, `generationCallbackSchema`, `lifecycleStateSchema`, `rowToLifecycle`/`listLifecycle`/`getLifecycle`/`upsertLifecycle`, `applyLifecycle`/`loadLifecycle` are used with identical signatures across tasks and tests.
- **No placeholders:** every code step is complete; the one runtime check (`SEED_ID` matches the Step-1 store test) is a concrete verification, not a placeholder.
