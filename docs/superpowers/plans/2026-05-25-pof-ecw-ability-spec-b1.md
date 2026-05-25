# Enriched Ability Spec + Write-back (Option B1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Persist an editable enriched ability spec (effects + tag rules) per catalog entity, with sensible defaults — the data layer B2 (rich editors) and B3 (C++ codegen) build on.

**Architecture:** Mirrors the proven `baseline-db`/`baselineStore` write-back template. `spec.ts` (types from `@/lib/gas-codegen` + pure `deriveDefaultSpec`) → `ability-spec-db.ts` (table + pure `rowToSpec` + get/upsert) → `/api/ability-spec` (GET/POST) → `abilitySpecStore.ts` (DB-backed, no-persist).

**Tech Stack:** Next.js 16, better-sqlite3, Zustand v5, Vitest. **Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-ability-spec-b1-design.md`.

**Invariants:** branch-local commits; `@/` imports; no hardcoded hex (use chart-colors); co-author tag; each task ends targeted vitest green + tsc/eslint clean (excl. 3 pre-existing AssetInspector).

---

## Task 1: `spec.ts` — types + `deriveDefaultSpec`

**Files:** Create `src/lib/ability/spec.ts`; Test `src/__tests__/lib/ability/spec.test.ts`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest';
import { deriveDefaultSpec } from '@/lib/ability/spec';

describe('deriveDefaultSpec', () => {
  const fireball = { id: 'off-fire-01', element: 'Fire', color: '#f87171', damage: 35, cooldown: 3, tag: 'Ability.Fire.Fireball' };

  it('seeds one element-named effect with -damage Health modifier + cooldown', () => {
    const s = deriveDefaultSpec('spellbook', fireball);
    expect(s.catalogId).toBe('spellbook');
    expect(s.entityId).toBe('off-fire-01');
    expect(s.effects).toHaveLength(1);
    const e = s.effects[0];
    expect(e.id).toBe('off-fire-01-primary');
    expect(e.name).toBe('Fire Strike');
    expect(e.duration).toBe('instant');
    expect(e.cooldownSec).toBe(3);
    expect(e.color).toBe('#f87171');
    expect(e.modifiers).toEqual([{ attribute: 'Health', operation: 'add', magnitude: -35 }]);
  });

  it('seeds two block rules vs Dead/Stunned using the ability tag as source', () => {
    const s = deriveDefaultSpec('spellbook', fireball);
    expect(s.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned']);
    expect(s.tagRules.every((r) => r.type === 'blocks' && r.sourceTag === 'Ability.Fire.Fireball')).toBe(true);
  });

  it('is safe when fields are missing', () => {
    const s = deriveDefaultSpec('spellbook', { id: 'x' });
    expect(s.effects[0].name).toBe('Effect');
    expect(s.effects[0].modifiers[0].magnitude).toBe(0);
    expect(s.tagRules[0].sourceTag).toBe('Ability');
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/__tests__/lib/ability/spec.test.ts` → FAIL.
- [ ] **Step 3: Implement**
```ts
// src/lib/ability/spec.ts
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';

export type { EditorEffect, TagRule };

export interface EnrichedAbilitySpec {
  catalogId: string;
  entityId: string;
  effects: EditorEffect[];
  tagRules: TagRule[];
  updatedAt?: string;
}

export interface AbilityLike {
  id: string;
  element?: string;
  color?: string;
  damage?: number;
  cooldown?: number;
  tag?: string;
}

/** Seed a starter spec from the thin ability so the B2 editors are never empty. Pure. */
export function deriveDefaultSpec(catalogId: string, ability: AbilityLike): EnrichedAbilitySpec {
  const tag = ability.tag ?? 'Ability';
  const effects: EditorEffect[] = [{
    id: `${ability.id}-primary`,
    name: ability.element ? `${ability.element} Strike` : 'Effect',
    duration: 'instant',
    durationSec: 0,
    cooldownSec: ability.cooldown ?? 0,
    color: ability.color ?? STATUS_NEUTRAL,
    modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -(ability.damage ?? 0) }],
    grantedTags: [],
  }];
  const tagRules: TagRule[] = [
    { id: `${ability.id}-block-dead`, sourceTag: tag, targetTag: 'State.Dead', type: 'blocks' },
    { id: `${ability.id}-block-stunned`, sourceTag: tag, targetTag: 'State.Stunned', type: 'blocks' },
  ];
  return { catalogId, entityId: ability.id, effects, tagRules };
}
```
- [ ] **Step 4:** Run → PASS (3). **Step 5:** Commit `feat(ability): EnrichedAbilitySpec types + deriveDefaultSpec (B1.1)`.

