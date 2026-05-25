# Register Generated Abilities in DT_GeneratedAbilities (B3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the C++ round-trip — the one "Generate C++" dispatch now also merges a `manifest.json` and runs `seed_generated_abilities.py` to populate an additive `DT_GeneratedAbilities` (new `FARPGGeneratedAbilityRow` struct), so generated abilities are discoverable through data, with zero blast radius on the existing catalog.

**Architecture:** App side = a Part D growth of the pure bundle prompt (merge manifest + run seeder after build). UE infrastructure = a hand-authored row struct + Python seeder (committed to `pof-exp`), proven by build + seed. No new task type, button, or callback.

**Tech Stack:** Next.js 16 / React 19, Vitest (app); UE5.7 C++ USTRUCT + Python DataTable seeder (UE infra).

**Reference spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-ability-spec-b3c-design.md`

**Invariants:** branch-local app commits on `feature/entity-centric-workspace`; `@/` imports; co-author every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. App task ends targeted vitest green + `npx tsc --noEmit` clean **excluding the 3 pre-existing foreign `AssetInspector.tsx` errors** (filter `| grep -v AssetInspector`). UE files: additive only; stage narrowly on the shared tree; commit to `pof-exp`, don't push.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | Modify | append **Part D** (merge `manifest.json` + run `seed_generated_abilities.py` after build) to `buildGenerateAbilityBundlePrompt` |
| `src/__tests__/lib/ability/effect-codegen-prompt.test.ts` | Modify | assert the Part D instructions |
| `src/__tests__/lib/cli-task-generate-gas-effects.test.ts` | Modify | assert Part D flows through the assembled prompt |
| `Source/PoF/AbilitySystem/ARPGGeneratedAbilityTypes.h` (UE) | Create | `FARPGGeneratedAbilityRow : FTableRowBase` |
| `Content/Python/seed_generated_abilities.py` (UE) | Create | manifest → `DT_GeneratedAbilities` seeder |

---

## Task 1: Part D of the bundle prompt (app side)

**Files:**
- Modify: `src/lib/ability/effect-codegen-prompt.ts`
- Modify: `src/__tests__/lib/ability/effect-codegen-prompt.test.ts`
- Modify: `src/__tests__/lib/cli-task-generate-gas-effects.test.ts`

- [ ] **Step 1: Add the failing assertions to the prompt-builder test**

In `src/__tests__/lib/ability/effect-codegen-prompt.test.ts`, add this test inside the `describe('buildGenerateAbilityBundlePrompt', …)` block (after the Part C test):

```ts
  it('Part D — instructs the manifest merge + DataTable seeder run', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('manifest.json');
    expect(p).toContain('/Script/PoF.GA_Gen_'); // soft-class path format in the manifest
    expect(p).toContain('seed_generated_abilities.py');
    expect(p).toContain('DT_GeneratedAbilities');
  });
```

- [ ] **Step 2: Add the failing assertion to the cli-task test**

In `src/__tests__/lib/cli-task-generate-gas-effects.test.ts`, add this test inside the `describe('generate-gas-effects task (ECW B3a + B3b bundle)', …)` block (after the existing bundle test):

```ts
  it('the assembled prompt includes the B3c manifest + seeder registration step', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('manifest.json');
    expect(prompt).toContain('seed_generated_abilities.py');
    expect(prompt).toContain('DT_GeneratedAbilities');
  });
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: FAIL — the two new tests fail (Part D not present yet).

- [ ] **Step 4: Append Part D to the prompt builder**

In `src/lib/ability/effect-codegen-prompt.ts`, in `buildGenerateAbilityBundlePrompt`, change the final array tail. Replace this (the last three bullets + the closing `]`):

```ts
    '## Contract — Part C: report + build',
    '9. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the GE + ability files, the attribute mapping, the tag→ActivationTags wiring, and the TAG DELTA — every granted/rule tag NOT declared in `ARPGGameplayTags.h` (do NOT auto-edit the tags header).',
    '10. Build the PoF module (per the build command above; regenerate project files if new `.cpp` files require it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '11. Report: files written, attributes mapped, activation tags wired, and any missing tags.',
  ].join('\n');
```

with:

