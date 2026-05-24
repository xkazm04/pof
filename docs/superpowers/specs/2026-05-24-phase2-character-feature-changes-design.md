# Phase 2 — Character Tab Feature Changes

**Date:** 2026-05-24
**Status:** Approved.

Builds on the 2026-05-24 core-engine sub-folder restructure spec (Phase 1) and the agent-led Phase 1.5 LOC splits. Four feature changes to `sub_character`, plus a matching UE5 C++ schema for one of them.

## Defaults locked in

- F1 default landing subtab stays `'overview'` (don't surprise existing users).
- F2 column order: **Movement | Combat | Camera**.
- F3 UE side: `DT_AbilityCatalog.uasset` lives at `/Game/Abilities/`.

## Feature 1 — Wizard → subtab

- Registry `unique-tabs/index.tsx`: stop stacking `<CharacterSourceWizard>`; render only `<CharacterBlueprint>`.
- `sub_character/_shared/data.ts`: extend `BlueprintSubtab` with `'wizard'`; prepend a `SUBTABS` entry with icon `Wand2`, label `Wizard`, narrative `Source`.
- `sub_character/index.tsx`: render `<CharacterSourceWizard />` when `activeTab === 'wizard'`.
- Phase 1.5 absorption: split `CharacterSourceWizard.tsx` (217 LOC) → `WizardSourceCard.tsx` + main file ≤200 LOC.

## Feature 2 — 3-column PropertyInspector

- `_shared/data.ts`: introduce `MOVEMENT_PROPS`, `COMBAT_PROPS`, `CAMERA_PROPS` arrays (typed). Keep prop shape compatible with existing renderer.
- `sub_character/overview/PropertyColumn.tsx` (new): renders one column's heading + properties.
- `sub_character/overview/PropertyInspector.tsx`: becomes a thin shell — `<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">` with three `<PropertyColumn>`.
- Column order: Movement | Combat | Camera.
- Drops PropertyInspector well under 200 LOC (Phase 1.5 absorbed).

## Feature 3 — Input categorization

### F3a — PoF app side

`sub_character/_shared/data.ts`:

```ts
export type AbilityCategory = 'melee' | 'ranged' | 'magical' | 'utility' | 'movement';

export const ABILITY_CATEGORIES: ReadonlyArray<{
  key: AbilityCategory;
  label: string;
  color: string;
  icon: LucideIcon;
}> = [
  { key: 'melee',    label: 'Melee',    color: ACCENT_ORANGE, icon: Sword },
  { key: 'ranged',   label: 'Ranged',   color: ACCENT_CYAN,   icon: Crosshair },
  { key: 'magical',  label: 'Magical',  color: ACCENT_VIOLET, icon: Sparkles },
  { key: 'utility',  label: 'Utility',  color: ACCENT_EMERALD,icon: Wrench },
  { key: 'movement', label: 'Movement', color: ACCENT_PINK,   icon: Zap },
];

export interface AbilityMeta {
  id: string;
  name: string;
  category: AbilityCategory;
  tier: 1 | 2 | 3 | 4 | 5;
  baseDamage: number;          // 0 for utility/movement
  description: string;
  gameplayTag?: string;        // UE5 GameplayTag matcher, dotted e.g. "Ability.Melee.Slash"
}

export const CHARACTER_ABILITIES: AbilityMeta[] = [
  /* seeded from current input bindings */
];
```

`sub_character/input/`:
- `AbilityCategoryGroup.tsx` (new): one section per category, internally sortable by tier / damage / name.
- `InputTab.tsx`: add a sort selector chip group above the abilities area, threaded into the group component.
- `AbilityQuickPicker.tsx`: filter/group by category; color tag chips with category color.
- `KeyboardVisualization.tsx`: tint bound keys by their ability's category color.

Phase 1.5 absorbed: `InputBindingsTable.tsx` (241 LOC) split during the refactor (extract `InputBindingsRow.tsx`); `KeyboardVisualization.tsx` (208 LOC) split (extract `KeyboardRow.tsx` or similar).

### F3b — UE5 C++ side (project at `C:\Users\kazda\Documents\Unreal Projects\PoF`, pushes to xkazm04/pof-exp)

New files in `Source/PoF/Abilities/`:

```cpp
// EAbilityCategory.h
UENUM(BlueprintType)
enum class EAbilityCategory : uint8 {
    Melee     UMETA(DisplayName = "Melee"),
    Ranged    UMETA(DisplayName = "Ranged"),
    Magical   UMETA(DisplayName = "Magical"),
    Utility   UMETA(DisplayName = "Utility"),
    Movement  UMETA(DisplayName = "Movement"),
};

// FAbilityCatalogRow.h
USTRUCT(BlueprintType)
struct POF_API FAbilityCatalogRow : public FTableRowBase {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadOnly) FName Name;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) EAbilityCategory Category = EAbilityCategory::Melee;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (ClampMin = 1, ClampMax = 5)) int32 Tier = 1;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) float BaseDamage = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) FText Description;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag GameplayTag;
};
```

`DT_AbilityCatalog.uasset` at `Content/Abilities/` — DataTable using `FAbilityCatalogRow`, seeded with the same rows as `CHARACTER_ABILITIES`. Both sides carry a `// SYNC SOURCE` marker pointing to the other.

Getter on the existing ability system component (likely `UPoFAbilitySystemComponent`):

```cpp
UFUNCTION(BlueprintCallable, Category = "Ability|Catalog")
FAbilityCatalogRow GetAbilityRow(FGameplayTag Tag) const;
```

Reads from `DT_AbilityCatalog` (hardcoded path `/Game/Abilities/DT_AbilityCatalog` for v1).

Build constraints per memory:
- Requires UE editor rebuild — `UnrealEditor-Cmd ... -abslog=...` (exit code lies, judge by log content).
- Narrow `git add` only — UE tree is shared multi-session.

## Feature 4 — Simulator dead-space polish

`sub_character/simulator/SimulatorTab.tsx` + `ComparisonMatrix.tsx`:
- Outer wrapper: `<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">` (matrix wide on left, radar compact on right). `PredictiveBalanceSimulator` full-width below.
- Character grid inside `ComparisonMatrix`: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6` (was `lg:grid-cols-2`).
- Spacing: `space-y-5` → `space-y-3`; panel `p-4` → `p-3`.
- Default character count: 2 → 4.
- Header density: avatar 32→24, font 14→12.

Tailwind-only; no new files, no LOC growth.

## Execution order & commit cadence

1. F1 Wizard subtab (+ wizard file split) — 1 commit.
2. F2 PropertyInspector 3-col (+ Phase 1.5 absorption) — 1 commit.
3. F4 Simulator polish — 1 commit.
4. F3a PoF input categorization (+ Phase 1.5 absorption for InputBindingsTable, KeyboardVisualization) — 1 commit.
5. F3b UE5 C++ schema — 1 commit on the UE repo (separate tree).
6. Final validate (`npx tsc --noEmit`, exclude foreign `visual-gen/asset-viewer/AssetInspector`) + LOC scan of `sub_character`.

## Out of scope

- The 8 deferred orphan/internal files (`sub_ability/blueprint/_orphan/*`, `sub_progression/_internals/*`) — separate cleanup work.
- Migration of the remaining 6 menus' local `NarrativeBreadcrumb` to the generic one in `unique-tabs/_shared.tsx` — separate cleanup.
