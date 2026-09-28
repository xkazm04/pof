/**
 * Step-artifact SEEDS — pipeline step data derived from a reference row instead of produced
 * (/diablo W02b, operator decision D3). Every seed carries a `sourced` stamp, so its step can never
 * grade `pass` (`acceptance/sourced.ts`), and every field it deliberately does NOT write is returned
 * as a named gap — a seed never invents a number to complete a step.
 *
 * Numbers come from the reference's LAWS, parsed out of the canon rule that states them (registry:
 * design-canon-as-executable-law — one statement per law; edit the prose and the seed moves with it;
 * if the number cannot be found, fail loudly rather than fall back to a remembered value).
 */
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import type { ReferenceWrapper } from './wrapper';
import { resistanceKey } from '@/lib/catalog/canon/elements';
import { CAST_LAW_ID, SPELL_LAW_IDS, fireboltAt, type ReferenceCaster } from './spellLaw';
import { castTiming } from '@/lib/catalog/reference/combatMath';
import { damage } from '@/lib/catalog/reference/spellMath';
import { spellSpec } from '@/lib/catalog/reference/spellSpecs';
import { SPELL_STATUS_ENTITY_IDS } from '@/lib/catalog/reference/statusSpecs';

export interface StepSeed {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  /** Fields of this step the seed left unwritten, each with why. */
  gaps: string[];
}

export { resistanceByElement, resistanceLaw } from '@/lib/catalog/reference/resistanceLaw';
import { ELEMENTS, resistanceByElement } from '@/lib/catalog/reference/resistanceLaw';

function stamp(w: ReferenceWrapper, columns: string[]): SourcedStamp {
  const p = w.entity.provenance;
  return { sourceGame: p.sourceGame, sourceFile: p.sourceFile, sourceRow: p.sourceRow, columns };
}

/**
 * Bestiary seeds for one monstdat wrapper: `Resistances` and `Monster Rarity`.
 * `monstdat` holds the ordinary monsters (uniques are a separate table), which is itself the fact
 * the rarity seed rests on.
 */
export function seedBestiarySteps(w: ReferenceWrapper): StepSeed[] {
  if (w.catalogId !== 'bestiary' || w.file !== 'monsters/monstdat.tsv') return [];
  const res = resistanceByElement(w.raw.resistance ?? '');
  return [
    {
      catalogId: 'bestiary', entityId: w.entity.id, step: 'Resistances',
      data: {
        // Keys follow the diablo1 element set (D14): magic / fire / lightning.
        resists: {
          [resistanceKey('magic')]: res.MAGIC,
          [resistanceKey('fire')]: res.FIRE,
          [resistanceKey('lightning')]: res.LIGHTNING,
        },
        [SOURCED_FIELD]: stamp(w, ['resistance']),
      },
      gaps: [
        'resistanceHell: per-difficulty resistances are not seeded — PoF entities are difficulty-flat',
      ],
    },
    {
      catalogId: 'bestiary', entityId: w.entity.id, step: 'Monster Rarity',
      data: {
        rarity: { rarityTier: 'Normal', lifeMultiplier: 1, modifiers: [] },
        [SOURCED_FIELD]: stamp(w, ['(table membership: monstdat holds the ordinary monsters)']),
      },
      gaps: [
        'modifiers: Diablo I ordinary monsters carry no modifiers — PoF’s step expects at least one (a genre assumption)',
        'rarityScale: Diablo I has no Magic/Rare monster tiers — its only other tier is the unique monster table',
      ],
    },
  ];
}

/**
 * Where a Diablo item is worn, in UE's `EEquipmentSlot` vocabulary (/diablo W10, D2). `equipType` is the slot family and
 * `itemType` refines it: a Shield is "One-handed" but goes in the off hand. Unequippable → none.
 */
