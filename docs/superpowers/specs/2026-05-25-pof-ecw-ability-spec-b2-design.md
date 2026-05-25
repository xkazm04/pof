# Wire the Rich GAS Editors into Spellbook Logic (Option B2) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Second sub-project of **Option B** (data-model enrichment). B = B1 (app data layer, DONE) → **B2 (this: wire the rich editors)** → B3 (C++ codegen round-trip). Each ships independently.

## Goal

Make the spellbook `logic` track edit a real, persisted `EnrichedAbilitySpec` (from B1) through the existing rich legacy editors — `EffectTimelineEditor` (GameplayEffects timeline) and `TagRulesEditor` (activation tag rules) — instead of the current static display lines. Add an AI "Draft" assist that proposes a starter spec. No C++ (B3).

## Findings driving this design

- **B1 shipped the whole data layer:** `EnrichedAbilitySpec` + `deriveDefaultSpec` (`src/lib/ability/spec.ts`), `ability-spec-db.ts` (`ability_specs` PK table, `getSpec`/`upsertSpec`), `/api/ability-spec` GET/POST, and `abilitySpecStore` (`loadSpec`/`setSpec`/`getSpec` + `useEntityAbilitySpec`). B2 only consumes them.
- **The editors are clean controlled components** in the legacy `src/components/modules/core-engine/sub_ability/blueprint/` tree (reusing legacy components is the stated intent of this whole UI pass):
  - `EffectTimelineEditor({ effects: EditorEffect[]; onChange: (e) => void; onSelectItem? })`
  - `TagRulesEditor({ rules: TagRule[]; onChange: (r) => void; effects: EditorEffect[]; loadout: GASLoadoutSlot[] })` — `effects`+`loadout` only feed the known-tag validation; pass `spec.effects` and `[]`.
- **The callback system is the `useGeneration` pattern:** a typed `CLITask` with a registered `@@CALLBACK` that POSTs proposed JSON to an API; the caller's `useModuleCLI({ onComplete })` refetches + reloads the store. `evaluate-track` / `generate` are the closest templates (minimal prompt + callback, no UE-wiring header).
- **`SpellbookLogicWorkspace`** already renders six aspect cards via `useModuleCLI` + `TaskFactory.quickAction` per aspect. B2 changes only the **Effect Mapping** and **Requirements** cards; the other four (Type/Damage/Cooldown/Cost) keep their CLI-to-change buttons untouched.

## Architecture

### Spec load on entity open

In `SpellbookLogicWorkspace`, an effect keyed on `entity.id` resolves the spec into the store:

```
GET /api/ability-spec?catalogId=<id>&entityId=<id>
  → row present : loadSpec(catalogId, entityId, row)
  → null        : loadSpec(catalogId, entityId, deriveDefaultSpec(catalogId, ability))
```

The component reads the slot via `useEntityAbilitySpec(catalogId, entityId)`. On `null`, the derived default is placed in the store so the editors are never empty; it is **not** written to the DB until the first edit. GET failure → fall back to the derived default locally (editor still works, just unpersisted), matching `useGeneration`'s swallow-and-continue.

### Editing → persistence

Each editor's `onChange` builds the next spec and persists optimistically + debounced:

```
onEffectsChange(next): setSpec(catalogId, entityId, { ...spec, effects: next });  schedulePost()
onRulesChange(next):   setSpec(catalogId, entityId, { ...spec, tagRules: next }); schedulePost()
```

`schedulePost` debounces (`UI_TIMEOUTS` delay) a `POST /api/ability-spec` with the current store spec. No explicit Save button. POST failure → `logger.error`; the optimistic store value stays (next edit retries).

### The two cards

- **Effect Mapping** — replaces the static "element-implied effect" line with `<EffectTimelineEditor effects={spec.effects} onChange={onEffectsChange} />`. Its button becomes **"Draft with AI"** → dispatches one whole-spec draft (effects **and** tagRules together — they are coupled, since rules reference effect-granted tags, and `/api/ability-spec` upserts both arrays).
- **Requirements** — replaces the static "Blocked while Dead/Stunned" line with `<TagRulesEditor rules={spec.tagRules} onChange={onRulesChange} effects={spec.effects} loadout={[]} />`. No separate AI button (the single Draft fills its rules; the operator edits inline).

