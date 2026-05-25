# Generate GameplayEffect C++ from the Ability Spec (Option B3a) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

First slice of **Option B3** (the C++ round-trip), itself the third sub-project of **Option B** (data-model enrichment). B = B1 (app data layer, DONE) → B2 (rich editors, DONE) → **B3** (C++ round-trip). B3 is decomposed: **B3a (this: generate GameplayEffect C++ from `spec.effects[]`)** → B3b (tagRules → ability activation tags) → B3c (DataTable/seeder enrichment). Each ships independently.

## Goal

From an enriched ability spec's `effects[]`, generate idiomatic, **buildable** `UGameplayEffect` C++ subclasses in the UE project — landed **additively** in a marked `Generated/` folder so they never collide with hand-written code. App-side: a CLI dispatch + prompt + button. The generation itself is **Claude-authored** at dispatch time (so it matches the project's bespoke GE conventions); the app's job is to hand Claude the spec + a precise contract and let the UE build be the gate.

## Findings driving this design (from UE recon)

- **The UE side is bespoke C++, not data-driven.** Abilities are 14 hand-written `GA_*` subclasses; GameplayEffects are ~19 hand-written `UGE_*` classes configured in constructors (plus a custom `UARPGDamageExecution`). Only `DT_AbilityCatalog` is data-driven, and its row (`FARPGAbilityCatalogRow`: Name, Category, Tier, BaseDamage, Description, GameplayTag) is **UI metadata only** — no effects/tagRules.
- **Set mismatch.** The B1/B2 `EnrichedAbilitySpec` is keyed on the `spellbook` catalog (62 app-only abilities); the UE `GA_*` + `DT_AbilityCatalog` correspond to `CHARACTER_ABILITIES` (14, a different set). So most spellbook specs have **no UE counterpart** — generated GEs are *new* content, not edits to existing classes.
- **`spec.effects[]` maps cleanly to the `GE_*` pattern.** An `EditorEffect` (duration + modifiers + granted tags) is exactly what a simple `UGameplayEffect` subclass expresses (cf. the additive `GE_Heal`). This is the one clean codegen target — `tagRules` (activation gating) and the DataTable belong to bespoke ability classes / runtime consumers and are deferred.
- **Established dispatch family.** `procgen-dungeon` / `biome-scatter` / `character-setup` / `audio-import` are CLI tasks that run/write in the UE tree and judge success by the `-abslog`. `character-setup` is **callback-free** (verification is separate). B3a follows that precedent.
- **Real UE references** the contract points Claude at: `Source/PoF/AbilitySystem/Effects/GE_*.{h,cpp}` (idiom), `Source/PoF/AbilitySystem/ARPGAttributeSet.h` (attribute list: Health/MaxHealth/Mana/MaxMana/Strength/Dexterity/Intelligence/Armor/AttackPower/Critical*/…Resistance/CurrentXP/…), `Source/PoF/AbilitySystem/ARPGGameplayTags.h` (native tag declarations).

## Architecture

A new callback-free CLI task `generate-gas-effects` in the UE-dispatch family. The app holds the authoritative `EnrichedAbilitySpec`; the task embeds that spec + an authoring contract + the target location, Claude writes the classes and builds the `PoF` module, and reports in the rail. No app-side persistence — the artifacts live in the UE git tree (like `procgen`/`scatter` outputs).

```
SpellbookLogicWorkspace ("Generate C++" on Effect Mapping card)
  → cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, appOrigin, label))
  → buildTaskPrompt → project-context header + buildGenerateEffectsPrompt(...)   [no @@CALLBACK]
  → Claude: read existing GE_* + AttributeSet + tags → write UGE_Gen_* into Effects/Generated/
           → build PoF → judge by Saved/Logs/PoF*.log → report files / attrs / missing tags
```

## Components (app side, TDD'd)

| Unit | Responsibility |
|------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | `buildGenerateEffectsPrompt(ref, effects, tagRules)` — pure authoring-contract body |
| `src/lib/cli-task.ts` (extend) | `GenerateGasEffectsTask` type, `'generate-gas-effects'` `buildTaskPrompt` case (header + body, **no callback**), `TaskFactory.generateGasEffects` |
| `SpellbookLogicWorkspace.tsx` (modify) | a **"Generate C++"** button on the Effect Mapping card dispatching the task |

`ref: AbilityRef` (reused from `logic-prompts.ts`), `effects: EditorEffect[]`, `tagRules: TagRule[]` (from `@/lib/ability/spec`). The `tagRules` are passed only so the contract can list which tags the generated effects' `grantedTags` plus the rules reference, for the tag-delta report.

