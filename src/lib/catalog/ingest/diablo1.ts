/**
 * Diablo I (1996) → PoF catalog mapping.
 *
 * **This file carries the MAPPING, never the ingested VALUES.** The column names below are
 * PoF's own analysis; the numbers they describe are Blizzard's design work, recovered and
 * redistributed by a reverse-engineering project under its own terms. Checking 734 rows of
 * another studio's balance data into this repo would make the licence question
 * unanswerable forever, so the tables are read from a path the operator supplies and every
 * produced entity carries `provenance.licenceNote` (see `EntityProvenance`).
 *
 * Why this game: it is the genre PoF targets (an ARPG with a bestiary, an affix-driven loot
 * system, a spellbook and a level curve), its data was externalized into TSV by DevilutionX
 * so no binary container has to be cracked, and it is old enough that its schema is a
 * complete, shipped, balanced design rather than a prototype.
 *
 * Every column of every table is classified. Omission is not a way to say "not carried" —
 * `auditColumns` reports an unclassified column, which is how a column added upstream
 * becomes a visible defect instead of a silent loss.
 */
import { dropped, gap, mapped, type FieldMap } from './fieldMap';
import { dropValues, split, unwrap } from './decode';
import type { EntityProvenance } from '../types';

export const DIABLO1_SOURCE = {
  sourceGame: 'Diablo I (1996)',
  sourceProject: 'DevilutionX (diasurgical/devilutionX) — assets/txtdata',
  licenceNote:
    'Design values originate with Blizzard Entertainment and were recovered by DevilutionX. '
    + 'The reading code is PoF’s; these numbers are NOT. Reference-only — do not ship in a '
    + 'released title without clearing rights.',
} as const;

export function provenanceFor(sourceFile: string, sourceRow: string): EntityProvenance {
  return {
    kind: 'ingest',
    sourceGame: DIABLO1_SOURCE.sourceGame,
    sourceProject: DIABLO1_SOURCE.sourceProject,
    sourceFile,
    sourceRow,
    licenceNote: DIABLO1_SOURCE.licenceNote,
    ingestedAt: new Date().toISOString(),
    canonProfile: 'diablo1',
  };
}

/* ── bestiary ← monstdat.tsv (41 columns) ──────────────────────────────── */

const NO_RESIST = 'PoF bestiary has no per-element resistance field — `stats` is an untyped {label,value}[] with no damage-type vocabulary';
const NO_DRAIN = 'on-hit stat-drain has no representation: `status-effects` is a catalog but no archetype→status-effect link `role` exists';

