/**
 * Builds the CLI prompt for a bestiary "remix" — authoring a variation of an
 * existing archetype from a natural-language instruction (ECW Phase 10-B,
 * ideas 7d150641 describe-a-boss + acca239f NL enemy AI). Pure so it's unit-
 * testable; the facet dispatches the result via useModuleCLI.
 */
export function buildRemixPrompt(entityName: string, catalogId: string, instruction: string): string {
  return (
    `Author a variation of the ${catalogId} entity "${entityName}" based on this design instruction:\n\n` +
    `"${instruction.trim()}"\n\n` +
    `Subclass AARPGEnemyCharacter (Blueprint under /Game/Enemies/) and reuse existing PoF systems — ` +
    `grant abilities via the GAS DefaultAbilities array, wire AI through the existing behavior tree, ` +
    `and set stats/loot on the placed instance (not the CDO). Report the new Blueprint's content path ` +
    `and the abilities/stats you changed relative to "${entityName}".`
  );
}
