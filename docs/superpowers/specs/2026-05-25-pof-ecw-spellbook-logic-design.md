# ECW Spellbook Logic Editor (pilot) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Sub-project C of the ECW Shell UX upgrade (A = visual theme, B = Overview surface — both done). This is the **pilot**: it establishes the per-catalog rich-Logic pattern on **Spellbook**; other catalogs follow in later passes.

## Goal

Replace the thin Logic tab (raw spec) — for the spellbook catalog only — with **aspect cards** that display an ability's real state (reusing legacy display primitives + extracted calc logic) and offer **per-aspect CLI-to-change**. Matches the operator's "display current state + CLI button to make changes" and the deep-dive's reuse tiers.

## Key constraints (from the deep-dive)

- Catalog ability data is **seeded read-only**; only *lifecycle* persists (`catalog-db`). There is **no entity-data write-back** → changes must flow through the source (C++ ability class / `DT_AbilityCatalog`) via CLI, not in-app mutation.
- `SpellbookAbility` is **thin**: `id, name, category, element, tier, damage, manaCost, cooldown, radar[5]=[Damage,Range,AoE,Speed,Efficiency], description, color, tag`. It carries **no** `effects[]`/`tagRules[]`, so the rich legacy editors (`EffectTimelineEditor`, `TagRulesEditor`, `WiringGraphEditor`) have no entity data to bind to — they are **deferred** to a future data-model enrichment (Option B), not built here.

## Architecture — registry override, no core change

Register a **`SpellbookLogicWorkspace`** for `('spellbook', 'logic')` in the existing `register.ts` barrel. `trackWorkspaceRegistry` already resolves exact `(catalogId,trackId)` before the wildcard `('*','logic')`, so spellbook's Logic tab renders the rich editor while every other catalog keeps the generic `LogicWorkspace`. Spellbook has no registered facets today, so nothing is lost.

`SpellbookLogicWorkspace` composes the existing `<PipelineTrackDetail entity trackId="logic" />` (track state + Evaluate-CLI, kept for consistency) followed by six aspect cards.

## The six aspect cards

Each reads `entity.data` (`SpellbookAbility`), renders current state, and has a CLI button dispatching an aspect-scoped session via `useModuleCLI({ moduleId: 'arpg-gas', sessionKey: 'gen-<id>' })`.

| Card | Displays | Reuse tier | CLI button → prompt |
|---|---|---|---|
| **Type** | `category` · `element` (colored via `color`) · `tier` + gameplay `tag` | PRIMITIVE (`TagRow`/badges) | "Reclassify…" → `buildTypePrompt` |
| **Damage** | `damage` + bar + formula preview | EXTRACT (`calculateDamage`) + `StatBar` | "Tune damage…" → `buildDamagePrompt` |
| **Cooldown** | `cooldown` (seconds) | PRIMITIVE (`CooldownWheel`) | "Change cooldown…" → `buildCooldownPrompt` |
| **Cost** | `manaCost` + radar Efficiency | PRIMITIVE (`StatBar`) | "Tune cost…" → `buildCostPrompt` |
| **Effect mapping** | element-implied GE label + `tag` | small display | "Author effects…" → `buildEffectsPrompt` |
| **Requirements** | `tag` + standard activation note (blocked while Dead/Stunned) | small display | "Author requirements…" → `buildRequirementsPrompt` |

## New code

- `src/lib/ability/damage-formula.ts` (pure, unit-tested):
  - `calculateDamage(base: number, power: number, armor: number, critChance: number, critMult: number): number` — mirrors the formula in the legacy `sub_ability/abilities/DamageCalcSection.tsx` (the plan extracts the exact memoized formula from that file).
  - `formulaPreview(ability: { damage: number }): string` — a short human-readable readout (e.g. `"40 base · ~mitigated by armor · ×crit"`).
- `src/lib/ability/logic-prompts.ts` (pure, unit-tested): one builder per aspect, each taking the ability name + relevant fields and returning a CLI prompt that instructs Claude to edit the **source** (the `UARPGGameplayAbility` subclass / `DT_AbilityCatalog` row, reusing the existing GAS conventions — never invent a new system) and report the asset path + changed fields. Mirrors the established `*-prompt.ts` pattern (remix/loot/combo).
- `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` — composes the cards; registered in `register.ts`.

## Reuse approach (per deep-dive tiers)

- **EXTRACT** the damage calc into `damage-formula.ts` (pure, testable; not tied to the legacy UI).
- **PRIMITIVE** reuse of `StatBar`, `TagRow`, `CooldownWheel` from `sub_ability/{forge,abilities}`: import directly **if** confirmed zero-coupling (no context/store imports) at build time; otherwise inline a tiny ECW-local equivalent (these are small). Decided per-component during implementation; either way no `SpellbookDataCtx` provider is mounted.
- **DEFERRED**: `EffectTimelineEditor` / `TagRulesEditor` / `WiringGraphEditor` — need `effects[]`/`tagRules[]` not stored on the entity (Option B follow-up).

## Data flow

Read-only display from `entity.data`. Each card button dispatches a CLI session (`arpg-gas`) with its aspect prompt; on completion the catalog data refresh reflects the change (reseed/refetch — same as other CLI-authoring facets). No in-app data mutation/persistence.

## Error handling / testing

- `calculateDamage` + each prompt builder: unit tests (`src/__tests__/lib/ability/`).
- `SpellbookLogicWorkspace`: renders the six aspects for a sample ability (asserts category/element/tier, damage value, cooldown, mana, effect label, requirements note); clicking each aspect's button dispatches a `quick-action` carrying that aspect's prompt (mock `useModuleCLI`).
- The generic `LogicWorkspace` and its tests are untouched; the registry test gains an assertion that `('spellbook','logic')` resolves to `SpellbookLogicWorkspace`.

## Scope / out of scope

- **In scope:** Spellbook Logic pilot only.
- **Out:** other catalogs' rich Logic editors (later passes, same pattern); the Option-B data-model enrichment (effects[]/tagRules[] + C++ handshake + write-back) enabling full in-app rich editors; in-app data mutation/persistence.

## Invariants

Branch-local commits; `@/` imports; no hardcoded hex (chart-colors/CSS vars — element colors via the ability's `color`/chart-colors); no raw console; theme typography convention (sans content, mono for ids/tags); co-author every commit; each task ends ECW vitest green + eslint/tsc clean (excl. the 3 pre-existing AssetInspector errors).