export const MONSTER_MAP: FieldMap = {
  _monster_id: mapped('id'),
  name: mapped('name'),
  // The FAMILY key, not a renderer detail (W07): every member of a family shares one asset set
  // (`<set folder>\<file prefix>`) and differs only by a `trnFile` palette swap. The folder names
  // the family; W06 had to type the family head by hand because this column was dropped.
  assetsSuffix: mapped('data.artSet', unwrap('^([^\\\\]+)')),
  soundSuffix: dropped('audio bank path'),
  trnFile: dropped('palette-swap table; PoF re-skins through materials, not colour LUTs'),
  availability: gap('no spawn-availability/rarity field on an archetype (Always | Retail | Never)'),
  width: dropped('sprite cell width'),
  image: dropped('sprite atlas id'),
  // A BOOLEAN column, so it must not be appended to a name list: the first live run
  // produced `abilities: ['false']` — a monster with an ability literally called "false".
  // Booleans become flags; only `abilityFlags` names abilities.
  hasSpecial: mapped('data.hasSpecialAttack'),
  hasSpecialSound: dropped('audio flag'),
  // Positional lists (stand, walk, attack, hit, death, special) kept as ONE raw string: the list path de-duplicates
  // values, and "4,1,1,1,1,1" would become [4, 1]. They feed the DERIVED timing (walk/attack ticks, D29 — W09).
  'frames[6]': mapped('data.animFrames'),
  'rate[6]': mapped('data.animRates'),
  minDunLvl: gap('no spawn depth range; PoF has a single free-text `area: string`'),
  maxDunLvl: gap('no spawn depth range (see minDunLvl)'),
  level: mapped('data.stats[Level]'),
  hitPointsMinimum: mapped('data.stats[HP Min]'),
  hitPointsMaximum: mapped('data.stats[HP Max]'),
  ai: mapped('tags'),
  // AI TRAITS (`SEARCH,CAN_OPEN_DOOR`), not abilities — and a list, so it is split.
  abilityFlags: mapped('data.behaviorFlags[]', split(',')),
  // The AI routine's own parameter (its laws read it: act/attack chances, pause lengths) — an input of the derived timing.
  intelligence: mapped('data.intelligence'),
  toHit: mapped('data.stats[To Hit]'),
  // The attack's ACTION frame — when the hit lands (the melee hit window, W08).
  animFrameNum: mapped('data.attackActionFrame'),
  minDamage: mapped('data.stats[Damage Min]'),
  maxDamage: mapped('data.stats[Damage Max]'),
  toHitSpecial: mapped('data.stats[To Hit (special)]'),
  animFrameNumSpecial: dropped('special-attack frame index'),
  minDamageSpecial: mapped('data.stats[Special Damage Min]'),
  maxDamageSpecial: mapped('data.stats[Special Damage Max]'),
  reducePlayerStrength: gap(NO_DRAIN),
  reducePlayerMagic: gap(NO_DRAIN),
  reducePlayerDexterity: gap(NO_DRAIN),
  reducePlayerVitality: gap(NO_DRAIN),
  reducePlayerMaxHP: gap(NO_DRAIN),
  reducePlayerMaxMana: gap(NO_DRAIN),
  armorClass: mapped('data.stats[Armor Class]'),
  monsterClass: mapped('data.category'),
  resistance: gap(NO_RESIST),
  resistanceHell: gap('no per-difficulty variant of ANY stat — a PoF entity is difficulty-flat, so a game with per-difficulty balance cannot round-trip'),
  selectionRegion: dropped('mouse-picking hitbox'),
  // 106 blank, 4 `None` (a sentinel, not an entity), 2 `Uniq(<id>)` — a UNIQUE ITEM the
  // monster always drops. Diablo has no per-monster loot table: drops are driven by monster
  // level, which is why this never maps to `loot-tables` (backlog G13).
  treasure: mapped('links[role=unique-drop]', dropValues('None'), unwrap('^Uniq\\((.+)\\)$')),
  exp: mapped('data.stats[XP]'),
};

/* ── items ← itemdat.tsv (23 columns) ──────────────────────────────────── */

export const ITEM_MAP: FieldMap = {
  id: mapped('id'),
  dropRate: gap('drop weight lives on the item in Diablo; in PoF it lives only in `loot-tables`, keyed by archetype, so an item cannot state its own rarity of appearance'),
  class: mapped('data.type'),
  // The SLOT vocabulary (One-handed, Two-handed, Armor, Helm, Ring, Amulet, Unequippable) — UE's AllowedSlots is its home;
  // the items seed translates it with `itemType` (a Shield is One-handed but goes in the off hand) (W10, D2).
  equipType: mapped('data.equipType'),
  cursorGraphic: dropped('inventory sprite id'),
  itemType: mapped('data.subtype'),
  uniqueBaseItem: gap('no base-item → unique-item derivation link; PoF `items` entities are flat'),
  name: mapped('name'),
  shortName: dropped('narrow-UI label'),
  // The base type's minimum DROP level (qlvl): the level-driven loot (D7) gates which bases can drop at a monster's level.
  minMonsterLevel: mapped('data.dropLevel'),
  durability: mapped('data.stats[Durability]'),
  minDamage: mapped('data.stats[Damage Min]'),
  maxDamage: mapped('data.stats[Damage Max]'),
  minArmor: mapped('data.stats[Armor Min]'),
  maxArmor: mapped('data.stats[Armor Max]'),
  // Attribute requirements — UE's RequiredStrength/Dexterity/Intelligence (W10, D2). Diablo's Magic ≈ PoF's Intelligence.
  minStrength: mapped('data.requiredStrength'),
  minMagic: mapped('data.requiredMagic'),
  minDexterity: mapped('data.requiredDexterity'),
  specialEffects: mapped('data.effect'),
  miscId: gap('no consumable-behaviour discriminator (potion/scroll/book/rune)'),
  spell: mapped('links[role=ability]', dropValues('Null')), // `Null` on 142 of 168 rows
  usable: mapped('data.usable'),  // boolean — a flag, not a tag (see hasSpecial)
  value: mapped('data.stats[Value]'),
};

/* ── spellbook ← spelldat.tsv (15 columns) ─────────────────────────────── */

