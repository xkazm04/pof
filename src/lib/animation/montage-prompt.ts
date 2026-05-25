/**
 * Builds the CLI prompt for authoring/retuning an animation montage from a
 * natural-language instruction (ECW Phase 10-F — state-graph authoring ideas).
 * Pure so it's unit-testable; the MontageAuthorFacet dispatches the result via
 * useModuleCLI. Reuse the existing AnimBP/montage pipeline, never invent one.
 */
export function buildMontagePrompt(montageName: string, category: string, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `Author or retune the ${category} montage "${montageName}" in the UE5 PoF project.`,
    '',
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent given — produce a clean montage for its category.',
    '',
    'Requirements:',
    '- Work within the existing AnimBP / montage pipeline (montage sections + notifies + slot setup); do not invent a new animation system.',
    '- Preserve root motion where the category needs it (attacks/locomotion drive movement from the montage, not code).',
    '- Keep memory in budget: reuse the skeleton, retarget rather than re-author, and apply keyframe reduction/compression consistent with same-category montages.',
    '- Keep blend-in/out times responsive for action montages.',
    `- Report the montage asset path and summarise the frames/fps/memory + blend settings you set for ${montageName}.`,
  ].join('\n');
}
