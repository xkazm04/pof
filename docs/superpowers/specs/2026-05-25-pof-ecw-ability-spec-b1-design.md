# Enriched Ability Spec + Write-back (Option B1) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

First sub-project of **Option B** (data-model enrichment). B = B1 (this: app data layer) → B2 (wire the rich editors) → B3 (C++ codegen round-trip). Each ships independently.

## Goal

Give a spellbook ability a persisted, editable **enriched spec** (GameplayEffects + tag rules) that the rich legacy editors will bind to in B2 and the codegen will consume in B3. B1 is the **data layer only** — types, persistence, API, store, and sensible defaults; no UI, no C++.

## Findings driving this design

- The spellbook catalog is **app-only** (62 hand-authored `SPELLBOOK_ABILITIES`, no C++ sync); its entity `data` is thin (scalars/enums, no effects/tag-rules) and seeded read-only (only lifecycle persists today).
- The editors' types are **already exported from `src/lib/gas-codegen.ts`** — `EditorEffect` and `TagRule` — the same file B3's C++ codegen builds on. So the spec reuses them directly (no re-homing).
- The write-back follows the established `baseline-db` / `baselineStore` template.

## Types — `src/lib/ability/spec.ts`

```ts
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
export type { EditorEffect, TagRule };

export interface EnrichedAbilitySpec {
  catalogId: string;
  entityId: string;
  effects: EditorEffect[];   // → EffectTimelineEditor (B2)
  tagRules: TagRule[];       // → TagRulesEditor (B2)
  updatedAt?: string;
}

/** Seed a starter spec from the thin ability so the B2 editors are never empty. Pure. */
export function deriveDefaultSpec(catalogId: string, ability: {
  id: string; element?: string; color?: string; damage?: number; cooldown?: number; tag?: string;
}): EnrichedAbilitySpec;
```

`deriveDefaultSpec` produces:
- **one effect**: `{ id: '<abilityId>-primary', name: '<Element> Strike' (or 'Effect' if no element), duration: 'instant', durationSec: 0, cooldownSec: <cooldown||0>, color: <color||a neutral token>, modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -(<damage>||0) }], grantedTags: [] }`.
- **two activation tag rules** (standard "can't act while incapacitated"): `{ id: '<abilityId>-block-dead', sourceTag: <tag||'Ability'>, targetTag: 'State.Dead', type: 'blocks' }` and the same for `'State.Stunned'`.

Pure + deterministic so it's unit-tested.

## Persistence — `src/lib/ability/ability-spec-db.ts`

Mirrors `baseline-db.ts`:
- Table `ability_specs (catalog_id TEXT, entity_id TEXT, effects TEXT DEFAULT '[]', tag_rules TEXT DEFAULT '[]', updated_at TEXT, PRIMARY KEY (catalog_id, entity_id))`.
- `rowToSpec(row): EnrichedAbilitySpec` — pure, JSON-parses `effects`/`tag_rules`.
- `getSpec(catalogId, entityId): EnrichedAbilitySpec | null`.
- `upsertSpec(rec): EnrichedAbilitySpec` — INSERT … ON CONFLICT(catalog_id, entity_id) DO UPDATE, returns the re-read row.

## API — `src/app/api/ability-spec/route.ts`

- `GET ?catalogId=&entityId=` → `EnrichedAbilitySpec | null` (apiSuccess).
- `POST { catalogId, entityId, effects, tagRules }` → validates `effects`/`tagRules` are arrays, upserts, returns the stored spec. (apiError on missing/invalid.)

## Store — `src/stores/abilitySpecStore.ts`

Mirrors `baselineStore`: `specByEntity['catalogId/entityId'] = EnrichedAbilitySpec | null` (undefined = unloaded, null = loaded-none), `loadSpec`, `setSpec`, `getSpec`, + a `useEntityAbilitySpec(catalogId, entityId)` selector. No persist middleware (DB is source of truth).

## Data flow / error handling

B1 just persists + serves. B2 will: on entity open, `GET` the spec (or, if null, fall back to `deriveDefaultSpec` for initial editor content); the editors' `onChange` → `setSpec` (optimistic) + `POST`. No C++ touch (B3). Standard envelope errors.

## Testing

- `deriveDefaultSpec` unit tests: one effect with `magnitude = -damage` + cooldown carried; two `blocks` tag rules vs Dead/Stunned; element→name; safe when fields missing.
- `rowToSpec` unit tests: parses effects/tagRules JSON, maps ids, omits null `updated_at`.
- API/store follow the baseline pattern (store unit test: load/get/set; `null` vs undefined).

## Scope / out of scope

- **In:** types + `deriveDefaultSpec` + db + api + store. Spellbook is the pilot but the spec is `catalogId`-keyed (reusable).
- **Out:** any UI (B2), the rich editors, the C++ codegen + DataTable + seeder (B3), and attributes/relationships/WiringGraph (deferred per the spec-shape decision).

## Invariants

Branch-local commits; `@/` imports; no hardcoded hex (use chart-colors tokens for the default effect color); co-author tag; each task ends targeted vitest green + tsc/eslint clean (excl. 3 pre-existing AssetInspector).
