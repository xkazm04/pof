/**
 * Builds the CLI prompt for authoring/retuning a combat combo from a natural-
 * language instruction (ECW Phase 10-C — ideas 5f579b32 NL encounter design /
 * c3d28b98 LLM combo choreographer). Pure so it's unit-testable; the
 * CombatChoreographerFacet dispatches the result via useModuleCLI. Reuse the
 * existing montage/GAS combo system, never invent one.
 */
export function buildComboPrompt(comboName: string, weaponCategory: string, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `Author or retune the ${weaponCategory} combo "${comboName}" in the UE5 PoF project.`,
    '',
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent given — produce a satisfying chain for this weapon class.',
    '',
    'Requirements:',
    '- Implement the chain via the existing AnimMontage combo windows (montage sections + combo-window notifies); do not invent a new combo system.',
    '- Drive activation through the existing GAS ability (gameplay-ability + montage play), reusing input-buffer/combo-counter logic already in the combat module.',
    '- Keep per-hit damage and cancel windows data-driven (DataTable/curve) where the project already does so.',
    '- Preserve weapon feel: cadence and total time should stay consistent with other ' + weaponCategory + ' combos unless the intent says otherwise.',
    `- Report the montage/ability asset paths and summarise the chain steps + timing you set for ${comboName}.`,
  ].join('\n');
}
