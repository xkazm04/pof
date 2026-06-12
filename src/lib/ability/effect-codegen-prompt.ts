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
  // cooldownSec is the ABILITY cooldown (the editor's "Cooldown" field) — say
  // so explicitly, or the model emits it as a GE Period and the effect's
  // damage silently re-applies every N seconds as a DoT tick.
  const cooldown = e.cooldownSec > 0 ? `; ability cooldown ${e.cooldownSec}s (NOT a GE Period — see the cooldown GE rule)` : '';
  return `- "${e.name}" — DurationPolicy ${POLICY[e.duration]}${dur}; modifiers: ${mods}${cooldown}${tags}`;
}

const RULE_TARGET: Record<TagRule['type'], string> = {
  blocks: 'ActivationBlockedTags',
  requires: 'ActivationRequiredTags',
  cancels: 'CancelAbilitiesWithTag',
};

/** One bullet describing how a tag rule maps onto the generated ability. */
function describeRule(r: TagRule): string {
  return `- ${r.type} "${r.targetTag}" → ${RULE_TARGET[r.type]}`;
}

/**
 * Build the authoring contract for the "Generate C++" bundle dispatch (B3a + B3b).
 * Pure. Instructs Claude to write, additively into the UE project: (A) one buildable
 * UGameplayEffect subclass per effect (Effects/Generated/), and (B) a UARPGGameplayAbility
 * subclass (Abilities/Generated/) that applies those effects and carries the activation
 * tag rules — then (C) build the PoF module and report. The GE idiom matches what the
 * B3a UE proof confirmed compiles. No UE files are authored here.
 */
