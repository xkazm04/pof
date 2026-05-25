import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const POLICY: Record<EditorEffect['duration'], string> = {
  instant: 'Instant',
  duration: 'HasDuration',
  infinite: 'Infinite',
};

/** One human-readable bullet describing an effect for the authoring contract. */
function describeEffect(e: EditorEffect): string {
  const mods = e.modifiers.length
    ? e.modifiers.map((m) => `${m.attribute} ${m.operation === 'add' ? '+=' : '*='} ${m.magnitude}`).join(', ')
    : 'no attribute modifiers';
  const tags = e.grantedTags.length ? `; grants ${e.grantedTags.join(', ')}` : '';
  const dur = e.duration === 'duration' ? ` (${e.durationSec}s)` : '';
  const period = e.cooldownSec > 0 ? `; period ${e.cooldownSec}s` : '';
  return `- "${e.name}" — DurationPolicy ${POLICY[e.duration]}${dur}; modifiers: ${mods}${period}${tags}`;
}

/**
 * Build the authoring contract for the generate-gas-effects dispatch (B3a). Pure.
 * Tells Claude to write one buildable UGameplayEffect subclass per effect into the
 * UE project's additive Effects/Generated/ folder, following the project's bespoke
 * GE_* conventions, then build the PoF module and report. `tagRules` is passed only
 * so the tag-delta report covers the rules' tags too. No UE files are authored here
 * — this is the prompt the CLI dispatch hands to Claude.
 */
export function buildGenerateEffectsPrompt(ability: AbilityRef, effects: EditorEffect[], tagRules: TagRule[]): string {
  const effectList = effects.length
    ? effects.map(describeEffect).join('\n')
    : '- (none authored yet — report that there is nothing to generate and stop)';
  const ruleTags = [...new Set(tagRules.flatMap((r) => [r.sourceTag, r.targetTag]))].filter(Boolean);
  const ruleTagNote = ruleTags.length
    ? `\nActivation rules reference these tags (include them in the tag-delta report if undeclared): ${ruleTags.join(', ')}.`
    : '';

  return [
    `Generate GameplayEffect C++ classes for the ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}) from its authored effects.`,
    '',
    'Effects to generate:',
    effectList,
    ruleTagNote,
    '',
    '## Contract',
    '1. READ FIRST for the project idiom — do NOT invent a new system:',
    '   - `Source/PoF/AbilitySystem/Effects/GE_Heal.h` and `.cpp` (and one more `GE_*`) for the UGameplayEffect constructor pattern;',
    '   - `Source/PoF/AbilitySystem/ARPGAttributeSet.h` for the real attribute names (Health, MaxHealth, Mana, Strength, Armor, AttackPower, …);',
    '   - `Source/PoF/AbilitySystem/ARPGGameplayTags.h` for the natively-declared gameplay tags.',
    '2. Write ONE `UGameplayEffect` subclass per effect into `Source/PoF/AbilitySystem/Effects/Generated/` (create the folder if absent). Name each `UGE_Gen_<AbilityName>_<EffectName>` with both parts sanitized to a valid C++ identifier. This folder is ADDITIVE — never edit or overwrite any hand-written `GE_*`.',
    '3. In each constructor: set `DurationPolicy` (Instant / HasDuration / Infinite) per the effect; for HasDuration set `DurationMagnitude = FScalableFloat(durationSec)`; if a period was given, set `Period = FScalableFloat(periodSec)` and add a comment that ability cooldown is a separate cooldown-GE concern. For each modifier add an `FGameplayModifierInfo` targeting `UARPGAttributeSet::Get<Attr>Attribute()` with `EGameplayModOp::Additive` (for `+=`) or `Multiplicitive` (for `*=`) and `FScalableFloat(magnitude)`. If an attribute name is not real, still emit it but mark it `// TODO: unknown attribute` rather than guessing.',
    '4. Granted tags → the effect\'s owned-tags container via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` so the class compiles even if the tag is not yet registered.',
    '5. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the files created, the attribute mapping, and the TAG DELTA — every granted/rule tag NOT already declared in `ARPGGameplayTags.h`. Do NOT auto-edit the hand-written tags header.',
    '6. Build the PoF module (per the build command above; regenerate project files if a new `.cpp` requires it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '7. Report: the files written, the attributes mapped, and any missing tags from the delta.',
  ].join('\n');
}
