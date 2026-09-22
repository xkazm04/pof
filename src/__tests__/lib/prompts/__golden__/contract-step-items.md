# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)

## Required fields (graded — use these exact keys)
- `baseType`: an object with keys `slot`, `rarity`, `ilvl`, `requiredLevel`, `implicit`
- `baseType.wiringContract` (only if you declare it): an object { grantedBy: string, activatedBy: string, dependencies: string[] (a JSON ARRAY of strings, may be empty), verification: string naming its L0–L4 tier }

## Wiring contract — Base Type & Rarity · baseType
- **Granted by**: UARPGInventoryComponent equips THIS item and activates the GameplayEffect bundle its base definition declares
- **Activated by**: the item is assigned to its declared equipment slot in UARPGInventoryComponent
- **Dependencies**: UARPGAttributeSet (the stat targets THIS item modifies), UARPGItemDefinition (schema), DT_Items row "AshenBlade"
- **Verification**: L2: UARPGItemDefinition compiles and DA_AshenBlade is seeded; L3: VSItemsDefinitionsTest — DA_AshenBlade loads and its base-type fields match THIS item’s declaration

Write these four wiring fields on the artifact you write (`wiringContract`) for THIS entity: the contract above says what each must name — where it says "each" or "<id>", list this entity's own, never another's. The L2 checker rejects a placeholder ("TBD"/"TODO"/"n/a"), any claim under 12 characters, and a `verification` line that names no acceptance tier (L0–L4). Name the REAL registration + trigger site.