export function buildGenerateAbilityBundlePrompt(
  ability: AbilityRef,
  effects: EditorEffect[],
  tagRules: TagRule[],
  scalars?: { manaCost?: number; cooldown?: number; damage?: number },
): string {
  const effectList = effects.length
    ? effects.map(describeEffect).join('\n')
    : '- (none authored yet — report that there is nothing to generate and stop)';
  const ruleList = tagRules.length ? tagRules.map(describeRule).join('\n') : '- (no activation rules)';
  const manaNote = scalars?.manaCost != null
    ? `Set \`AbilityManaCost = ${scalars.manaCost}\`.`
    : 'No mana cost provided — leave a `// TODO: mana cost` comment.';
  // The authoritative ability cooldown: the catalog scalar when provided, else
  // the largest effect-level "Cooldown" the editor authored. Previously this
  // was accepted and dropped ('// TODO: cooldown GE') while the same value
  // leaked into the effects as a Period.
  const cooldownSec = scalars?.cooldown ?? Math.max(0, ...effects.map((e) => e.cooldownSec));
  const cooldownNote = cooldownSec > 0
    ? `Create a Cooldown GE \`UGE_Gen_<AbilityName>_Cooldown\` (HasDuration, \`DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(${cooldownSec}f))\`, granting the ability's cooldown tag) in \`Effects/Generated/\` and set it as the ability's \`CooldownGameplayEffectClass\`. Do NOT set \`Period\` on any damaging GE for this.`
    : 'No cooldown provided — leave a `// TODO: cooldown GE` comment.';
  // Faithfulness guard: the catalog entity's `damage` is authoritative. Pin the
  // primary damaging effect to it so the generated asset can't drift from the
  // entity (e.g. via stale spec edits) — the discrepancy that bit the B3 proof.
  const damageNote = scalars?.damage != null
    ? `\nCanonical damage (authoritative, from the catalog entity): **${scalars.damage}**. The primary damaging effect's Health modifier MUST equal \`-${scalars.damage}\`; reconcile any spec drift to this value.`
    : '';

  return [
    `Generate the C++ bundle for the ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}): its GameplayEffects AND the ability that applies them.`,
    damageNote,
    '',
    'Effects to generate:',
    effectList,
    '',
    'Activation tag rules to wire onto the ability:',
    ruleList,
    '',
    '## Contract — Part A: GameplayEffects',
    '1. READ FIRST for the project idiom — do NOT invent a new system:',
    '   - `Source/PoF/AbilitySystem/Effects/GE_Heal.cpp` (instant additive), `GE_Regen_Health.cpp` (periodic duration), `GE_Stun.cpp` (granted tags) for the UGameplayEffect constructor patterns;',
    '   - `Source/PoF/AbilitySystem/ARPGAttributeSet.h` for the real attributes and their `Get<Attr>Attribute()` accessors;',
    '   - `Source/PoF/AbilitySystem/ARPGGameplayTags.h` for the natively-declared tags.',
    '2. Write ONE `UGameplayEffect` subclass per effect into `Source/PoF/AbilitySystem/Effects/Generated/`. Name each `UGE_Gen_<AbilityName>_<EffectName>` (file `GE_Gen_<AbilityName>_<EffectName>.{h,cpp}`, both parts sanitized; include bare `GE_Gen_<…>.generated.h`). Additive — never edit hand-written `GE_*`.',
    '3. Constructor: `DurationPolicy = EGameplayEffectDurationType::{Instant|HasDuration|Infinite}`; for HasDuration `DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)` (set `.Value`); for a period set `Period.Value =` and `bExecutePeriodicEffectOnApplication = false` (DoT tick, NOT ability cooldown). Each modifier → `FGameplayModifierInfo` with `.Attribute = UARPGAttributeSet::Get<Attr>Attribute()`, `.ModifierOp = EGameplayModOp::Additive` (`+=`) or `Multiplicitive` (`*=`), `.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)`; then `Modifiers.Add(...)`. Unknown attribute → `// TODO: unknown attribute` comment.',
    '4. Granted tags (UE 5.7 component idiom — see `GE_Stun.cpp`): create a `UTargetTagsGameplayEffectComponent`, add it to `GEComponents`, and `SetAndApplyTargetTagChanges` an `FInheritedTagContainer`. Declared tags via native refs `ARPGGameplayTags::<Tag>`; an UNdeclared tag via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` guarded by `IsValid()` (skip if invalid) and record it in the tag delta.',
    '',
    '## Contract — Part B: the wiring ability',
    '5. READ `Source/PoF/AbilitySystem/ARPGGameplayAbility.h` (base: `ApplyEffectToSelf`/`ApplyEffectToTarget`, `bAutoEndAbility`, `AbilityManaCost`) and `Source/PoF/AbilitySystem/GA_WarCry.cpp` (the commit → apply-GE → end idiom).',
    '6. Write ONE `UARPGGameplayAbility` subclass `UGA_Gen_<AbilityName>` (file `GA_Gen_<AbilityName>.{h,cpp}`) into `Source/PoF/AbilitySystem/Abilities/Generated/` (create the folder; additive — never touch hand-written `GA_*`).',
    `7. Constructor: ${manaNote} Set \`bAutoEndAbility = true\`. Wire the activation tag rules above — \`blocks\`→\`ActivationBlockedTags\`, \`requires\`→\`ActivationRequiredTags\`, \`cancels\`→\`CancelAbilitiesWithTag\` — using native refs \`ARPGGameplayTags::<Tag>\` for declared tags and the guarded \`RequestGameplayTag(...,false)\`+\`IsValid()\` pattern for undeclared ones (record those in the tag delta). ${cooldownNote}`,
    '8. `ActivateAbility`: `CommitAbility` (on failure `EndAbility(Handle, ActorInfo, ActivationInfo, true, true)` and return); then apply each generated GE — DAMAGING effects (a modifier reducing Health) via `ApplyEffectToTarget(TargetASC, UGE_Gen_<AbilityName>_<EffectName>::StaticClass())`, BUFFS/HEALS via `ApplyEffectToSelf(...)`; if ambiguous default to target and comment. Finish with `EndAbility(Handle, ActorInfo, ActivationInfo, true, false)`.',
    '',
    '## Contract — Part C: report + build',
    '9. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the GE + ability files, the attribute mapping, the tag→ActivationTags wiring, and the TAG DELTA — every granted/rule tag NOT declared in `ARPGGameplayTags.h` (do NOT auto-edit the tags header).',
    '10. Build the PoF module (per the build command above; regenerate project files if new `.cpp` files require it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '11. Report: files written, attributes mapped, activation tags wired, and any missing tags.',
    '',
    '## Contract — Part D: register in the data-driven catalog',
    '12. Merge `Source/PoF/AbilitySystem/Effects/Generated/manifest.json` (create with `{ "abilities": [] }` if absent): upsert THIS ability keyed by `name` — `{ "name": "<AbilityName>", "gameplayTag": "<ability tag>", "abilityClass": "/Script/PoF.GA_Gen_<AbilityName>", "effectClasses": ["/Script/PoF.GE_Gen_<AbilityName>_<EffectName>", …] }`. Preserve any other abilities already in the file.',
    '13. After the build succeeds, run `Content/Python/seed_generated_abilities.py` via the FULL editor headless — `& "<UnrealEditor-Cmd.exe>" "<the .uproject>" -run=pythonscript -script="<abs path to the script>" -unattended -nopause -abslog="<a log path>"`. It reads the manifest and writes `/Game/Abilities/Generated/DT_GeneratedAbilities`. Judge success by the log line `[seed_generated_abilities] Saved … N rows` (ignore a non-zero exit from the benign shutdown crash).',
    '14. Report the manifest entry written and the row count the seeder saved.',
  ].join('\n');
}
