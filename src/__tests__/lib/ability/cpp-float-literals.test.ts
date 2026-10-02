import { describe, it, expect } from 'vitest';
import { generateEffectsCode } from '@/components/modules/core-engine/sub_ability/blueprint/codegen';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import { GAS_TEMPLATES } from '@/components/modules/core-engine/sub_ability/blueprint/template-presets';

// `6f` / `-30f` is not a C++ floating literal (an integer literal with an invalid
// `f` suffix) — MSVC and clang both reject it. Integer magnitudes and cooldowns
// must be emitted as `6.f` / `-30.f` (cppFloat, src/lib/genome/codegen.ts).
const BAD_LITERAL = /FScalableFloat\(-?\d+f\)/;

describe('ability GE code and prompts emit valid C++ float literals', () => {
  it('an integer modifier magnitude renders as N.f in the effect preview', () => {
    const dot = GAS_TEMPLATES.find((t) => t.id === 'damage-over-time')!;
    const effects = dot.effects.map((e) => ({ ...e, modifiers: e.modifiers.map((m) => ({ ...m, magnitude: -30 })) }));
    const code = generateEffectsCode(effects, 'Fire Ball');
    expect(code).toContain('FScalableFloat(-30.f)');
    expect(code).not.toMatch(BAD_LITERAL);
  });

  it('an integer cooldown renders as N.f in the generate-bundle prompt', () => {
    const ref = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'basic' };
    const dot = GAS_TEMPLATES.find((t) => t.id === 'damage-over-time')!;
    const prompt = buildGenerateAbilityBundlePrompt(ref, dot.effects, [], { cooldown: 6 });
    expect(prompt).toContain('FScalableFloat(6.f)');
    expect(prompt).not.toMatch(BAD_LITERAL);
  });
});
