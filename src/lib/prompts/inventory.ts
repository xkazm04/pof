import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';

export interface InventoryConfig {
  gridCols: number;
  gridRows: number;
  slotTypes: SlotTypeConfig[];
  equipmentSlots: EquipmentSlotConfig[];
  interactions: InteractionMode[];
  stackable: boolean;
  maxStackSize: number;
  itemRarities: string[];
}

export interface SlotTypeConfig {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface EquipmentSlotConfig {
  id: string;
  label: string;
  slotEnum: string;
  enabled: boolean;
}

export type InteractionMode = 'drag-drop' | 'right-click-use' | 'shift-click-split' | 'double-click-equip' | 'ctrl-click-move';

export const DEFAULT_SLOT_TYPES: SlotTypeConfig[] = [
  { id: 'weapon', label: 'Weapon', color: '#f87171', enabled: true },
  { id: 'armor', label: 'Armor', color: '#60a5fa', enabled: true },
  { id: 'consumable', label: 'Consumable', color: '#4ade80', enabled: true },
  { id: 'quest', label: 'Quest Item', color: '#fbbf24', enabled: true },
  { id: 'material', label: 'Material', color: '#a78bfa', enabled: false },
  { id: 'gem', label: 'Gem / Socket', color: '#22d3ee', enabled: false },
];

export const DEFAULT_EQUIPMENT_SLOTS: EquipmentSlotConfig[] = [
  { id: 'head', label: 'Head', slotEnum: 'Head', enabled: true },
  { id: 'chest', label: 'Chest', slotEnum: 'Chest', enabled: true },
  { id: 'legs', label: 'Legs', slotEnum: 'Legs', enabled: true },
  { id: 'hands', label: 'Hands', slotEnum: 'Hands', enabled: true },
  { id: 'feet', label: 'Feet', slotEnum: 'Feet', enabled: true },
  { id: 'weapon-l', label: 'Weapon L', slotEnum: 'WeaponLeft', enabled: true },
  { id: 'weapon-r', label: 'Weapon R', slotEnum: 'WeaponRight', enabled: true },
  { id: 'ring-1', label: 'Ring 1', slotEnum: 'Ring1', enabled: true },
  { id: 'ring-2', label: 'Ring 2', slotEnum: 'Ring2', enabled: true },
  { id: 'amulet', label: 'Amulet', slotEnum: 'Amulet', enabled: false },
  { id: 'belt', label: 'Belt', slotEnum: 'Belt', enabled: false },
  { id: 'cape', label: 'Cape', slotEnum: 'Cape', enabled: false },
];

export const ALL_INTERACTIONS: { id: InteractionMode; label: string; description: string }[] = [
  { id: 'drag-drop', label: 'Drag & Drop', description: 'Drag items between inventory slots and equipment' },
  { id: 'right-click-use', label: 'Right-Click Use', description: 'Right-click consumables to use, equipment to equip' },
  { id: 'shift-click-split', label: 'Shift-Click Split', description: 'Split stackable item stacks in half' },
  { id: 'double-click-equip', label: 'Double-Click Equip', description: 'Double-click to auto-equip/unequip' },
  { id: 'ctrl-click-move', label: 'Ctrl-Click Move', description: 'Ctrl-click to move between inventory/stash' },
];

export const DEFAULT_CONFIG: InventoryConfig = {
  gridCols: 6,
  gridRows: 4,
  slotTypes: DEFAULT_SLOT_TYPES,
  equipmentSlots: DEFAULT_EQUIPMENT_SLOTS,
  interactions: ['drag-drop', 'right-click-use', 'shift-click-split'],
  stackable: true,
  maxStackSize: 99,
  itemRarities: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
};

export function buildInventoryPrompt(config: InventoryConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'This system must integrate with UARPGInventoryComponent and UARPGItemInstance from the existing inventory module.',
    ],
  });

  const enabledSlotTypes = config.slotTypes.filter((s) => s.enabled);
  const enabledEquipSlots = config.equipmentSlots.filter((s) => s.enabled);
  const interactionLabels = ALL_INTERACTIONS
    .filter((i) => config.interactions.includes(i.id))
    .map((i) => `  - **${i.label}**: ${i.description}`)
    .join('\n');

  const slotTypeLines = enabledSlotTypes
    .map((s) => `  - ${s.label}`)
    .join('\n');

  const equipSlotLines = enabledEquipSlots
    .map((s) => `  - ${s.label} → EEquipmentSlot::${s.slotEnum}`)
    .join('\n');

  const enumValues = enabledEquipSlots
    .map((s) => s.slotEnum)
    .join(', ');

  const rarityLines = config.itemRarities
    .map((r) => `  - ${r}`)
    .join('\n');

  return `${header}

## Task: Full UMG Inventory System with C++ Data Binding

Build a complete inventory UI system using UMG with C++ data binding for the UARPGInventoryComponent.

### Grid Layout
- **Grid size**: ${config.gridCols} columns × ${config.gridRows} rows (${config.gridCols * config.gridRows} slots total)
- Each slot is a UUserWidget with icon, stack count overlay, rarity border, and tooltip trigger
- Grid is backed by UARPGInventoryComponent's slot array

### Item Slot Types
${slotTypeLines}

### Equipment Panel Layout
The equipment panel sits alongside the grid inventory. Slots:
${equipSlotLines}

EEquipmentSlot enum values: { ${enumValues} }
The equipment panel should visually represent a character silhouette layout with slots positioned around it.

### Interaction Modes
${interactionLabels}

### Stack Configuration
- Stackable items: ${config.stackable ? 'Yes' : 'No'}${config.stackable ? `\n- Max stack size: ${config.maxStackSize}` : ''}

### Item Rarities
${rarityLines}
Each rarity should have a distinct border color/glow on the inventory slot.

### Required Files (all under Source/${moduleName}/UI/Inventory/)

1. **UInventoryGridWidget** (.h/.cpp)
   - UUniformGridPanel with ${config.gridCols * config.gridRows} UInventorySlotWidget children
   - Binds to UARPGInventoryComponent via TWeakObjectPtr
   - Refresh() rebuilds slot visuals from component data
   - Grid dimensions: ${config.gridCols}x${config.gridRows}

2. **UInventorySlotWidget** (.h/.cpp)
   - UImage for item icon, UTextBlock for stack count
   - UBorder with rarity-colored material
   - Tooltip widget spawned on hover showing item name, stats, description
   ${config.interactions.includes('drag-drop') ? '- Implements drag-and-drop: NativeOnDragDetected, NativeOnDrop, NativeOnDragEnter/Leave' : ''}
   ${config.interactions.includes('right-click-use') ? '- NativeOnMouseButtonDown handles right-click for use/equip' : ''}

3. **UEquipmentPanelWidget** (.h/.cpp)
   - Named slots matching EEquipmentSlot enum
   - Each slot is a styled UInventorySlotWidget restricted to its slot type
   - Visual character silhouette layout

4. **UInventoryScreenWidget** (.h/.cpp)
   - Top-level container combining UInventoryGridWidget + UEquipmentPanelWidget
   - Opens/closes on keybind (e.g., 'I' key)
   - ${config.interactions.includes('shift-click-split') ? 'Handles Shift+Click for stack splitting with a quantity popup' : ''}
   - ${config.interactions.includes('ctrl-click-move') ? 'Handles Ctrl+Click for quick-move between inventory/equipment' : ''}

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
- All public methods UFUNCTION(BlueprintCallable)`;
}
