## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.
- Generate all code files directly — do NOT ask for confirmation.
- This system must integrate with UARPGInventoryComponent and UARPGItemInstance from the existing inventory module.

## Known UE Pitfalls
- **a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()** — A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP. (vertical-slice: HUD)
- **AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left** — GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command. (vertical-slice: HUD)
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))

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
- **/Script/PoF.ARPGCodeWidgetBase** (C++ Class (UARPGCodeWidgetBase), project) — Pure-C++ UMG widget parent (no BindWidget; build tree in RebuildWidget). All Screen Flow widgets extend this.

## Project Knowledge Tips
- **C++ driven UMG** — Create widgets in C++ and use Blueprint for layout. This gives you type safety and better performance.

## Task: Full UMG Inventory System with C++ Data Binding

Build a complete inventory UI system using UMG with C++ data binding for the UARPGInventoryComponent.

### Grid Layout
- **Grid size**: 6 columns × 4 rows (24 slots total)
- Each slot is a UUserWidget with icon, stack count overlay, rarity border, and tooltip trigger
- Grid is backed by UARPGInventoryComponent's slot array

### Item Slot Types
  - Weapon
  - Armor
  - Consumable
  - Quest Item

### Equipment Panel Layout
The equipment panel sits alongside the grid inventory. Slots:
  - Head → EEquipmentSlot::Head
  - Chest → EEquipmentSlot::Chest
  - Legs → EEquipmentSlot::Legs
  - Hands → EEquipmentSlot::Hands
  - Feet → EEquipmentSlot::Feet
  - Weapon L → EEquipmentSlot::WeaponLeft
  - Weapon R → EEquipmentSlot::WeaponRight
  - Ring 1 → EEquipmentSlot::Ring1
  - Ring 2 → EEquipmentSlot::Ring2

EEquipmentSlot enum values: { Head, Chest, Legs, Hands, Feet, WeaponLeft, WeaponRight, Ring1, Ring2 }
The equipment panel should visually represent a character silhouette layout with slots positioned around it.

### Interaction Modes
  - **Drag & Drop**: Drag items between inventory slots and equipment
  - **Right-Click Use**: Right-click consumables to use, equipment to equip
  - **Shift-Click Split**: Split stackable item stacks in half

### Stack Configuration
- Stackable items: Yes
- Max stack size: 99

### Item Rarities
  - Common
  - Uncommon
  - Rare
  - Epic
  - Legendary
Each rarity should have a distinct border color/glow on the inventory slot.

### Required Files (all under Source/PoF/UI/Inventory/)

1. **UInventoryGridWidget** (.h/.cpp)
   - UUniformGridPanel with 24 UInventorySlotWidget children
   - Binds to UARPGInventoryComponent via TWeakObjectPtr
   - Refresh() rebuilds slot visuals from component data
   - Grid dimensions: 6x4

2. **UInventorySlotWidget** (.h/.cpp)
   - UImage for item icon, UTextBlock for stack count
   - UBorder with rarity-colored material
   - Tooltip widget spawned on hover showing item name, stats, description
   - Implements drag-and-drop: NativeOnDragDetected, NativeOnDrop, NativeOnDragEnter/Leave
   - NativeOnMouseButtonDown handles right-click for use/equip

3. **UEquipmentPanelWidget** (.h/.cpp)
   - Named slots matching EEquipmentSlot enum
   - Each slot is a styled UInventorySlotWidget restricted to its slot type
   - Visual character silhouette layout

4. **UInventoryScreenWidget** (.h/.cpp)
   - Top-level container combining UInventoryGridWidget + UEquipmentPanelWidget
   - Opens/closes on keybind (e.g., 'I' key)
   - Handles Shift+Click for stack splitting with a quantity popup
   - 

5. **UItemTooltipWidget** (.h/.cpp)
   - Shows item name (rarity colored), icon, description, stats, affix list
   - Positioned near cursor, clamped to viewport

### Integration Points
- UARPGInventoryComponent: Read items, Add/Remove/Move/Swap operations
- UARPGItemInstance: Item data (definition ref, stack count, affixes)
- UARPGItemDefinition: Static data (name, icon, type, rarity, effects)
- Equipment slot system: Equip/unequip with GAS effect flow
- Bind to inventory component delegates for auto-refresh on changes

### UE5 Best Practices
- All widgets created in C++ with UPROPERTY(meta=(BindWidget)) for UMG designer access
- Use FSlateStyleSet or data-driven approach for rarity colors
- NativeConstruct / NativeDestruct for setup/teardown
- Async icon loading with TSoftObjectPtr<UTexture2D>
- All public methods UFUNCTION(BlueprintCallable)