```ts
    '## Contract — Part C: report + build',
    '9. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the GE + ability files, the attribute mapping, the tag→ActivationTags wiring, and the TAG DELTA — every granted/rule tag NOT declared in `ARPGGameplayTags.h` (do NOT auto-edit the tags header).',
    '10. Build the PoF module (per the build command above; regenerate project files if new `.cpp` files require it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '11. Report: files written, attributes mapped, activation tags wired, and any missing tags.',
    '',
    '## Contract — Part D: register in the data-driven catalog',
    '12. Merge `Source/PoF/AbilitySystem/Effects/Generated/manifest.json` (create with `{ "abilities": [] }` if absent): upsert THIS ability keyed by `name` — `{ "name": "<AbilityName>", "gameplayTag": "<ability tag>", "abilityClass": "/Script/PoF.GA_Gen_<AbilityName>", "effectClasses": ["/Script/PoF.GE_Gen_<AbilityName>_<EffectName>", …] }`. Preserve any other abilities already in the file.',
    '13. After the build succeeds, run `Content/Python/seed_generated_abilities.py` via the FULL editor headless — `& "<UnrealEditor-Cmd.exe>" "<the .uproject>" -run=pythonscript -script="<abs path to the script>" -unattended -nopause -abslog="<a log path>"`. It reads the manifest and writes `/Game/Abilities/Generated/DT_GeneratedAbilities`. Judge success by the log line `[seed_generated_abilities] Saved … N rows` (ignore a non-zero exit from the benign shutdown crash).',
    '14. Report the manifest entry written and the row count the seeder saved.',
  ].join('\n');
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: PASS (7 + 4 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ability/effect-codegen-prompt.ts src/__tests__/lib/ability/effect-codegen-prompt.test.ts src/__tests__/lib/cli-task-generate-gas-effects.test.ts
git commit -m "$(cat <<'EOF'
feat(ability): bundle prompt Part D — manifest + DT_GeneratedAbilities seed (B3c.1)

"Generate C++" now also instructs merging Effects/Generated/manifest.json and, after
the build, running seed_generated_abilities.py to populate the additive
DT_GeneratedAbilities registry. Closes the C++ round-trip (app side).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: UE infrastructure + proof (row struct + seeder, in `pof-exp`)

These are hand-authored once (the registry mechanism) and proven by build + seed. They land in the UE project (`pof-exp`), NOT the app repo.

**Files:**
- Create: `C:/Users/kazda/Documents/Unreal Projects/PoF/Source/PoF/AbilitySystem/ARPGGeneratedAbilityTypes.h`
- Create: `C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/seed_generated_abilities.py`
- Create (proof data): `…/Source/PoF/AbilitySystem/Effects/Generated/manifest.json`

- [ ] **Step 1: Create the row struct**

Create `Source/PoF/AbilitySystem/ARPGGeneratedAbilityTypes.h`:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "GameplayTagContainer.h"
#include "ARPGGeneratedAbilityTypes.generated.h"

class UARPGGameplayAbility;
class UGameplayEffect;

/**
 * One row of DT_GeneratedAbilities — the additive registry of abilities produced by
 * the app's "Generate C++" dispatch (ECW B3c). Discovery surface only; does NOT touch
 * the hand-authored DT_AbilityCatalog / FARPGAbilityCatalogRow / its lookup library.
 */
USTRUCT(BlueprintType)
struct FARPGGeneratedAbilityRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Display name of the source ability (e.g. "Fireball"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generated Ability")
	FName Name;

	/** The ability's gameplay tag (may be unregistered for app-only abilities). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generated Ability")
	FGameplayTag GameplayTag;

	/** The generated UGA_Gen_* ability class. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generated Ability")
	TSoftClassPtr<UARPGGameplayAbility> AbilityClass;

	/** The generated UGE_Gen_* effect classes the ability applies. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generated Ability")
	TArray<TSoftClassPtr<UGameplayEffect>> EffectClasses;
};
```

- [ ] **Step 2: Create the seeder**

Create `Content/Python/seed_generated_abilities.py`:

