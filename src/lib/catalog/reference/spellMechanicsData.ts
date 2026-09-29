/** Pin-verified spell-cast failure and cross-spell hit rules; imports stay type-only. */
import type {
  SpellFizzleBranch,
  SpellFizzleRule,
  StoneCurseInteraction,
} from '@/lib/catalog/reference/spellMechanics';

const missile = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;
const spell = (lines: string): string => `.reference/devilutionX/Source/spells.cpp:${lines}`;

export const SPELL_FIZZLE_RULE_DATA = {
  rule: 'CastSpell skips ConsumeSpell when any initial AddMissile call returns null; otherwise it consumes the spell resource after all initial missiles are added.',
  refs: [spell('147-176'), spell('211-233'), missile('2806-2858')],
} as const satisfies SpellFizzleRule;

export const SPELL_FIZZLE_BRANCHES_DATA = [
  {
    spell: 'Teleport', failure: 'No legal destination exists within radius 5 of the clicked tile.',
    setsSpellFizzled: true, resource: 'free', refs: [missile('1931-1948')],
  },
  {
    spell: 'Guardian', failure: 'No unoccupied, missile-clear, line-clear placement exists within radius 5.',
    setsSpellFizzled: true, resource: 'free', refs: [missile('2188-2218')],
  },
  {
    spell: 'FireWall', failure: 'The controller finds no distinct, missile-clear, line-clear spread tile within radius 5.',
    setsSpellFizzled: true, resource: 'free', refs: [missile('2535-2546')],
  },
  {
    spell: 'StoneCurse', failure: 'No eligible monster exists within radius 5 of the target.',
    setsSpellFizzled: true, resource: 'free', refs: [missile('2363-2392')],
  },
  {
    spell: 'StoneCurse', failure: 'The selected eligible monster is already petrified; the effect does not stack.',
    setsSpellFizzled: false, resource: 'consumed', refs: [missile('2395-2403')],
  },
  {
    spell: 'ManaShield', failure: 'Mana Shield is already active.',
    setsSpellFizzled: true, resource: 'free', refs: [missile('2161-2169')],
  },
  {
    spell: 'Golem', failure: 'No unoccupied, line-clear summon tile exists within radius 5.',
    setsSpellFizzled: false, resource: 'consumed', refs: [missile('2418-2439')],
  },
  {
    spell: 'TownPortal', failure: 'No legal dungeon portal tile exists within radius 5.',
    setsSpellFizzled: false, resource: 'consumed', refs: [missile('2073-2109')],
  },
  {
    spell: 'Phasing', failure: 'No legal tile exists in the four outer corner regions around the caster.',
    setsSpellFizzled: false, resource: 'consumed', refs: [missile('1829-1865')],
  },
] as const satisfies readonly SpellFizzleBranch[];

export const STONE_CURSE_INTERACTION_DATA = {
  rule: 'For an eligible, nonimmune petrified monster, MonsterMHit forces the random hit roll to 0 after clamping spell to-hit to 5..95, so the check succeeds. Stone Curse itself petrifies without a to-hit roll.',
  refs: [missile('278-306'), missile('2363-2416')],
} as const satisfies StoneCurseInteraction;

export const MONSTER_HIT_RECOVERY_DATA = {
  rule: 'Each successful non-resistant hit calls M_StartHit; qualifying persistent repeat hits can restart monster hit recovery. Resistant hits tag and play hit audio without M_StartHit.',
  refs: [missile('325-344')],
} as const;
