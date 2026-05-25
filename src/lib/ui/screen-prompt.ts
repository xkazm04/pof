/**
 * Builds the CLI prompt for authoring a screen / flow node from a natural-
 * language instruction (ECW Phase 10-F — screen-flow ideas c9dd5463 branching
 * dialogue / 79afa857 game-master quests). Pure so it's unit-testable; the
 * ScreenAuthorFacet dispatches the result via useModuleCLI. Reuse the existing
 * UMG + flow-graph setup, never invent one.
 */
export function buildScreenPrompt(screenName: string, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `Author or extend the screen / UI flow node "${screenName}" in the UE5 PoF project.`,
    '',
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent given — produce a coherent screen for its place in the UI flow.',
    '',
    'Requirements:',
    '- Build the screen as a UMG UserWidget and wire it into the existing UI flow/state manager; do not invent a new UI navigation system.',
    '- For branching dialogue/quests, drive choices and transitions data-driven (DataTable/flow graph), not hard-coded widget logic.',
    '- Keep navigation edges consistent: every reachable screen has a way back, and new nodes connect to the existing flow graph.',
    '- Reuse existing UI styles/components and the project HUD class.',
    `- Report the widget/asset paths and summarise the flow edges you added for ${screenName}.`,
  ].join('\n');
}
