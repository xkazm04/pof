/**
 * Elite-modifier GameplayEffect codegen names real UE symbols (scan-sweep
 * --challenge, card bestiary-archetypes-ai/A).
 *
 * The GE body used to spell accessors from three attribute-set classes that do
 * not exist (UHealthAttributeSet/UCombatAttributeSet/UMovementAttributeSet) and
 * an EGameplayModOp enumerator UE does not have (`Multiply`). Canon rule
 * proj-sot: attributes come from UARPGAttributeSet. Every accessor emitted here
 * must name a field of the committed FARPGAttributeInitRow schema; an axis with
 * no such attribute renders the generator contract's TODO comment instead.
 *
 * The modifier block is rendered by the one helper the GAS editor preview also
 * uses, so the sub_ability preview output is pinned byte-for-byte below.
 */
import { describe, it, expect } from 'vitest';
import {
  ELITE_MODIFIERS,
  generateModifierGE,
  type EliteModifier,
} from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { generateEffectsCode } from '@/components/modules/core-engine/sub_ability/blueprint/codegen';
import type { EditorEffect } from '@/lib/gas-codegen';
import ueSchema from '@/lib/catalog/ue-schema.generated.json';

const ATTRIBUTE_ROW: readonly string[] = (ueSchema as Record<string, string[]>).FARPGAttributeInitRow;

const mod = (id: string): EliteModifier => {
  const m = ELITE_MODIFIERS.find((x) => x.id === id);
  if (!m) throw new Error(`no elite modifier ${id}`);
  return m;
};

describe('generateModifierGE — every elite GE names real UE symbols', () => {
  it('has 8 elite modifiers to render', () => {
    expect(ATTRIBUTE_ROW.length).toBeGreaterThan(0);
    expect(ELITE_MODIFIERS).toHaveLength(8);
  });

  it('spells accessors from UARPGAttributeSet, never an invented set or EGameplayModOp::Multiply', () => {
    for (const m of ELITE_MODIFIERS) {
      const code = generateModifierGE(m);
      expect(code, m.id).toContain('UARPGAttributeSet::Get');
      expect(code, m.id).not.toContain('EGameplayModOp::Multiply;');
      expect(code, m.id).not.toMatch(/U(Health|Combat|Movement)AttributeSet/);
    }
  });

  it('every UARPGAttributeSet::Get<X>Attribute across the 8 GEs has X in FARPGAttributeInitRow', () => {
    const emitted = new Set<string>();
    for (const m of ELITE_MODIFIERS) {
      for (const hit of generateModifierGE(m).matchAll(/UARPGAttributeSet::Get(\w+)Attribute\(\)/g)) {
        emitted.add(hit[1]);
      }
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const attr of emitted) expect(ATTRIBUTE_ROW, attr).toContain(attr);
  });

  it('renders Enraged\'s +50% Damage as a Multiplicitive AttackPower modifier with a wrapped magnitude', () => {
    const code = generateModifierGE(mod('enraged'));
    expect(code).toContain('UARPGAttributeSet::GetAttackPowerAttribute()');
    expect(code).toContain('EGameplayModOp::Multiplicitive');
    expect(code).toContain('FGameplayEffectModifierMagnitude(FScalableFloat(1.5f))');
  });
});

describe('an axis with no UE attribute is a TODO, not an invented accessor', () => {
  it('renders Arcane\'s Range statMod as the contract\'s TODO comment', () => {
    const code = generateModifierGE(mod('arcane'));
    expect(code).toMatch(/\/\/ TODO: unknown attribute.*Range/);
    expect(code).not.toMatch(/Get\w*RangeAttribute/);
    expect(code).not.toContain('Custom');
  });
});

// ── [guard] the sub_ability preview is byte-identical after the extraction ──

