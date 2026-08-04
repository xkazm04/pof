# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)

## Wiring contract — Base Type & Rarity · baseType
- **Granted by**: UARPGInventoryComponent equips the item and activates the equip GE bundle
- **Activated by**: On-equip (slot assignment in UARPGInventoryComponent)
- **Dependencies**: UARPGAttributeSet (stat targets), UARPGItemDefinition (schema), DT_Items (data row)
- **Verification**: L2: cppSymbolExists(UARPGItemDefinition) + seedRowPresent(author_items.py, DA_AshenBlade); L3: VSItemsDefinitionsTest — DA loaded + requiredLevel/slot/rarity fields assert correct

Reproduce these four wiring fields on the artifact you write (`wiringContract`). The L2 checker rejects a placeholder ("TBD"/"TODO"/"n/a"), any claim under 12 characters, and a `verification` line that names no acceptance tier (L0–L4). Name the REAL registration + trigger site.