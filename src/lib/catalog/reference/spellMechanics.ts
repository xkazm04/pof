/** Spell promotion enrichment: engine-derived hit rules, fizzle semantics, and missile links. */
import {
  MONSTER_HIT_RECOVERY_DATA,
  SPELL_FIZZLE_BRANCHES_DATA,
  SPELL_FIZZLE_RULE_DATA,
  STONE_CURSE_INTERACTION_DATA,
} from '@/lib/catalog/reference/spellMechanicsData';
import { SPELL_TO_MISSILES } from '@/lib/catalog/reference/missileSpecs';
import { playerSpellHitSource, type PlayerSpellHitSource } from '@/lib/catalog/reference/playerSpellHits';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export interface SpellFizzleRule {
  readonly rule: string;
  readonly refs: readonly string[];
}

export interface SpellFizzleBranch {
  readonly spell: string;
  readonly failure: string;
  readonly setsSpellFizzled: boolean;
  readonly resource: 'free' | 'consumed';
  readonly refs: readonly string[];
}

export interface StoneCurseInteraction {
  readonly rule: string;
  readonly refs: readonly string[];
}

export interface SpellHitRuleSummary {
  readonly collisionChecks: string;
  readonly damageRoll: PlayerSpellHitSource['damageRoll'];
  readonly collisionDamage: PlayerSpellHitSource['collisionDamage'];
  readonly hitResult: PlayerSpellHitSource['hitResult'];
  readonly stationaryGeometry: string;
  readonly monsterHitRecovery: typeof MONSTER_HIT_RECOVERY_DATA;
  readonly refs: readonly string[];
}

export interface SpellMechanics {
  readonly perCastHits?: SpellHitRuleSummary;
  readonly fizzle: SpellFizzleRule & { readonly branches: readonly Omit<SpellFizzleBranch, 'spell'>[] };
  readonly stoneCurseInteraction?: StoneCurseInteraction;
}

function summarizeHitRule(source: PlayerSpellHitSource): SpellHitRuleSummary {
  return {
    collisionChecks: source.collisionChecks,
    damageRoll: source.damageRoll,
    collisionDamage: source.collisionDamage,
    hitResult: source.hitResult,
    stationaryGeometry: source.stationaryGeometry,
    monsterHitRecovery: MONSTER_HIT_RECOVERY_DATA,
    refs: source.refs,
  };
}

export function spellMechanics(spell: string): SpellMechanics {
  const hitSource = playerSpellHitSource(spell);
  const spec = spellSpec(spell);
  const branches = SPELL_FIZZLE_BRANCHES_DATA
    .filter((branch) => branch.spell === spell)
    .map((branch) => ({
      failure: branch.failure,
      setsSpellFizzled: branch.setsSpellFizzled,
      resource: branch.resource,
      refs: branch.refs,
    }));
  const stoneCurseRelevant = spell === 'StoneCurse' || spec?.damage.kind !== 'none';
  return {
    ...(hitSource ? { perCastHits: summarizeHitRule(hitSource) } : {}),
    fizzle: { ...SPELL_FIZZLE_RULE_DATA, branches },
    ...(stoneCurseRelevant ? { stoneCurseInteraction: STONE_CURSE_INTERACTION_DATA } : {}),
  };
}

/** Add code-owned mechanics and direct host links without changing the reusable raw wrapper. */
export function withSpellMechanics(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'spellbook' || wrapper.file !== 'spells/spelldat.tsv') return wrapper;
    const spell = wrapper.raw.id ?? wrapper.key;
    const missileIds = SPELL_TO_MISSILES.find((link) => link.owner === spell)?.missiles ?? [];
    const links = [
      ...(wrapper.entity.links ?? []).filter((link) => link.catalogId !== 'vfx' || link.role !== 'host'),
      ...missileIds.map((missile) => ({ catalogId: 'vfx', entityId: `d1-${missile}`, role: 'host' })),
    ];
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        links,
        data: { ...wrapper.entity.data, mechanics: spellMechanics(spell) },
      },
    };
  });
}