### Draft with AI (persist-immediately)

A new callback-bearing task mirrors `evaluate-track`:

- **`DraftAbilitySpecTask`** (`type: 'draft-ability-spec'`) carrying `{ catalogId, entityId, ref: AbilityRef, instruction?, appOrigin }`.
- **`TaskFactory.draftAbilitySpec(moduleId, params, appOrigin, label)`**.
- **`buildTaskPrompt` case** `'draft-ability-spec'`: a minimal prompt body from a new `buildAbilitySpecDraftPrompt(ref, instruction)` in the existing `src/lib/ability/logic-prompts.ts` (no project-context/UE-wiring header — this is app-side data authoring), plus `@@CALLBACK` registered to `${appOrigin}/api/ability-spec`, `method: 'POST'`, `staticFields: { catalogId, entityId }`, and a `schemaHint` describing the `EditorEffect[]` / `TagRule[]` JSON. The free-text `instruction` textarea already in the workspace is folded into the prompt.
- The workspace's `useModuleCLI({ onComplete })` refetches `GET /api/ability-spec` → `loadSpec`, so the drafted spec replaces the editors' content (then fully editable — every later edit auto-persists). "Review" = seeing it in the editor and adjusting.

## Components / responsibilities

| Unit | Responsibility |
|------|----------------|
| `logic-prompts.ts` (extend) | `buildAbilitySpecDraftPrompt(ref, instruction)` — pure prompt body for the draft task |
| `cli-task.ts` (extend) | `DraftAbilitySpecTask` type, `'draft-ability-spec'` `buildTaskPrompt` case + callback, `TaskFactory.draftAbilitySpec` |
| `SpellbookLogicWorkspace.tsx` (modify) | load-on-open, two editors bound to the spec, debounced persist, Draft dispatch + `onComplete` refetch |

The data layer (spec.ts / ability-spec-db.ts / route.ts / abilitySpecStore.ts) is reused as-is from B1.

## Error handling

Standard `{ success, data/error }` envelope throughout. GET/POST failures are swallowed-with-log (the local store value remains usable), matching the established `useGeneration` convention. The callback path already validates JSON and merges `staticFields` server-side; `/api/ability-spec` rejects payloads missing `effects`/`tagRules` arrays (400).

## Testing

- **`cli-task` draft test** (new, mirrors `cli-task-*.test.ts`): `TaskFactory.draftAbilitySpec` yields a `draft-ability-spec` task; `buildTaskPrompt` output contains the ability name and a `@@CALLBACK` to `/api/ability-spec` whose schema mentions `effects`/`tagRules`, with `{ catalogId, entityId }` static fields.
- **Workspace tests** (extend `SpellbookLogicWorkspace.test.tsx`): editors render populated from a loaded spec; editing an effect/rule fires `setSpec` and a `POST /api/ability-spec`; clicking **Draft with AI** dispatches a `draft-ability-spec` task; opening an entity whose spec is `null` shows `deriveDefaultSpec` content.

## Scope / out of scope

- **In:** the two-card editor wiring for spellbook `logic`, the debounced write-back, and the AI Draft task.
- **Out:** B3 (C++ `UARPGGameplayAbility`/`GameplayEffect` codegen, DataTable, seeder); attributes/relationships/loadout/WiringGraph; the other catalogs (the rich-Logic pattern rolls out after B).

## Known limitation (deferred)

`deriveDefaultSpec` seeds the primary effect from the catalog's `damage`/`cooldown` at seed time; later scalar edits via the Damage/Cooldown/Cost cards don't auto-resync the spec's effect modifiers. Acceptable for B2 — reconciliation belongs to B3 codegen, which makes the spec authoritative.

## Invariants

Branch-local commits; `@/` imports; no hardcoded hex (editors already use `chart-colors` tokens); `logger` not `console`; timing via `UI_TIMEOUTS`; co-author tag; each task ends targeted vitest green + `tsc`/eslint clean (excluding the 3 pre-existing foreign `AssetInspector` errors).