const fixtureEffects: EditorEffect[] = [
  { id: 'e1', name: 'Burn', duration: 'duration', durationSec: 4, cooldownSec: 0, color: 'x',
    modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -30 }, { attribute: 'Armor', operation: 'multiply', magnitude: 0.75 }],
    grantedTags: ['State.Burning'] },
  { id: 'e2', name: 'War Cry', duration: 'infinite', durationSec: 0, cooldownSec: 12, color: 'x',
    modifiers: [{ attribute: 'Attack Power!', operation: 'multiply', magnitude: 1.5 }, { attribute: '***', operation: 'add', magnitude: 2 }],
    grantedTags: [] },
  { id: 'e3', name: 'Heal', duration: 'instant', durationSec: 0, cooldownSec: 0, color: 'x', modifiers: [], grantedTags: [] },
];

/** Captured from generateEffectsCode at 3e199895, before renderModifierInfo existed. */
const EXPECTED_PREVIEW = [
  '// PREVIEW — this is what the "Generate GAS effects" run would write into',
  '// Source/PoF/AbilitySystem/Effects/Generated/. It is NOT read from disk and no file exists',
  '// until a generate run reports back. Rung: parsed (design rendered as code).',
  '',
  '// ── Burn → Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_FireBall_Burn.cpp ──',
  'UGE_Gen_FireBall_Burn::UGE_Gen_FireBall_Burn()',
  '{',
  '    DurationPolicy = EGameplayEffectDurationType::HasDuration;',
  '    DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(4.0f));',
  '',
  '    {',
  '        FGameplayModifierInfo Mod;',
  '        Mod.Attribute = UARPGAttributeSet::GetHealthAttribute();',
  '        Mod.ModifierOp = EGameplayModOp::Additive;',
  '        Mod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(-30.f));',
  '        Modifiers.Add(Mod);',
  '    }',
  '',
  '    {',
  '        FGameplayModifierInfo Mod;',
  '        Mod.Attribute = UARPGAttributeSet::GetArmorAttribute();',
  '        Mod.ModifierOp = EGameplayModOp::Multiplicitive;',
  '        Mod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(0.75f));',
  '        Modifiers.Add(Mod);',
  '    }',
  '',
  '    UTargetTagsGameplayEffectComponent& TagsComponent =',
  '        AddComponent<UTargetTagsGameplayEffectComponent>();',
  '    FInheritedTagContainer TagChanges;',
  '    TagChanges.Added.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Burning"), /*ErrorIfNotFound*/ false));',
  '    TagsComponent.SetAndApplyTargetTagChanges(TagChanges);',
  '}',
  '',
  '// ── War Cry → Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_FireBall_WarCry.cpp ──',
  'UGE_Gen_FireBall_WarCry::UGE_Gen_FireBall_WarCry()',
  '{',
  '    DurationPolicy = EGameplayEffectDurationType::Infinite;',
  '',
  '    {',
  '        FGameplayModifierInfo Mod;',
  '        Mod.Attribute = UARPGAttributeSet::GetAttackPowerAttribute();',
  '        Mod.ModifierOp = EGameplayModOp::Multiplicitive;',
  '        Mod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(1.5f));',
  '        Modifiers.Add(Mod);',
  '    }',
  '',
  '    {',
  '        FGameplayModifierInfo Mod;',
  '        Mod.Attribute = UARPGAttributeSet::GetUnknownAttribute();',
  '        Mod.ModifierOp = EGameplayModOp::Additive;',
  '        Mod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(2.f));',
  '        Modifiers.Add(Mod);',
  '    }',
  '',
  '    // Ability cooldown 12.0s: written as a separate Cooldown GE',
  "    // (HasDuration, DurationMagnitude = 12.0f) referenced from the ability's CooldownGameplayEffectClass.",
  '}',
  '',
  '// ── Heal → Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_FireBall_Heal.cpp ──',
  'UGE_Gen_FireBall_Heal::UGE_Gen_FireBall_Heal()',
  '{',
  '    DurationPolicy = EGameplayEffectDurationType::Instant;',
  '}',
  '',
].join('\n');

describe('[guard] sub_ability GAS preview', () => {
  it('generateEffectsCode(fixtureEffects, \'Fire Ball\') is byte-identical to the pre-extraction output', () => {
    expect(generateEffectsCode(fixtureEffects, 'Fire Ball')).toBe(EXPECTED_PREVIEW);
  });
});
