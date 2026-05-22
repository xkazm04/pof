# PS-1 Ground-Truth: Generated Gameplay Classes

_Discovery-only task. No C++ was written or modified._

---

## Step 1: Melee Damage Path (`UGA_MeleeAttack`)

**File:** `Source/PoF/AbilitySystem/GA_MeleeAttack.cpp`

### Where damage is applied

Damage is **not** applied in `ActivateAbility` directly. It is applied inside `OnMeleeHit`, which fires in response to the `Event.MeleeHit` gameplay event:

```
ActivateAbility
  └─ StartMontageAndListenForCombo
       └─ ListenForComboWindow  [sets up WaitGameplayEvent for Event.MeleeHit]
            └─ OnMeleeHit(Payload)   <-- builds GE spec, calls ApplyGameplayEffectSpecToTarget
```

The `Event.MeleeHit` event must be sent by an **AnimNotifyState** (a hit-detection box notify) that fires during the montage's active frames. It is a gameplay-event-gated path, not a direct call from `ActivateAbility`.

### Bug: `AM_MeleeCombo` is an empty shell

`AM_MeleeCombo` (`Content/Characters/Player/Animations/Montages/AM_MeleeCombo.uasset`) exists on disk, but it was created empty — it has no anim notifies. This means:

- The `Event.MeleeHit` gameplay event will **never fire** → `OnMeleeHit` will never run → **damage will never apply**.
- The `Event.Combo.Open` / `Event.Combo.Close` events will **never fire** → combo window will never open.

**Fix needed (later task):** Add a hit-detection AnimNotifyState (e.g., `AnimNotify_MeleeHitDetect`) to `AM_MeleeCombo` that sends `Event.MeleeHit` on each frame overlap.

### `CanActivateAbility` guard on `ComboSectionNames`

```cpp
if (!AttackMontage || ComboSectionNames.Num() == 0)
    return false;
```

`CanActivateAbility` hard-gates on `ComboSectionNames` being non-empty. If the Blueprint default for `UGA_MeleeAttack` does not populate `ComboSectionNames`, the ability **cannot activate at all** — it silently fails before the montage is ever played.

### `ComboSectionNames` and montage section jumping

`AdvanceCombo()` calls `ASC->CurrentMontageJumpToSection(NextSection)` with the name from `ComboSectionNames[CurrentComboIndex]`. If the montage has no named sections matching those names, the jump silently no-ops (the montage continues from its current position). This is not a crash but the combo would not advance properly.

---

## Step 2: Possession / ASC-Init Path

**Files:** `Source/PoF/Character/ARPGCharacterBase.cpp`, `Source/PoF/Character/ARPGEnemyCharacter.cpp`

### `PossessedBy` body (base class)

```cpp
void AARPGCharacterBase::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);

    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->InitAbilityActorInfo(NewController, this);
        InitializeAttributes();
    }
}
```

- `InitAbilityActorInfo` is called first (server-side).
- `InitializeAttributes()` is called immediately after — so it is safe because `InitAbilityActorInfo` has already run.

### Enemy override of `PossessedBy`

`AARPGEnemyCharacter::PossessedBy` **overrides** the base and re-calls `InitAbilityActorInfo(this, this)` (both owner and avatar are `this`, which is correct for AI characters), then calls:

```
ApplyArchetypeDefaults()
GrantAbilitiesToASC()
WriteArchetypeToBlackboard()
InitializeHealthBarWidget()
```

`GrantAbilitiesToASC()` iterates `GrantedAbilities` (a `TArray<TSubclassOf<UGameplayAbility>>` on the enemy — must be populated in Blueprint/CDO) and calls `GiveAbility`. This runs **after** `InitAbilityActorInfo`, which is the correct order.

**Note:** `AARPGEnemyCharacter::PossessedBy` does **not** call `Super::PossessedBy` on the base class `AARPGCharacterBase::PossessedBy` — it only calls `Super::PossessedBy(NewController)` which goes to `ACharacter`. This means `InitializeAttributes()` is **not called** from `AARPGCharacterBase::PossessedBy` for enemies — the enemy's `PossessedBy` skips that path. Attributes for enemies are initialized only if the enemy explicitly does so elsewhere. (This is a potential concern to verify in the Blueprint default for `AttributeInitTable`.)

### Enemy death flow

1. `UARPGAttributeSet::PostGameplayEffectExecute` detects `Health <= 0` (via `IncomingDamage` meta attribute).
2. Broadcasts `OnHealthDepleted(Instigator)`.
3. Sends `Event.Death` gameplay event via `ASC->HandleGameplayEvent`.
4. `UGA_Death` is triggered by that event (it has `TriggerTag = Event.Death`, `TriggerSource = GameplayEvent`).
5. `GA_Death::ActivateAbility` calls `EnemyChar->OnDeathFromAbility(KillingActor)`.
6. `AARPGEnemyCharacter::OnDeathFromAbility`:
   - Sets `bIsAlive = false`.
   - Calls `HandleDeathCleanup()` (disables capsule collision, stops movement, stops BT).
   - Awards XP to killer via `GE_AwardXP`.
   - Broadcasts `OnEnemyDeath.Broadcast(this)`.
7. `OnEnemyDeath` delegate fires `UARPGLootDropComponent::OnOwnerDeath` (bound in `BeginPlay` when `bAutoDropOnDeath=true`), which calls `DropLoot()`.
8. Back in `GA_Death`, after the death montage finishes, `Character->SetLifeSpan(EnemyDestroyDelay)` is called — the enemy **does** eventually `Destroy()` itself via `SetLifeSpan` (not immediately; after `EnemyDestroyDelay` seconds, defaulting to whatever the Blueprint sets, or 0 which would be immediate).

