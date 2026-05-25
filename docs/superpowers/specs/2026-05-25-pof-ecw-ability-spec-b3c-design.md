# Register Generated Abilities in a Data-Driven Catalog (Option B3c) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Third (final) slice of **Option B3** (the C++ round-trip). B3 = B3a (effects → GE C++, DONE) → B3b (the wiring ability, DONE) → **B3c (this: register generated abilities in a data-driven catalog)**. Closes the round-trip: the game can now *discover* generated content via data.

## Goal

After the "Generate C++" dispatch writes + builds the bundle, also **register** each generated ability in an additive `DT_GeneratedAbilities` DataTable — so generated content is discoverable through the same data-driven pattern the project already uses for `DT_AbilityCatalog`, with **zero blast radius** on the existing catalog. Registration folds into the one dispatch (generate → build → seed).

## Findings driving this design (UE recon)

- **Seeder idiom (`Content/Python/seed_ability_catalog.py`):** create/reuse+clear a `UDataTable` via `unreal.DataTableFactory` (`.struct = <row struct>`); per row build the Python proxy (`unreal.ARPGAbilityCatalogRow()`), `set_editor_property(...)` each field (FName→`unreal.Name`, enum→`getattr(unreal.E…, …)`, tag→`unreal.GameplayTag().tag_name`), `unreal.DataTableFunctionLibrary.add_data_table_row(dt, unreal.Name(rowName), row)`, then `save_asset`. Run headless: `UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<abs> -unattended -nopause -abslog=<log>`. Loads the row struct via `unreal.load_object(None, "/Script/PoF.ARPGAbilityCatalogRow")`.
- **Row-type idiom (`ARPGAbilityCatalogTypes.h`):** `USTRUCT(BlueprintType) struct FARPGAbilityCatalogRow : public FTableRowBase { … }`. B3c's row mirrors this.
- **Enumerating native `UGA_Gen_*` C++ subclasses from Python is impractical** — so the dispatch emits a machine-readable **manifest** the seeder reads (clean decoupling). B3a/B3b already write a human `README.md`; B3c adds the manifest.
- **Ordering:** the seeder loads `/Script/PoF.GA_Gen_*` + `/Script/PoF.ARPGGeneratedAbilityRow`, which exist only after compilation — so it must run *after* the dispatch's build. Folding the seed into the post-build step of the same dispatch satisfies this.

## Architecture

```
"Generate C++" (one dispatch)
  → write UGE_Gen_* (Effects/Generated/) + UGA_Gen_* (Abilities/Generated/)   [B3a + B3b]
  → merge Effects/Generated/manifest.json (upsert this ability, keyed by name)  [B3c]
  → build PoF                                                                   [B3a/b]
  → run seed_generated_abilities.py via the editor → DT_GeneratedAbilities      [B3c]
```

**App side** is one more growth of the bundle prompt (Part D). The **UE infrastructure** (row struct + seeder) is hand-authored once and committed to `pof-exp` — it is the registry *mechanism*, not codegen output.

## The manifest (contract glue)

`Source/PoF/AbilitySystem/Effects/Generated/manifest.json`, accumulated across dispatches (read-merge-write, keyed by ability `name`):

```json
{
  "abilities": [
    {
      "name": "Fireball",
      "gameplayTag": "Ability.Fire.Fireball",
      "abilityClass": "/Script/PoF.GA_Gen_Fireball",
      "effectClasses": ["/Script/PoF.GE_Gen_Fireball_FireImpact", "/Script/PoF.GE_Gen_Fireball_Burning"]
    }
  ]
}
```

## Components