const NO_PRICE = 'no vendor price on an ability — `vendors` is a separate catalog with no ability→price link';
const NO_SCALING = 'no per-level scaling rule on an ability: `damage`/`manaCost` are single scalars, so a spell that grows with character level cannot be expressed';

export const SPELL_MAP: FieldMap = {
  id: mapped('id'),
  name: mapped('name'),
  soundId: dropped('audio bank id'),
  bookCost10: gap(NO_PRICE),
  staffCost10: gap(NO_PRICE),
  manaCost: mapped('data.manaCost'),
  // `Fire,Targeted` — the ELEMENT lives here, alongside targeting traits.
  flags: mapped('data.traits[]', split(',')),
  bookLevel: mapped('data.tier', dropValues('-1')), // -1 = never found in a book
  staffLevel: gap('no per-delivery-vehicle availability (learned vs. staff-charged)'),
  minIntelligence: gap('no attribute requirement to cast'),
  missiles: mapped('data.missiles[]', split(',')), // `FlashBottom,FlashTop`
  manaMultiplier: gap(NO_SCALING),
  minMana: gap(NO_SCALING),
  staffMin: gap('no finite-charge model: an ability in PoF is always available once known, so a staff carrying 3-10 casts has nowhere to record its remaining uses'),
  staffMax: gap('no finite-charge model (see staffMin) — and no item→ability charge link, since `links` carries a role but no quantity'),
};

/* ── the other direction: PoF fields NO data source can fill ───────────── */

/**
 * A source column with no target is only half the story. These are target fields that a
 * complete, shipped 1996 ARPG design still cannot populate — the more interesting half,
 * because each one is either a field PoF must DERIVE, a field that is presentation rather
 * than design, or a genre assumption baked into the schema.
 */
export interface TargetGap {
  catalogId: string;
  field: string;
  kind: 'unpersistable' | 'presentation' | 'derived' | 'genre-assumption' | 'repo-internal';
  why: string;
}

export const TARGET_GAPS: TargetGap[] = [
  {
    catalogId: 'bestiary', field: 'iconKey', kind: 'presentation',
    why: 'a glyph key chosen per archetype (`ARCHETYPE_ICONS`); derivable from role once role is derived. (Was `icon`, a React component that JSON reduced to `{}` — fixed 2026-09-22, G1.)',
  },
  { catalogId: 'bestiary', field: 'color', kind: 'presentation', why: 'a hex swatch chosen for the UI, not design data' },
  { catalogId: 'bestiary', field: 'btSummary', kind: 'derived', why: 'hand-written behaviour prose; the source has an `ai` enum and an `intelligence` scalar, neither of which is a sentence' },
  { catalogId: 'bestiary', field: 'featureName', kind: 'repo-internal', why: 'links the entity to PoF’s own feature matrix — meaningless for foreign data' },
  { catalogId: 'bestiary', field: 'role', kind: 'derived', why: 'melee/ranged/support must be inferred from `ai` plus whether the archetype has missiles' },
  { catalogId: 'bestiary', field: 'tier', kind: 'derived', why: 'minion/standard/elite/boss must be inferred from level and HP relative to the curve' },
  { catalogId: 'items', field: 'rarity', kind: 'genre-assumption', why: 'Diablo base items have NO rarity — rarity is emergent from the affixes rolled onto them. PoF treats rarity as an intrinsic property of the item.' },
  { catalogId: 'items', field: 'description', kind: 'derived', why: 'flavour text; the source has none for base items' },
  {
    catalogId: 'spellbook', field: 'cooldown', kind: 'genre-assumption',
    why: 'PoF’s ability schema assumes cooldown-gated design. Diablo I gates casting with MANA and cast speed and has no cooldown at all, so every ingested ability must invent one or store a lie.',
  },
  { catalogId: 'spellbook', field: 'radar', kind: 'derived', why: 'a normalized 5-tuple [Damage,Range,AoE,Speed,Efficiency] with no source; must be computed from the mapped stats or left unset' },
  { catalogId: 'spellbook', field: 'element', kind: 'derived', why: 'carried inside `flags` (`Fire,Targeted`) as one of several traits — derivable, but only by knowing which trait words are elements' },
  { catalogId: 'spellbook', field: 'damage', kind: 'derived', why: 'Diablo spell damage lives on the MISSILE, not the spell — a join PoF’s flat ability schema has no shape for' },
];

// The table list (file → catalog → key → map) lives in ONE place: `reference/sources.ts` → `DIABLO1.tables`.
