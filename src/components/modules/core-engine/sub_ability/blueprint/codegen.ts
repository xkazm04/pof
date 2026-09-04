/**
 * C++ code generation functions for the GAS Blueprint Editor.
 *
 * Re-exports the canonical generators from @/lib/gas-codegen and adds
 * the effect generator that lives only in the editor.
 *
 * FIDELITY (ai-registry `game-production/visual-script-to-code-transpilation`,
 * "the fidelity ladder"): what this module returns is a PREVIEW — a rendering
 * of the design at the *parsed* rung. Nothing here touches disk. The code that
 * really lands in the UE project is written by the `generate-gas-effects`
 * agent under the contract in `src/lib/ability/effect-codegen-prompt.ts`, and
 * only that run's `CodegenReport` can claim a higher rung.
 *
 * The preview used to emit `U<EffectName>::U<EffectName>()` with modifiers as
 * comments — a class name that exists nowhere, so a designer grepping the
 * project found nothing. The naming rule below is the single place the
 * generated identity is spelled, and
 * `src/__tests__/components/core-engine/gas-codegen-preview.test.tsx` asserts
 * it against the literal patterns in the (read-only) contract prompt, so the
 * two cannot drift apart silently.
 */

export {
  generateAttributeSetHeader,
  generateTagsHeader,
} from '@/lib/gas-codegen';
import type { EditorEffect } from '@/lib/gas-codegen';

// ── Generated identity — the single source of truth ──────────────────────────

/** Class-name template the generator contract mandates. */
export const GENERATED_EFFECT_CLASS_PATTERN = 'UGE_Gen_<AbilityName>_<EffectName>';
/** File-stem template (the `.h`/`.cpp` pair) the generator contract mandates. */
export const GENERATED_EFFECT_FILE_PATTERN = 'GE_Gen_<AbilityName>_<EffectName>';
/** Project-relative folder the generated effects are written into. */
export const GENERATED_EFFECTS_DIR = 'Source/PoF/AbilitySystem/Effects/Generated/';
/** Placeholder used when no ability is bound — never a name the generator emits. */
export const UNBOUND_ABILITY_NAME = 'Ability';

/** Reduce a display name to a C++ identifier fragment ("both parts sanitized"). */
export function sanitizeIdentifier(raw: string): string {
  const stripped = raw.replace(/[^A-Za-z0-9_]/g, '');
  if (!stripped) return '';
  return /^[0-9]/.test(stripped) ? `_${stripped}` : stripped;
}

/** `UGE_Gen_<AbilityName>_<EffectName>` — the class the generator writes. */
export function generatedEffectClassName(abilityName: string, effectName: string): string {
  const a = sanitizeIdentifier(abilityName) || UNBOUND_ABILITY_NAME;
  const e = sanitizeIdentifier(effectName) || 'Effect';
  return `UGE_Gen_${a}_${e}`;
}

/** `GE_Gen_<AbilityName>_<EffectName>` — the `.h`/`.cpp` stem for that class. */
export function generatedEffectFileStem(abilityName: string, effectName: string): string {
  return generatedEffectClassName(abilityName, effectName).replace(/^U/, '');
}

// ── Effect preview ───────────────────────────────────────────────────────────

const DURATION_POLICY: Record<EditorEffect['duration'], string> = {
  instant: 'Instant',
  duration: 'HasDuration',
  infinite: 'Infinite',
};

/**
 * Render the GameplayEffect constructors the generator would write for the
 * current design.
 *
 * @param abilityName the bound ability's display name — it is part of the
 *   generated class identity, so without it the preview cannot name a real
 *   class and says so.
 */
export function generateEffectsCode(effects: EditorEffect[], abilityName?: string): string {
  const bound = abilityName ? sanitizeIdentifier(abilityName) : '';
  const lines: string[] = [
    '// PREVIEW — this is what the "Generate GAS effects" run would write into',
    `// ${GENERATED_EFFECTS_DIR}. It is NOT read from disk and no file exists`,
    '// until a generate run reports back. Rung: parsed (design rendered as code).',
    '',
  ];
  if (!bound) {
    lines.push(
      `// No ability is bound, so the class names below use the "${UNBOUND_ABILITY_NAME}"`,
      `// placeholder. The generator names each class ${GENERATED_EFFECT_CLASS_PATTERN}.`,
      '',
    );
  }

  for (const eff of effects) {
    const cls = generatedEffectClassName(bound || UNBOUND_ABILITY_NAME, eff.name);
    lines.push(`// ── ${eff.name} → ${GENERATED_EFFECTS_DIR}${generatedEffectFileStem(bound || UNBOUND_ABILITY_NAME, eff.name)}.cpp ──`);
    lines.push(`${cls}::${cls}()`);
    lines.push('{');
    lines.push(`    DurationPolicy = EGameplayEffectDurationType::${DURATION_POLICY[eff.duration]};`);
    if (eff.duration === 'duration') {
      lines.push(`    DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(${eff.durationSec.toFixed(1)}f));`);
    }

    // Modifiers are real FGameplayModifierInfo wiring — the shape the contract
    // demands — not the comment list the old preview showed.
    for (const m of eff.modifiers) {
      const attr = sanitizeIdentifier(m.attribute) || 'Unknown';
      const op = m.operation === 'add' ? 'Additive' : 'Multiplicitive';
      lines.push('');
      lines.push('    {');
      lines.push('        FGameplayModifierInfo Mod;');
      lines.push(`        Mod.Attribute = UARPGAttributeSet::Get${attr}Attribute();`);
      lines.push(`        Mod.ModifierOp = EGameplayModOp::${op};`);
      lines.push(`        Mod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(${m.magnitude}f));`);
      lines.push('        Modifiers.Add(Mod);');
      lines.push('    }');
    }

    // Granted tags use the UE 5.7 component idiom the contract pins.
    if (eff.grantedTags.length > 0) {
      lines.push('');
      lines.push('    UTargetTagsGameplayEffectComponent& TagsComponent =');
      lines.push('        AddComponent<UTargetTagsGameplayEffectComponent>();');
      lines.push('    FInheritedTagContainer TagChanges;');
      for (const tag of eff.grantedTags) {
        lines.push(`    TagChanges.Added.AddTag(FGameplayTag::RequestGameplayTag(FName("${tag}"), /*ErrorIfNotFound*/ false));`);
      }
      lines.push('    TagsComponent.SetAndApplyTargetTagChanges(TagChanges);');
    }

    // cooldownSec is the ABILITY cooldown (the editor's "Cooldown" field) —
    // emitting it as Period would turn the effect into a repeating DoT tick.
    if (eff.cooldownSec > 0) {
      lines.push('');
      lines.push(`    // Ability cooldown ${eff.cooldownSec.toFixed(1)}s: written as a separate Cooldown GE`);
      lines.push(`    // (HasDuration, DurationMagnitude = ${eff.cooldownSec.toFixed(1)}f) referenced from the ability's CooldownGameplayEffectClass.`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