| Unit | Kind | Responsibility |
|------|------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | App (modify) | `buildGenerateAbilityBundlePrompt` gains a **Part D**: merge-write `manifest.json`, then (after build) run `seed_generated_abilities.py` and judge by its `-abslog` |
| `Source/PoF/AbilitySystem/ARPGGeneratedAbilityTypes.h` | UE infra (create) | `FARPGGeneratedAbilityRow : FTableRowBase` { `FName Name`; `FGameplayTag GameplayTag`; `TSoftClassPtr<UARPGGameplayAbility> AbilityClass`; `TArray<TSoftClassPtr<UGameplayEffect>> EffectClasses` } |
| `Content/Python/seed_generated_abilities.py` | UE infra (create) | read `manifest.json` → create/clear `/Game/Abilities/Generated/DT_GeneratedAbilities` → one row per ability (`load_class("/Script/PoF.GA_Gen_X")` for the soft refs) → save |

The row struct is **additive** — it does not touch `FARPGAbilityCatalogRow`, `DT_AbilityCatalog`, or its 5 lookup consumers.

## The Part D of the contract (appended to the bundle prompt)

12. **Merge the manifest:** read `Source/PoF/AbilitySystem/Effects/Generated/manifest.json` if it exists; upsert an entry for THIS ability keyed by `name` — `{ name, gameplayTag, abilityClass: "/Script/PoF.GA_Gen_<AbilityName>", effectClasses: ["/Script/PoF.GE_Gen_<AbilityName>_<EffectName>", …] }` — and write the file back (create it with `{ "abilities": [] }` if absent). Preserve other abilities' entries.
13. **Register (after the build succeeds):** run `Content/Python/seed_generated_abilities.py` via the FULL editor headless — `& "<UnrealEditor-Cmd.exe>" "<uproject>" -run=pythonscript -script="<abs path>" -unattended -nopause -abslog="<log>"`. It reads the manifest and writes `/Game/Abilities/Generated/DT_GeneratedAbilities`. Judge by the log line `[seed_generated_abilities] Saved … N rows` (the editor may exit non-zero on the benign shutdown crash — judge by the log).
14. Report the manifest entry written and the row count the seeder saved.

## Data flow / error handling

Single callback-free dispatch; verification is the build `-abslog` + the seed `-abslog` + the manifest/README. The seeder is defensive: missing manifest → seeds zero rows and logs; an `abilityClass` path that fails to load → logs the row as skipped and continues (so one bad entry never aborts the table). App-side errors are confined to pure prompt assembly.

## Verification

- **Hard gates:** (1) `FARPGGeneratedAbilityRow` compiles into `PoF`; (2) the seeder runs and `DT_GeneratedAbilities` is saved with the expected row whose `AbilityClass`/`EffectClasses` soft refs resolve.
- **UE proof:** author the struct + seeder, build, emit the Fireball manifest, run the seeder, confirm the row lands. Commit narrowly to `pof-exp`.

## Testing (app side)

- **`buildGenerateAbilityBundlePrompt` unit test (extend):** the prompt now also instructs writing/merging `manifest.json` (with the `/Script/PoF.GA_Gen_` soft-class path format) and running `seed_generated_abilities.py` to populate `DT_GeneratedAbilities`. Existing Part A/B/C assertions retained.
- **`cli-task` test (extend):** the assembled `generate-gas-effects` prompt contains `manifest.json` + `seed_generated_abilities.py` + `DT_GeneratedAbilities`, still callback-free.

## Scope / out of scope

- **In:** the manifest + seeder + row struct + the prompt Part D; the `DT_GeneratedAbilities` registry; UE proof.
- **Out:** a runtime consumer that *grants/uses* `DT_GeneratedAbilities` in-game (a lookup library like `UARPGAbilityCatalog`, or auto-granting generated abilities) — registration is the discovery surface; consumption is a separate future project. Merging generated rows into the existing `DT_AbilityCatalog`. Other catalogs.

## Invariants

Branch-local app commits; `@/` imports; co-author tag. UE-side: the row struct + seeder + `manifest.json` + `DT_GeneratedAbilities` live additively (no edits to the existing catalog/struct/consumers); judge by `-abslog`; stage only the new UE files on the shared tree; commit narrowly to `pof-exp`, don't push. App task ends targeted vitest green + `tsc`/eslint clean (excluding the 3 pre-existing foreign `AssetInspector` errors).