---

## Task 2: `ability-spec-db.ts` + `/api/ability-spec`

**Files:** Create `src/lib/ability/ability-spec-db.ts`, `src/app/api/ability-spec/route.ts`; Test `src/__tests__/lib/ability/ability-spec-db.test.ts`.

- [ ] **Step 1: Failing test (rowToSpec, pure)**
```ts
import { describe, it, expect } from 'vitest';
import { rowToSpec } from '@/lib/ability/ability-spec-db';

describe('rowToSpec', () => {
  it('maps a row + parses effects/tagRules JSON', () => {
    const s = rowToSpec({
      catalog_id: 'spellbook', entity_id: 'off-fire-01',
      effects: '[{"id":"e1","name":"Fire","duration":"instant","durationSec":0,"cooldownSec":3,"color":"#f00","modifiers":[],"grantedTags":[]}]',
      tag_rules: '[{"id":"r1","sourceTag":"A","targetTag":"State.Dead","type":"blocks"}]',
      updated_at: '2026-05-25T00:00:00.000Z',
    });
    expect(s.catalogId).toBe('spellbook');
    expect(s.effects).toHaveLength(1);
    expect(s.effects[0].cooldownSec).toBe(3);
    expect(s.tagRules[0].targetTag).toBe('State.Dead');
    expect(s.updatedAt).toBe('2026-05-25T00:00:00.000Z');
  });
  it('defaults empty arrays + omits null updated_at', () => {
    const s = rowToSpec({ catalog_id: 'spellbook', entity_id: 'x', effects: '[]', tag_rules: '[]', updated_at: null });
    expect(s.effects).toEqual([]);
    expect(s.tagRules).toEqual([]);
    expect(s.updatedAt).toBeUndefined();
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement db**
```ts
// src/lib/ability/ability-spec-db.ts
import { getDb } from '@/lib/db';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ability_specs (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      effects TEXT NOT NULL DEFAULT '[]',
      tag_rules TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);
}

/** Column row → EnrichedAbilitySpec. Pure (exported for unit test). */
export function rowToSpec(row: Record<string, unknown>): EnrichedAbilitySpec {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    effects: JSON.parse((row.effects as string) || '[]') as EditorEffect[],
    tagRules: JSON.parse((row.tag_rules as string) || '[]') as TagRule[],
    updatedAt: (row.updated_at as string | null) ?? undefined,
  };
}

export function getSpec(catalogId: string, entityId: string): EnrichedAbilitySpec | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM ability_specs WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToSpec(row) : null;
}