export function slotOf(equipType: string, itemType: string): string | null {
  if (equipType === 'One-handed' || equipType === 'Two-handed') return itemType === 'Shield' ? 'OffHand' : 'Weapon';
  const bySlot: Record<string, string> = { Armor: 'Chest', Helm: 'Helm', Ring: 'Ring', Amulet: 'Amulet' };
  return bySlot[equipType] ?? null;
}

const num = (v: string | undefined) => (v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Items seeds for one itemdat wrapper (/diablo W10, D2): `Base Type & Rarity` for anything wearable, plus
 * `Damage / Implicit` for a weapon — in the shape UE's UARPGItemDefinition declares (slot, damage/armour range,
 * durability, attribute requirements). What the reference cannot state is a declared gap, never a number.
 */
export function seedItemSteps(w: ReferenceWrapper): StepSeed[] {
  if (w.catalogId !== 'items' || w.file !== 'items/itemdat.tsv') return [];
  const r = w.raw;
  const slot = slotOf(r.equipType ?? '', r.itemType ?? '');
  if (!slot) return [];
  const armorMin = num(r.minArmor);
  const armorMax = num(r.maxArmor);
  const seeds: StepSeed[] = [{
    catalogId: 'items', entityId: w.entity.id, step: 'Base Type & Rarity',
    data: {
      baseType: {
        baseType: r.name,
        slot,
        twoHanded: r.equipType === 'Two-handed',
        subType: r.itemType,
        // D4 (W11): a base type's rarity is rolled per drop — declared, not a gap.
        rarityRolled: true,
        ilvl: REFERENCE_GAP,
        requiredLevel: REFERENCE_GAP,
        implicit: REFERENCE_GAP,
        requirements: { strength: num(r.minStrength) ?? 0, dexterity: num(r.minDexterity) ?? 0, intelligence: num(r.minMagic) ?? 0 },
        durability: num(r.durability) ?? 0,
        ...(armorMax ? { armor: { minimum: armorMin ?? 0, maximum: armorMax } } : {}),
        dropLevel: num(r.minMonsterLevel) ?? 0,
      },
      [SOURCED_FIELD]: stamp(w, ['equipType', 'itemType', 'minStrength', 'minMagic', 'minDexterity', 'durability', 'minArmor', 'maxArmor', 'minMonsterLevel']),
    },
    gaps: [
      'ilvl: a base type has no item level; the drop is rolled at the monster\'s level (D7)',
      'requiredLevel: Diablo gates an item by attributes, never by character level',
      'implicit: Diablo base types carry no implicit modifier',
      'requirements.intelligence: Diablo\'s Magic requirement read as PoF\'s Intelligence (approximate)',
    ],
  }];
  const dmgMin = num(r.minDamage);
  const dmgMax = num(r.maxDamage);
  if (slot === 'Weapon' && dmgMax) {
    seeds.push({
      catalogId: 'items', entityId: w.entity.id, step: 'Damage / Implicit',
      data: {
        damage: {
          damageType: 'Physical',
          damageMin: dmgMin ?? 0,
          damageMax: dmgMax,
          attackSpeed: REFERENCE_GAP,
          critChance: REFERENCE_GAP,
          critMulti: REFERENCE_GAP,
          baseDPS: REFERENCE_GAP,
        },
        [SOURCED_FIELD]: stamp(w, ['minDamage', 'maxDamage']),
      },
      gaps: [
        'attackSpeed: Diablo\'s swing speed belongs to the wielder\'s CLASS (its animation frames), not to the weapon',
        'critChance / critMulti: critical strikes are a Warrior class trait in Diablo, not a weapon stat',
        'baseDPS: needs an attack speed the weapon does not carry',
      ],
    });
  }
  return seeds;
}

/**
 * Spellbook seed for one spelldat wrapper (/diablo W12, D4): `Effect Logic`. Diablo I has NO cooldowns — mana (and the
 * cast animation) limit casting — so the seed declares `gatedBy: "resource"` beside the mana cost instead of inventing a
 * cooldown. The element is the spell's one element trait (`Fire,Targeted`); damage lives on the MISSILE, a gap.
 */
