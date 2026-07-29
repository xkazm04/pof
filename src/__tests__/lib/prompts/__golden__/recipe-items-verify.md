## Project Context
- Project: "PoF" at C:/proj/PoF
- UE Version: 5.7
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.7
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:/proj/PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Known UE Pitfalls
- **a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()** — A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP. (vertical-slice: HUD)
- **AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left** — GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command. (vertical-slice: HUD)
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Known Project Assets (use these EXACT paths — do not invent paths)
- **/Script/PoF.ARPGItemDefinition** (C++ Class (UARPGItemDefinition), project) — Base data-asset class for items — author instances under /Game/Items/.

## Domain Context
UARPGItemDefinition data-asset authoring for the PoF ARPG.

## Task: Items · verify

Run the item-definitions functional test; assert the asset loads with valid fields.

## Asset Specification

- **id**: `itm-blade`
- **name**: Ashen Blade
- **category**: Weapons
- **tags**: sword

```json
{
  "id": "itm-blade",
  "name": "Ashen Blade",
  "slot": "weapon",
  "rarity": "rare"
}
```

## Wiring Requirements
For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":
- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).
- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).
- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.
- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).
In your output, include a `wiring` field for each generated artifact summarizing the four points above.

Known wiring for this task:
| Artifact | Granted by | Activated by | Dependencies | Verify |
| --- | --- | --- | --- | --- |
| Base Type & Rarity · baseType | UARPGInventoryComponent equips the item and activates the equip GE bundle | On-equip (slot assignment in UARPGInventoryComponent) | UARPGAttributeSet (stat targets), UARPGItemDefinition (schema), DT_Items (data row) | L2: cppSymbolExists(UARPGItemDefinition) + seedRowPresent(author_items.py, DA_<slug>); L3: VSItemsDefinitionsTest — DA loaded + requiredLevel/slot/rarity fields assert correct |
| Affixes · affixes | UARPGInventoryComponent::EquipItem — creates one Infinite GameplayEffect handle per explicit affix in the item's rolled pool + one handle for the implicit; handles stored on the equip slot and removed on unequip. | On-equip slot assignment (UARPGInventoryComponent) | UARPGAttributeSet (target attributes: MaxHealth, BonusPhysicalDamage, AttackSpeed, FireResistance, LightningResistance, CriticalStrikeChance), GE_Affix_MaximumLife, GE_Affix_AddedPhysicalDamage, GE_Affix_IncreasedAttackSpeed, GE_Affix_FireResistance, GE_Affix_LightningResistance, GE_Affix_IncreasedCritChance, GE_Implicit_SwordAccuracy | L2: cppSymbolExists(UARPGItemDefinition) + all GE_ headers in Source/; L3: VSItemsDefinitionsTest — equip Iron Longsword on dummy ASC, assert AttackPower delta and that each affix GE handle is active on the ASC |
| Test Gate | UARPGInventoryComponent::EquipItem — binds one Infinite GE handle per affix; handles stored in TMap<FGameplayTag, FActiveGameplayEffectHandle>. | Equip slot assignment; reversed on unequip (RemoveActiveGameplayEffect) | UARPGAttributeSet (target attributes), UARPGItemDefinition (DA schema), DT_Items (data row), author_items.py (seed script) | L2: UARPGItemDefinition declared in Source/ + DA_IronLongsword seeded in author_items.py; L3: VSItemsDefinitionsTest (VSItems.umap) — 19+ assertions: loads DA, checks fields, equips on dummy ASC, asserts GE handles acti… |
| UE Packaging | UARPGItemDefinition (DA_AshenBlade) realized as a row in DT_Items; GE_ assets applied by UARPGInventoryComponent on equip; mesh bound to the item socket on the character skeletal mesh. | DA_AshenBlade loaded by the inventory component → equip → GE handles activated on ASC; triggered by UI slot assignment or code call to EquipItem. | UARPGItemDefinition (DA_AshenBlade), DT_Items (data row), UARPGInventoryComponent (equip logic), UARPGAttributeSet (target attributes), author_items.py (Content/Python seed script) | L2: UARPGItemDefinition in Source/ + DA_AshenBlade seeded in author_items.py + all GE_ headers compiled; L3: VSItemsDefinitionsTest in VSItems.umap — loads DA, asserts fields, equips on dummy ASC, checks GE handles + at… |

## UE5 Best Practices
- Author a `UARPGItemDefinition` data asset (Python, FULL editor via -ExecutePythonScript), not -run=pythonscript.
- Set the item type/rarity/stats from the Asset Specification; do not invent new fields.
- Place the asset under `/Game/Items/` and report its content path.

## Success Criteria
1. The functional test `Project.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest` returns Result={Success}.