## The authoring contract (what the prompt instructs)

1. **Read first** — `Source/PoF/AbilitySystem/Effects/GE_Heal.{h,cpp}` (+ one more `GE_*`) for the constructor idiom, `ARPGAttributeSet.h` for the real attributes, `ARPGGameplayTags.h` for declared tags. Do NOT invent a new system.
2. **Emit one `UGameplayEffect` subclass per effect** into `Source/PoF/AbilitySystem/Effects/Generated/`, named `UGE_Gen_<AbilityName>_<EffectName> (AbilityName = sanitized ref.name)` (sanitized C++ identifier). This folder is additive — never edit or overwrite hand-written `GE_*`.
3. **Map per effect:** `duration` → `DurationPolicy` (`Instant`/`HasDuration`/`Infinite`); `durationSec` → `DurationMagnitude` (`FScalableFloat`, only when `HasDuration`); if `cooldownSec > 0` on a duration/infinite effect, set `Period` to it (periodic re-application) and note that *ability* cooldown is a separate cooldown-GE concern; each modifier → an `FGameplayModifierInfo` targeting the real `UARPGAttributeSet::Get<Attr>Attribute()` with `EGameplayModOp::Additive` (operation `add`) or `Multiplicitive` (`multiply`) and `FScalableFloat(magnitude)`. If a modifier's `attribute` is not a real attribute, emit it with a `// TODO: unknown attribute` comment rather than guessing.
4. **Granted tags** → the GE's owned-tags container, referenced via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` so the class compiles even if the tag is not yet registered natively.
5. **Tag delta** — list every `grantedTags` / `tagRules` tag NOT already declared in `ARPGGameplayTags.h` into a `Source/PoF/AbilitySystem/Effects/Generated/README.md` manifest (with the file list + attribute mapping). Do **not** auto-edit the hand-written tags file.
6. **Build** the `PoF` module (regenerate project files if a new `.cpp` requires it). Judge success by the newest `Saved/Logs/PoF*.log`, not the exit code (headless build/editor exits non-zero on the benign shutdown crash). Report: files written, attributes mapped, tags missing.

## Data flow / error handling

The dispatch is fire-and-forget into the CLI rail (no callback, mirroring `character-setup`). Verification is the operator reading the rail + the `Generated/README.md` manifest + the build log. App-side errors are confined to prompt assembly (pure). The generated content is reviewable in git before anything depends on it.

## Verification

- **Hard gate: build success** — the generated `UGE_Gen_*` classes compile into the `PoF` module.
- **Deferred (B3a follow-on / stretch):** a minimal `AFunctionalTest` (via `ARPGFunctionalTestBase`) that loads one generated GE by path, applies it to the player ASC, and asserts the targeted attribute changed. Achievable but adds real scope; not required for B3a.

## Testing (app side)

- **`effect-codegen-prompt` unit test:** the prompt names the ability, enumerates each effect with its duration + modifiers + granted tags, names the `Generated/` folder and `UGE_Gen_` naming scheme, instructs reading existing `GE_*`/`ARPGAttributeSet`/`ARPGGameplayTags`, and includes the build-and-report step.
- **`cli-task` test:** `TaskFactory.generateGasEffects` builds a typed `generate-gas-effects` task; `buildTaskPrompt` output contains the ability name and per-effect detail and does **not** contain a `@@CALLBACK` marker (callback-free).
- **Workspace test (extend):** clicking **"Generate C++"** dispatches a `generate-gas-effects` task.

## Scope / out of scope

- **In:** the `generate-gas-effects` dispatch + prompt + Effect-Mapping button, for spellbook (the spec is `catalogId`-keyed → generalizes). Build-gated, callback-free.
- **Out:** `tagRules` → ability `ActivationBlockedTags`/`ActivationRequiredTags` (touches bespoke ability classes — B3b); DataTable/`FARPGAbilityCatalogRow`/seeder enrichment (B3c); auto-editing native `ARPGGameplayTags`; attaching generated GEs to existing `GA_*`; the functional test (stretch).

## Invariants

Branch-local commits; `@/` imports; `logger` not `console`; co-author tag. UE-side: write only under `Source/PoF/AbilitySystem/Effects/Generated/` (+ the README manifest); judge build by `-abslog`; commit UE changes narrowly (shared tree, `-abslog` discipline). Each app-side task ends targeted vitest green + `tsc`/eslint clean (excluding the 3 pre-existing foreign `AssetInspector` errors).