```python
"""
seed_generated_abilities.py
===========================
Reads Source/PoF/AbilitySystem/Effects/Generated/manifest.json (emitted by the app's
"Generate C++" dispatch) and writes /Game/Abilities/Generated/DT_GeneratedAbilities
(a UDataTable of FARPGGeneratedAbilityRow) — the additive registry of generated abilities.

Defensive: a missing manifest seeds zero rows; a class path that fails to load is skipped
(logged) so one bad entry never aborts the table.

Run headless after the C++ types + generated classes compile:
    "...UnrealEditor-Cmd.exe" "...PoF.uproject" -run=pythonscript -script="<abs>" -unattended -nopause -abslog="..."
"""

import json
import os
import unreal

PACKAGE_FOLDER = "/Game/Abilities/Generated"
ASSET_NAME = "DT_GeneratedAbilities"
PACKAGE_PATH = f"{PACKAGE_FOLDER}/{ASSET_NAME}"
ROW_STRUCT_PATH = "/Script/PoF.ARPGGeneratedAbilityRow"

PROJECT_DIR = unreal.Paths.project_dir()
MANIFEST_PATH = os.path.join(
    PROJECT_DIR, "Source", "PoF", "AbilitySystem", "Effects", "Generated", "manifest.json"
)


def load_manifest():
    if not os.path.isfile(MANIFEST_PATH):
        unreal.log_warning(f"[seed_generated_abilities] No manifest at {MANIFEST_PATH} — seeding 0 rows.")
        return []
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f).get("abilities", [])


def ensure_folder(path):
    eal = unreal.EditorAssetLibrary
    if not eal.does_directory_exist(path):
        eal.make_directory(path)


def load_row_struct():
    s = unreal.load_object(None, ROW_STRUCT_PATH)
    if s is None:
        raise RuntimeError(f"Could not load {ROW_STRUCT_PATH}. Recompile after adding ARPGGeneratedAbilityTypes.h.")
    return s


def create_or_clear_datatable(row_struct):
    eal = unreal.EditorAssetLibrary
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    if eal.does_asset_exist(PACKAGE_PATH):
        dt = eal.load_asset(PACKAGE_PATH)
        names = list(unreal.DataTableFunctionLibrary.get_data_table_row_names(dt))
        for n in names:
            unreal.DataTableFunctionLibrary.remove_data_table_row(dt, n)
        unreal.log(f"[seed_generated_abilities] Reused {PACKAGE_PATH} (cleared {len(names)} rows).")
        return dt
    factory = unreal.DataTableFactory()
    factory.struct = row_struct
    dt = tools.create_asset(ASSET_NAME, PACKAGE_FOLDER, unreal.DataTable, factory)
    if dt is None:
        raise RuntimeError(f"Failed to create DataTable at {PACKAGE_PATH}")
    unreal.log(f"[seed_generated_abilities] Created {PACKAGE_PATH}.")
    return dt


def resolve_class(path):
    """Load a /Script/... class path to a UClass (stored softly by the row). None on failure."""
    cls = unreal.load_object(None, path)
    if cls is None:
        unreal.log_warning(f"[seed_generated_abilities] Could not load class {path} — skipping that ref.")
    return cls


def add_row(dt, entry):
    name = entry.get("name", "")
    row = unreal.ARPGGeneratedAbilityRow()
    row.set_editor_property("Name", unreal.Name(name))

    tag = unreal.GameplayTag()
    tag.tag_name = entry.get("gameplayTag", "")
    row.set_editor_property("GameplayTag", tag)

    ability_cls = resolve_class(entry.get("abilityClass", ""))
    if ability_cls is not None:
        row.set_editor_property("AbilityClass", ability_cls)

    effect_classes = []
    for p in entry.get("effectClasses", []):
        c = resolve_class(p)
        if c is not None:
            effect_classes.append(c)
    row.set_editor_property("EffectClasses", effect_classes)

    unreal.DataTableFunctionLibrary.add_data_table_row(dt, unreal.Name(name), row)


def main():
    unreal.log("[seed_generated_abilities] Starting.")
    abilities = load_manifest()
    ensure_folder(PACKAGE_FOLDER)
    row_struct = load_row_struct()
    dt = create_or_clear_datatable(row_struct)

    seeded = 0
    for entry in abilities:
        try:
            add_row(dt, entry)
            unreal.log(f"[seed_generated_abilities] + {entry.get('name')}")
            seeded += 1
        except Exception as exc:
            unreal.log_error(f"[seed_generated_abilities] FAILED {entry.get('name')}: {exc}")

    unreal.EditorAssetLibrary.save_asset(PACKAGE_PATH)
    unreal.log(f"[seed_generated_abilities] Saved {PACKAGE_PATH} with {seeded} rows.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Build `PoFEditor` (compile the row struct alongside the existing generated classes)**

Run (PowerShell, background): `& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex -NoHotReload` → log to `C:\Users\kazda\kiro\pof\b3c-build.log`.
Expected: `Result: Succeeded` (the new `FARPGGeneratedAbilityRow` reflection compiles into `PoF`). Judge by the log, not exit code.

- [ ] **Step 4: Emit the Fireball manifest**

Create `Source/PoF/AbilitySystem/Effects/Generated/manifest.json`:

```json
{
  "abilities": [
    {
      "name": "Fireball",
      "gameplayTag": "Ability.Fire.Fireball",
      "abilityClass": "/Script/PoF.GA_Gen_Fireball",
      "effectClasses": [
        "/Script/PoF.GE_Gen_Fireball_FireImpact",
        "/Script/PoF.GE_Gen_Fireball_Burning"
      ]
    }
  ]
}
```

- [ ] **Step 5: Run the seeder headless**

Run (PowerShell, background): `& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\seed_generated_abilities.py" -unattended -nopause -abslog="C:\Users\kazda\kiro\pof\b3c-seed.log"`.
Expected: the log contains `[seed_generated_abilities] + Fireball` and `[seed_generated_abilities] Saved /Game/Abilities/Generated/DT_GeneratedAbilities with 1 rows.` (judge by log, not exit code).