export function seedSpellSteps(w: ReferenceWrapper, caster?: ReferenceCaster): StepSeed[] {
  if (w.catalogId !== 'spellbook' || w.file !== 'spells/spelldat.tsv') return [];
  const r = w.raw;
  const traits = (r.flags ?? '').split(',').map((f) => f.trim());
  const element = traits.find((t) => (ELEMENTS as readonly string[]).includes(t.toUpperCase()));
  const manaCost = num(r.manaCost);
  if (manaCost == null) return [];
  const spec = spellSpec(r.id);
  const hasDamage = spec?.damage.kind === 'direct' || spec?.damage.kind === 'per-tick';
  let evaluated: ReturnType<typeof damage> | null = null;
  let evaluationGap: string | null = null;
  if (caster && hasDamage) {
    try {
      evaluated = damage(r.id, { spellLevel: 1, characterLevel: caster.level, magic: caster.magic });
    } catch (error) {
      evaluationGap = error instanceof Error ? error.message : String(error);
    }
  }
  const legacyFirebolt = caster && r.id === 'Firebolt' ? fireboltAt(caster, 1, manaCost) : null;
  const casting = caster
    ? castTiming({ cast: { frames: caster.castingFrames, actionFrame: caster.castingActionFrame } })
    : undefined;
  const meanDamage = legacyFirebolt?.damage.mean ?? evaluated?.mean ?? null;
  const damageType = spec ? (spec.element === 'none' ? null : spec.element[0].toUpperCase() + spec.element.slice(1)) : element;
  // A zero-cost row is a free class skill: only its cast animation limits it (W20, D-B8). Its cast time needs the named
  // reference caster's casting frames (d1-timing-law ticks); without a caster the cast time is a gap, never invented.
  const free = manaCost === 0;
  const gate = free
    ? { gatedBy: 'cast-time', castTime: casting ? Number(casting.seconds.toFixed(3)) : REFERENCE_GAP }
    : { gatedBy: 'resource' };
  const effect = spec
    ? {
        abilityId: r.id,
        activation: 'active cast from the reference spell row',
        kind: spec.effectKind,
        manaCost,
        ...gate,
        ...(hasDamage ? {
          damageType,
          baseDamage: meanDamage ?? REFERENCE_GAP,
          critChancePct: REFERENCE_GAP,
          critMulti: REFERENCE_GAP,
          onHitIgnite: REFERENCE_GAP,
        } : {}),
      }
    : {
        abilityId: r.id,
        activation: 'active cast from the reference spell row',
        kind: 'unclassified',
        damageType: element ?? REFERENCE_GAP,
        manaCost,
        ...gate,
        baseDamage: REFERENCE_GAP,
        critChancePct: REFERENCE_GAP,
        critMulti: REFERENCE_GAP,
        onHitIgnite: REFERENCE_GAP,
      };
  const effects = spec
    ? [{
        kind: hasDamage ? 'damage' : spec.effectKind,
        target: spec.delivery,
        value: hasDamage ? (meanDamage ?? REFERENCE_GAP) : spec.durationTicks,
        ...(hasDamage && damageType ? { damageType } : {}),
      }]
    : [{ kind: 'unclassified', target: 'not in the reference', value: REFERENCE_GAP }];
  const seeds: StepSeed[] = [{
    catalogId: 'spellbook', entityId: w.entity.id, step: 'Effect Logic',
    data: {
      effect,
      effects,
      [SOURCED_FIELD]: stamp(w, ['flags', 'manaCost', ...(spec ? [`(law ${spec.lawId})`] : [])]),
    },
    gaps: [
      ...(hasDamage
        ? [meanDamage != null
            ? `baseDamage: mean ${evaluated?.min ?? legacyFirebolt!.damage.minimum}-${evaluated?.max ?? legacyFirebolt!.damage.maximum} HP for ${caster!.basis}; one collision/tick, not total cast damage`
            : `baseDamage: ENGINE CODE needs a named reference caster${evaluationGap ? ` and ${evaluationGap}` : ''}`,
          'critChancePct / critMulti: spells do not crit in Diablo I',
          'onHitIgnite: Diablo I has no ignite follow-up']
        : spec ? [] : ['damageType/baseDamage: no structured engine law for this row']),
      ...(spec || element ? [] : ['damageType: the spell carries no element trait']),
      'wiringContract: the reference engine does not define PoF grants, input bindings, dependencies, or verification',
      ...(manaCost > 0 || caster ? [] : ['castTime: a free skill cast time needs a named reference caster (--root)']),
    ],
  }];
  // Balance is conditional on damage; utility effects deliberately carry no damage fields.
  if (hasDamage && caster) {
    const castTime = casting!.seconds;
    const releaseTime = casting!.releaseSeconds;
    const hitDPS = meanDamage == null ? REFERENCE_GAP : Number((meanDamage / castTime).toFixed(3));
    seeds.push({
      catalogId: 'spellbook', entityId: w.entity.id, step: 'Balance',
      data: {
        balance: {
          kind: 'damage',
          baseDamage: meanDamage ?? REFERENCE_GAP,
          damageRange: evaluated ? { minimum: evaluated.min, maximum: evaluated.max } : REFERENCE_GAP,
          castTime,
          releaseTime,
          manaCost,
          manaRegenPerSec: 0,
          limiter: 'castTime',
          hitDPS,
          igniteDPS: 0,
          sustainedDPS: hitDPS,
          components: ['hitDPS'],
          normalizedPower: hitDPS,
          castsPerPool: manaCost > 0 ? Math.floor(caster.maxMana / manaCost) : REFERENCE_GAP,
          tierTarget: REFERENCE_GAP,
          units: { baseDamage: 'Diablo hit points', castTime: 's', manaCost: 'Diablo mana' },
          basis: `${caster.basis}; spell level 1; one collision/tick; laws ${SPELL_LAW_IDS[r.id]} + ${CAST_LAW_ID} + d1-timing-law`,
        },
        [SOURCED_FIELD]: stamp(w, ['manaCost', `(laws ${SPELL_LAW_IDS[r.id]}, ${CAST_LAW_ID})`, '(class tables: attributes, animations)']),
      },
      gaps: [
        'tierTarget: the tier-100 power line is PoF design; a 1996 spell has no place on it until converted (D23 anchors, in UE)',
        'toHit and multi-hit geometry: rolled per collision and not part of hitDPS',
        'sustain: Diablo I has no mana regeneration — the pool (castsPerPool) and potions sustain casting, not a rate',
        ...(evaluationGap ? [`baseDamage: ${evaluationGap}`] : []),
      ],
    });
  }
  const statusEntityId = SPELL_STATUS_ENTITY_IDS[r.id];
  const statusLink = statusEntityId
    ? { catalogId: 'status-effects', entityId: statusEntityId, role: 'applies' }
    : null;
  seeds.push({
    catalogId: 'spellbook', entityId: w.entity.id, step: 'Applies Status',
    data: {
      appliedStatus: statusLink ? {
        statusId: `status-effects::${statusEntityId}`,
        role: 'applies',
        trigger: `${r.id} creates or activates the engine-owned state described by ${statusEntityId}-law.`,
        reason: `${statusEntityId}-law`,
        links: [statusLink],
      } : {
        statusId: 'none',
        role: 'does-not-apply',
        trigger: 'The cast creates no cataloged actor status; any missile, damage, healing, item, or world operation owns its own lifetime.',
        reason: 'd1-status-overview-law',
      },
      links: statusLink ? [statusLink] : [],
      [SOURCED_FIELD]: stamp(w, [statusLink ? `(law ${statusEntityId}-law)` : '(law d1-status-overview-law)']),
    },
    gaps: [],
  });
  return seeds;
}
