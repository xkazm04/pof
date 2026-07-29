import { describe, it, expect } from 'vitest';
import { forgedAbilityToSpec } from '@/lib/ability/forge-adopt';
import { computeTagAudit, specTagReferences } from '@/lib/ability/tag-audit';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

const forged: ForgedAbility = {
  className: 'GA_Fireball',
  displayName: 'Fireball',
  description: 'Hurl a ball of fire',
  headerCode: '// header',
  cppCode: '// cpp',
  tags: {
    abilityTag: 'Ability.Fire.Fireball',
    cooldownTag: 'Cooldown.Fireball',
    ownedTags: ['State.Casting'],
    blockedTags: ['State.Dead', 'State.Stunned', 'State.Silenced'],
  },
  stats: { baseDamage: 35, manaCost: 20, cooldownSec: 3, damageType: 'Fire' },
  comboEntry: { animDuration: 1.2, damageWindow: [0.3, 0.6], recovery: 0.3, comboMultiplier: 1.0 },
  radarValues: [0.7, 0.85, 0.3, 0.5, 0.5],
};

describe('forgedAbilityToSpec — pure mapper', () => {
  it('maps stats → a primary damage effect + a mana-cost effect', () => {
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forged, 'a fireball');
    expect(spec.catalogId).toBe('spellbook');
    expect(spec.entityId).toBe('off-fire-01');
    expect(spec.effects).toHaveLength(2);

    const primary = spec.effects[0];
    expect(primary.id).toBe('fireball-primary');
    expect(primary.name).toBe('GE_Fireball_Impact');
    expect(primary.cooldownSec).toBe(3);
    expect(primary.modifiers[0]).toMatchObject({ attribute: 'Health', operation: 'add', magnitude: -35 });
    expect(primary.grantedTags).toEqual(['State.Casting']);

    const mana = spec.effects[1];
    expect(mana.id).toBe('fireball-mana');
    expect(mana.modifiers[0]).toMatchObject({ attribute: 'Mana', magnitude: -20 });
  });

  it('maps each ActivationBlocked tag → a blocks rule sourced from the ability tag', () => {
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forged);
    expect(spec.tagRules).toHaveLength(3);
    expect(spec.tagRules.every((r) => r.type === 'blocks')).toBe(true);
    expect(spec.tagRules.every((r) => r.sourceTag === 'Ability.Fire.Fireball')).toBe(true);
    expect(spec.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned', 'State.Silenced']);
  });

  it('records forge provenance (className / C++ / prompt), never writing files', () => {
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forged, 'a fireball');
    expect(spec.provenance).toMatchObject({
      source: 'forge',
      className: 'GA_Fireball',
      displayName: 'Fireball',
      damageType: 'Fire',
      prompt: 'a fireball',
      headerCode: '// header',
      cppCode: '// cpp',
    });
  });

  it('omits the mana effect when manaCost is 0', () => {
    const free = { ...forged, stats: { ...forged.stats, manaCost: 0 } };
    const spec = forgedAbilityToSpec('spellbook', 'off-phy-01', free);
    expect(spec.effects).toHaveLength(1);
  });

  it('falls back to Dead/Stunned guards when blockedTags is empty', () => {
    const noBlocks = { ...forged, tags: { ...forged.tags, blockedTags: [] } };
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', noBlocks);
    expect(spec.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned']);
  });

  it('is pure — same input yields deeply equal output', () => {
    const a = forgedAbilityToSpec('spellbook', 'off-fire-01', forged, 'p');
    const b = forgedAbilityToSpec('spellbook', 'off-fire-01', forged, 'p');
    expect(a).toEqual(b);
  });
});

/* ── One tag dialect: the forge speaks C++, the spec must speak dotted ───── */

/** What the forge OUTPUT_SCHEMA actually asks for: C++ tag identifiers. */
const forgedCppDialect: ForgedAbility = {
  ...forged,
  tags: {
    abilityTag: 'Ability_Fire_Fireball',
    cooldownTag: 'Cooldown_Fireball',
    ownedTags: ['State_Casting'],
    blockedTags: ['State_Dead', 'State_Stunned'],
  },
};

describe('forgedAbilityToSpec — tag dialect normalization', () => {
  it('normalizes underscore C++ tag identifiers to dotted GameplayTags', () => {
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forgedCppDialect);
    expect(spec.effects[0].grantedTags).toEqual(['State.Casting']);
    expect(spec.tagRules.map((r) => r.sourceTag)).toEqual(['Ability.Fire.Fireball', 'Ability.Fire.Fireball']);
    expect(spec.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned']);
  });

  it('adopted forge tags MATCH the tags declared in UE5 source (audit reconciles)', () => {
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forgedCppDialect);
    // The dotted tag strings UE_DEFINE_GAMEPLAY_TAG_COMMENT declares.
    const declared = ['Ability.Fire.Fireball', 'State.Casting', 'State.Dead', 'State.Stunned'];

    const audit = computeTagAudit(declared, [], specTagReferences([spec]));

    expect(audit.undeclared).toEqual([]);
    expect(audit.orphaned).toEqual([]);
    expect(audit.matched).toEqual([...declared].sort());
    expect(audit.appReferenced).toEqual([...declared].sort());
    expect(audit.score).toBe(100);
  });

  it('WITHOUT normalization the same tags would all read as undeclared (the bug)', () => {
    const declared = ['Ability.Fire.Fireball', 'State.Casting', 'State.Dead', 'State.Stunned'];
    // Raw forge output, un-normalized — every tag misses its declaration.
    const raw = ['Ability_Fire_Fireball', 'State_Casting', 'State_Dead', 'State_Stunned'];
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', forgedCppDialect);
    // The mapper's output is dotted, so it cannot reproduce the raw spelling.
    expect(specTagReferences([spec]).some((t) => t.includes('_'))).toBe(false);
    expect(raw.every((t) => !declared.includes(t))).toBe(true);
  });

  it('mixed-dialect input is idempotent (already-dotted tags pass through)', () => {
    const mixed: ForgedAbility = {
      ...forged,
      tags: { ...forged.tags, abilityTag: 'Ability.Fire.Fireball', blockedTags: ['State_Dead', 'State.Stunned'] },
    };
    const spec = forgedAbilityToSpec('spellbook', 'off-fire-01', mixed);
    expect(spec.tagRules[0].sourceTag).toBe('Ability.Fire.Fireball');
    expect(spec.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned']);
  });
});
