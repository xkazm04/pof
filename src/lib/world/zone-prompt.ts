/**
 * Builds the CLI prompt for authoring/retuning a world zone from a natural-
 * language instruction (ECW Phase 10-F — zone-map authoring ideas). Pure so it's
 * unit-testable; the ZoneAuthorFacet dispatches the result via useModuleCLI.
 * Reuse the existing world/level-streaming setup, never invent one.
 */
export function buildZonePrompt(zoneName: string, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `Author or retune the world zone "${zoneName}" in the UE5 PoF project.`,
    '',
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent given — produce a coherent zone for its place in the world graph.',
    '',
    'Requirements:',
    '- Reuse the existing world/level-streaming setup (World Partition / streaming levels + the zone DataTable); do not invent a new world system.',
    '- Keep the zone graph consistent: update connections, level range, and gating (locked/active/completed) so progression stays continuous (no orphan zones or difficulty spikes).',
    '- Place encounters via the existing spawn/encounter system, referencing bestiary archetypes by their existing classes.',
    '- Keep zone metadata data-driven (DataTable/config), not hard-coded.',
    `- Report the level/asset paths and summarise the connections + level range you set for ${zoneName}.`,
  ].join('\n');
}
