import { describe, it, expect } from 'vitest';
import {
  buildAbilityForgePrompt,
  type ForgedAbility,
} from '@/lib/prompts/ability-forge';
import { COMBO_ABILITIES, ABILITY_RADAR_DATA } from '@/components/modules/core-engine/sub_ability/_shared/AbilitySpellbook.data';
import type { ProjectContext } from '@/lib/prompt-context';

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.5.4',
};

const PRIOR: ForgedAbility = {
  className: 'GA_FlameDash',
  displayName: 'Flame Dash',
  description: 'A dashing slash wreathed in fire.',
  headerCode: '// header\nUCLASS()\nclass UGA_FlameDash {};',
  cppCode: '// cpp\nUGA_FlameDash::UGA_FlameDash() { AbilityManaCost = 25.f; }',
  tags: {
    abilityTag: 'Ability_FlameDash',
    cooldownTag: 'Cooldown_FlameDash',
    ownedTags: ['State_Dashing'],
    blockedTags: ['State_Dead', 'State_Stunned'],
  },
  stats: { baseDamage: 40, manaCost: 25, cooldownSec: 8, damageType: 'Fire' },
  comboEntry: { animDuration: 0.8, damageWindow: [0.3, 0.5], recovery: 0.2, comboMultiplier: 1.2 },
  radarValues: [0.6, 0.5, 0.2, 0.7, 0.5],
};

describe('buildAbilityForgePrompt — one-shot mode', () => {
  it('embeds the description and the generation task framing', () => {
    const p = buildAbilityForgePrompt({
      ctx: CTX,
      description: 'A whirlwind spin dealing physical damage',
      comboAbilities: COMBO_ABILITIES,
      radarData: ABILITY_RADAR_DATA,
    });
    expect(p).toContain('A whirlwind spin dealing physical damage');
    expect(p).toMatch(/Generate a GameplayAbility Class/i);
    // The output schema + rules must always be present
    expect(p).toContain('"className"');
    expect(p).toMatch(/UARPGGameplayAbility/);
  });
});

describe('buildAbilityForgePrompt — refine mode', () => {
  const refined = buildAbilityForgePrompt({
    ctx: CTX,
    description: 'A dashing slash wreathed in fire',
    comboAbilities: COMBO_ABILITIES,
    radarData: ABILITY_RADAR_DATA,
    refine: { prior: PRIOR, instruction: 'make it AoE and cut mana cost 30%' },
  });

  it('frames the task as a refinement, not a fresh generation', () => {
    expect(refined).toMatch(/Refine an Existing Ability|Refine the Existing Ability|refinement/i);
  });

  it('includes the designer follow-up instruction verbatim', () => {
    expect(refined).toContain('make it AoE and cut mana cost 30%');
  });

  it('includes the prior ability as JSON context (className + a stat)', () => {
    expect(refined).toContain('GA_FlameDash');
    expect(refined).toContain('Ability_FlameDash');
    // The prior stats should be serialized so the model can apply a relative delta
    expect(refined).toMatch(/"manaCost":\s*25/);
  });

  it('instructs the model to preserve unrelated fields and return the same schema', () => {
    expect(refined).toMatch(/only change what the instruction|keep everything else|preserve/i);
    expect(refined).toContain('"className"'); // same output schema retained
  });

  it('still carries the shared GAS rules', () => {
    expect(refined).toMatch(/UARPGGameplayAbility/);
    expect(refined).toMatch(/State_Dead and State_Stunned/);
  });
});
