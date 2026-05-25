/**
 * Builds the CLI prompt for authoring/retuning a loot table from a natural-
 * language instruction (ECW Phase 10-L). Pure so it's unit-testable; the
 * LootAuthorFacet dispatches the result via useModuleCLI. Mirrors the bestiary
 * remix-prompt: reuse the existing loot system, never invent a new one.
 */
export function buildLootPrompt(tableName: string, archetypeName: string, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `Author or retune the loot table "${tableName}" (dropped by ${archetypeName}) in the UE5 PoF project.`,
    '',
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent given — produce a sensible table for this enemy tier.',
    '',
    'Requirements:',
    '- Populate a UARPGLootTable asset with FLootEntry rows (Item, DropWeight, Min/MaxQuantity, Min/MaxRarity); do not invent a new loot system.',
    '- Draw items from the existing item pool / DataTables; do not create placeholder item classes.',
    '- Keep the rarity-weight distribution consistent with the enemy tier (minions skew Common, bosses skew Epic/Legendary).',
    '- Set the table on the binding/config (data-driven), not hard-coded in C++ where the project is already data-driven.',
    `- Report the asset path and summarise the entries + rarity weights you set for ${tableName}.`,
  ].join('\n');
}