export function upsertSpec(rec: EnrichedAbilitySpec): EnrichedAbilitySpec {
  ensureTable();
  getDb().prepare(`
    INSERT INTO ability_specs (catalog_id, entity_id, effects, tag_rules, updated_at)
    VALUES (@catalog_id, @entity_id, @effects, @tag_rules, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      effects=@effects, tag_rules=@tag_rules, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    effects: JSON.stringify(rec.effects),
    tag_rules: JSON.stringify(rec.tagRules),
  });
  return getSpec(rec.catalogId, rec.entityId)!;
}
```
- [ ] **Step 4: Implement api**
```ts
// src/app/api/ability-spec/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getSpec, upsertSpec } from '@/lib/ability/ability-spec-db';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    return apiSuccess(getSpec(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    if (!Array.isArray(body.effects) || !Array.isArray(body.tagRules)) return apiError('effects and tagRules (arrays) are required', 400);
    const record: EnrichedAbilitySpec = {
      catalogId, entityId,
      effects: body.effects as EditorEffect[],
      tagRules: body.tagRules as TagRule[],
    };
    return apiSuccess(upsertSpec(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec POST failed', 500);
  }
}
```
- [ ] **Step 5:** Run `npx vitest run src/__tests__/lib/ability/ability-spec-db.test.ts` → PASS; `npx tsc --noEmit` (grep ability, excl AssetInspector) CLEAN.
- [ ] **Step 6: Commit** `feat(ability): ability-spec-db + /api/ability-spec write-back (B1.2)`.

---

## Task 3: `abilitySpecStore.ts`

**Files:** Create `src/stores/abilitySpecStore.ts`; Test `src/__tests__/stores/abilitySpecStore.test.ts`.

- [ ] **Step 1: Failing test** (mirrors baselineStore test)
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAbilitySpecStore, abilitySpecKey } from '@/stores/abilitySpecStore';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';

const rec: EnrichedAbilitySpec = { catalogId: 'spellbook', entityId: 'off-fire-01', effects: [], tagRules: [] };

describe('abilitySpecStore', () => {
  beforeEach(() => useAbilitySpecStore.setState({ specByEntity: {} }));

  it('abilitySpecKey composes catalog + entity', () => {
    expect(abilitySpecKey('spellbook', 'off-fire-01')).toBe('spellbook/off-fire-01');
  });
  it('loadSpec stores + getSpec reads', () => {
    useAbilitySpecStore.getState().loadSpec('spellbook', 'off-fire-01', rec);
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'off-fire-01')).toEqual(rec);
  });
  it('loadSpec(null) records loaded-none; getSpec undefined when unloaded', () => {
    useAbilitySpecStore.getState().loadSpec('spellbook', 'ghost', null);
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'ghost')).toBeNull();
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'never')).toBeUndefined();
  });
  it('setSpec overwrites', () => {
    useAbilitySpecStore.getState().setSpec('spellbook', 'off-fire-01', { ...rec, effects: [{ id: 'e', name: 'n', duration: 'instant', durationSec: 0, cooldownSec: 0, color: '#000', modifiers: [], grantedTags: [] }] });
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'off-fire-01')!.effects).toHaveLength(1);
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** (mirror `baselineStore.ts`)
```ts
// src/stores/abilitySpecStore.ts
'use client';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';

type Slot = EnrichedAbilitySpec | null; // null = loaded-none; undefined = unloaded

interface AbilitySpecState {
  specByEntity: Record<string, Slot>;
  loadSpec: (catalogId: string, entityId: string, spec: Slot) => void;
  setSpec: (catalogId: string, entityId: string, spec: EnrichedAbilitySpec) => void;
  getSpec: (catalogId: string, entityId: string) => Slot | undefined;
}

export function abilitySpecKey(catalogId: string, entityId: string): string {
  return `${catalogId}/${entityId}`;
}

export const useAbilitySpecStore = create<AbilitySpecState>()((set, get) => ({
  specByEntity: {},
  loadSpec: (catalogId, entityId, spec) =>
    set((s) => ({ specByEntity: { ...s.specByEntity, [abilitySpecKey(catalogId, entityId)]: spec } })),
  setSpec: (catalogId, entityId, spec) =>
    set((s) => ({ specByEntity: { ...s.specByEntity, [abilitySpecKey(catalogId, entityId)]: spec } })),
  getSpec: (catalogId, entityId) => get().specByEntity[abilitySpecKey(catalogId, entityId)],
}));

/** Reactive selector for one entity's spec slot (undefined = unloaded). */
export function useEntityAbilitySpec(catalogId: string, entityId: string): Slot | undefined {
  return useAbilitySpecStore(useShallow((s) => s.specByEntity[abilitySpecKey(catalogId, entityId)]));
}
```
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(ability): abilitySpecStore — DB-backed enriched spec (B1.3)`.

---

## Final verification
- [ ] `npx vitest run src/__tests__/lib/ability src/__tests__/stores/abilitySpecStore.test.ts` — all green.
- [ ] `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v AssetInspector || echo CLEAN` — CLEAN.

## Out of scope (B1)
Any UI / the rich editors (B2); the C++ codegen + DataTable + seeder (B3); attributes/relationships/WiringGraph.