- [ ] **Step 6: Verify the soft-class refs resolved**

In `C:\Users\kazda\kiro\pof\b3c-seed.log`, confirm there are NO `Could not load class /Script/PoF.GA_Gen_Fireball` / `…GE_Gen_…` warnings (i.e., the ability + effect classes resolved). If a `set_editor_property("AbilityClass", …)` type error appears, switch that assignment to `unreal.SoftClassPath(path)` and re-run (the one fiddly soft-ref idiom).

- [ ] **Step 7: Commit the UE infrastructure narrowly to `pof-exp`**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF" && git add "Source/PoF/AbilitySystem/ARPGGeneratedAbilityTypes.h" "Content/Python/seed_generated_abilities.py" "Source/PoF/AbilitySystem/Effects/Generated/manifest.json" && git commit -m "$(cat <<'EOF'
feat(gas): DT_GeneratedAbilities registry struct + seeder (ECW B3c)

FARPGGeneratedAbilityRow (additive; no touch to FARPGAbilityCatalogRow) + a
seed_generated_abilities.py that reads Effects/Generated/manifest.json and writes
/Game/Abilities/Generated/DT_GeneratedAbilities. Proven: struct compiles into PoF;
seeder registers the generated Fireball ability (soft refs resolve).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Clean up the stray logs in the app repo working dir**

Run: `rm -f C:/Users/kazda/kiro/pof/b3c-build.log C:/Users/kazda/kiro/pof/b3c-seed.log`

---

## Final Verification

- [ ] **App suite + typecheck**

Run: `npx vitest run src/__tests__/lib/ability src/__tests__/lib/cli-task-generate-gas-effects.test.ts src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: all green.

Run: `npx tsc --noEmit 2>&1 | grep -iE "error TS" | grep -v AssetInspector | wc -l`
Expected: `0`.

- [ ] **UE**: `b3c-build.log` shows `Result: Succeeded`; `b3c-seed.log` shows `Saved … with 1 rows.` with no unresolved-class warnings.

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** Part D (Task 1) implements the manifest-merge + seeder-run contract; the row struct + seeder (Task 2) implement the UE registry; the proof (Task 2 Steps 3–6) is the verification. The out-of-scope runtime consumer is not built.
- **Placeholder scan:** no plan placeholders; the C++/Python is complete.
- **Type/idiom consistency:** manifest `abilityClass`/`effectClasses` paths (`/Script/PoF.GA_Gen_Fireball`, `…GE_Gen_Fireball_FireImpact/_Burning`) match B3a/B3b's committed class names; the row struct field names (`Name`/`GameplayTag`/`AbilityClass`/`EffectClasses`) match the seeder's `set_editor_property` keys; `ROW_STRUCT_PATH` `/Script/PoF.ARPGGeneratedAbilityRow` matches the USTRUCT name. The seeder mirrors `seed_ability_catalog.py`'s proven calls (`DataTableFactory`, `add_data_table_row`, `load_object`).
- **Soft-ref risk:** the one unproven idiom is assigning a `UClass` to a `TSoftClassPtr` UPROPERTY via `set_editor_property`; Step 6 carries the `unreal.SoftClassPath(path)` fallback if the direct assignment errors.
- **Ordering:** the row struct compiles in Step 3's build; the generated `GA_Gen_*`/`GE_Gen_*` classes already exist (B3a/B3b proofs committed to `pof-exp`), so the seeder (Step 5) resolves them.
```