**There is no separate `GA_Death` grant needed at runtime** — `GA_Death` must be in `GrantedAbilities` on the enemy Blueprint (or granted to the player explicitly), because `GrantAbilitiesToASC()` only grants what is in that array.

### `InitializeAttributes()` fallback behavior

```cpp
void AARPGCharacterBase::InitializeAttributes()
{
    if (!AbilitySystemComponent || !AttributeInitTable)
    {
        UE_LOG(LogTemp, Warning, TEXT("... missing ASC or AttributeInitTable"));
        return;  // <-- early return, no attributes initialized
    }
    // ...
}
```

**There is no fallback.** If `AttributeInitTable` is null (not assigned on the CDO/Blueprint), `InitializeAttributes()` returns immediately with a warning. GAS attributes will hold their constructor defaults from `UARPGAttributeSet()`:

```
Health = 100, MaxHealth = 100, Mana = 50, MaxMana = 50, AttackPower = 10, ...
```

These are non-zero sane values, so the character will not be immediately dead. However, they won't match any game-design values. Additionally, `LevelScalingCurveTable` is optional — if null, the multiplier defaults to 1.0 and base values are used directly.

---

## Step 3: Attribute-Init DataTable + Loot Table Situation

### Attribute-init DataTable asset status

Searched `Content/` recursively for `.uasset` files matching `DT_` / `Attribute` / `DataTable`.

**Result: No `DT_AttributeDefaults` (or equivalent) DataTable asset exists in Content.**

The only data assets found:
- `Content/Data/Progression/CT_XPRequirements.uasset` — a CurveTable for XP requirements per level. Exists.
- `AM_MeleeCombo.uasset`, `AM_Death.uasset`, and dodge/hit-react montages under `Content/Characters/Player/Animations/Montages/`. These exist as empty/shell assets.
- `IA_Attack.uasset`, `IA_Move.uasset` under `Content/Input/Actions/`.

**A later task must create the attribute-init DataTable.** Required:
- Asset type: DataTable, row struct `FARPGAttributeInitRow`.
- Must include at minimum two rows: `"Player"` (for `AARPGPlayerCharacter`) and `"Skeleton"` (for `AARPGEnemyCharacter`, which sets `AttributeInitRowName = TEXT("Skeleton")` in its constructor).

No `UARPGLootTable` data asset exists in Content.

### Minimum loot config for a spawned `AARPGWorldItem`

`UARPGLootDropComponent::DropLoot()` has two independent drop paths:

**Path A — LootTable items:**
- Requires `LootTable != nullptr`.
- Calls `LootTable->RollLoot(GetOwner(), RarityBonusMultiplier)` → returns `UARPGItemInstance*` array.
- Each instance is passed to `SpawnWorldItemInternal`, which calls `World->SpawnActor<AARPGWorldItem>`.
- Minimum config: assign a `UARPGLootTable` data asset with at least one `FLootEntry` (non-null `Item` + `DropWeight > 0`, `NothingWeight = 0`).

**Path B — Gold (always available without a LootTable):**
- Requires only `bDropGold = true` (default is `true`).
- `DropGold(EnemyLevel)` calls `ResolveGoldDefinition()` which **lazily creates a transient `UARPGItemDefinition`** if `GoldItemDefinition` is null:
  ```cpp
  RuntimeGoldDefinition = NewObject<UARPGItemDefinition>(this, TEXT("RuntimeGoldDefinition"));
  ```
- Then calls `SpawnWorldItemInternal(GoldInstance, LaunchVelocity)` → `World->SpawnActor<AARPGWorldItem>`.
- **This path works with zero content assets.** No `UARPGLootTable`, no `UARPGItemDefinition` asset needed.

**Conclusion for vertical slice:** Setting `bDropGold = true` (already the default) is sufficient to get a placed `AARPGWorldItem` actor on death with no content assets. The gold drop uses a runtime-generated item definition. The LootTable path is optional for the slice.

---

## Summary of Bugs / Missing Assets for Later Tasks

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `AM_MeleeCombo` has no AnimNotify states → `Event.MeleeHit` never fires → **damage never applies** | Critical | Add hit-detection notify state to montage |
| 2 | `AM_MeleeCombo` has no combo-window notifies → `Event.Combo.Open/Close` never fire → combos never chain | High | Add combo-window notify states to montage |
| 3 | `ComboSectionNames` must be non-empty on the `UGA_MeleeAttack` Blueprint CDO or ability never activates | High | Populate `ComboSectionNames` in Blueprint |
| 4 | `AM_MeleeCombo` has no named sections → `CurrentMontageJumpToSection` silently no-ops | Medium | Add named montage sections matching `ComboSectionNames` |
| 5 | No `DT_AttributeDefaults` DataTable exists → `InitializeAttributes()` returns early → attributes use constructor defaults (non-zero but not designed values) | High | Create DataTable with rows `"Player"` and `"Skeleton"` |
| 6 | No `UARPGLootTable` data asset exists → LootTable drop path never runs (gold path works, no asset needed) | Low for slice | Create loot table asset if non-gold drops are needed |
| 7 | `GA_Death` must be in `GrantedAbilities` on each character Blueprint — not granted automatically | Must verify | Confirm Blueprint CDOs include `UGA_Death` in `GrantedAbilities` |
| 8 | Enemy `PossessedBy` does not call base class `InitializeAttributes` — attributes init only if enemy also has path to it | Must verify | Confirm enemy Blueprint has `AttributeInitTable` set or attributes are otherwise initialized |
