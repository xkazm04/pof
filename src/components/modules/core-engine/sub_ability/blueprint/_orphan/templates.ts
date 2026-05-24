/**
 * Preset archetype templates for the GAS Blueprint Editor.
 *
 * Each template provides production-quality seed data matching UE5 GAS conventions
 * for a common ARPG ability archetype.
 */

import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD,
  MODULE_COLORS, STATUS_SUBDUED, ACCENT_RED,
} from '@/lib/chart-colors';

/* ── Shared type aliases (mirror GASBlueprintEditor internals) ────────── */

type AttrCategory = 'meta' | 'vital' | 'primary' | 'combat' | 'progression';

interface EditorAttribute {
  id: string;
  name: string;
  category: AttrCategory;
  defaultValue: number;
  clampMin?: number;
  clampMax?: string;
}

interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

type EffectDuration = 'instant' | 'duration' | 'infinite';

interface EditorEffect {
  id: string;
  name: string;
  duration: EffectDuration;
  durationSec: number;
  cooldownSec: number;
  color: string;
  modifiers: { attribute: string; operation: 'add' | 'multiply'; magnitude: number }[];
  grantedTags: string[];
}

interface TagRule {
  id: string;
  sourceTag: string;
  targetTag: string;
  type: 'blocks' | 'cancels' | 'requires';
}

interface LoadoutSlot {
  id: string;
  slot: number;
  abilityName: string;
  iconColor: string;
  cooldownTag: string;
}

/* ── Template definition ──────────────────────────────────────────────── */

export interface GASTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;              // emoji shorthand for preview cards
  color: string;             // accent color for the card
  tags: string[];            // e.g. ['melee', 'combo', 'hit-chain']
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  loadout: LoadoutSlot[];
}

/* ══════════════════════════════════════════════════════════════════════════
   SHARED ATTRIBUTES — reused across all templates
   ══════════════════════════════════════════════════════════════════════════ */

const BASE_VITALS: EditorAttribute[] = [
  { id: 'a-indmg', name: 'IncomingDamage', category: 'meta', defaultValue: 0 },
  { id: 'a-inheal', name: 'IncomingHeal', category: 'meta', defaultValue: 0 },
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100, clampMin: 0, clampMax: 'MaxHealth' },
  { id: 'a-maxhp', name: 'MaxHealth', category: 'vital', defaultValue: 100, clampMin: 1 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50, clampMin: 0, clampMax: 'MaxMana' },
  { id: 'a-maxmp', name: 'MaxMana', category: 'vital', defaultValue: 50, clampMin: 0 },
];

const BASE_RELATIONSHIPS: AttrRelationship[] = [
  { id: 'r-dmg', sourceId: 'a-indmg', targetId: 'a-hp', type: 'clamp', formula: 'Health -= IncomingDamage' },
  { id: 'r-heal', sourceId: 'a-inheal', targetId: 'a-hp', type: 'clamp', formula: 'Health += IncomingHeal' },
  { id: 'r-hpclamp', sourceId: 'a-maxhp', targetId: 'a-hp', type: 'clamp', formula: 'clamp(0, MaxHealth)' },
  { id: 'r-mpclamp', sourceId: 'a-maxmp', targetId: 'a-mp', type: 'clamp', formula: 'clamp(0, MaxMana)' },
];

const DEAD_BLOCKS_ALL: TagRule = { id: 't-dead', sourceTag: 'State.Dead', targetTag: 'Ability.*', type: 'blocks' };
const STUN_BLOCKS_ALL: TagRule = { id: 't-stun', sourceTag: 'State.Stunned', targetTag: 'Ability.*', type: 'blocks' };

/* ══════════════════════════════════════════════════════════════════════════
   1. MELEE COMBO — three-hit chain with finisher
   ══════════════════════════════════════════════════════════════════════════ */

const MELEE_COMBO: GASTemplate = {
  id: 'melee-combo',
  name: 'Melee Combo',
  description: 'Three-hit melee chain with increasing damage, combo window tags, and a heavy finisher. Models hit-stop, commitment frames, and cancel windows.',
  icon: '\u{2694}',
  color: STATUS_ERROR,
  tags: ['melee', 'combo', 'hit-chain'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-str', name: 'Strength', category: 'primary', defaultValue: 15 },
    { id: 'a-atkpow', name: 'AttackPower', category: 'combat', defaultValue: 20, clampMin: 0 },
    { id: 'a-atkspd', name: 'AttackSpeed', category: 'combat', defaultValue: 1.0, clampMin: 0.1 },
    { id: 'a-critchance', name: 'CriticalChance', category: 'combat', defaultValue: 0.1, clampMin: 0, clampMax: '1.0' },
    { id: 'a-critdmg', name: 'CriticalDamage', category: 'combat', defaultValue: 1.5, clampMin: 1 },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-str-atk', sourceId: 'a-str', targetId: 'a-atkpow', type: 'scale', formula: 'AttackPower += Strength * 2' },
  ],
  effects: [
    { id: 'e-slash1', name: 'GE_Slash1', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_ERROR, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 15 }], grantedTags: ['State.Attacking', 'Combo.Window.2'] },
    { id: 'e-slash2', name: 'GE_Slash2', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_ORANGE, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 20 }], grantedTags: ['State.Attacking', 'Combo.Window.3'] },
    { id: 'e-finisher', name: 'GE_Finisher', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_WARNING, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 40 }], grantedTags: ['State.Attacking', 'State.HitStop'] },
    { id: 'e-combowindow', name: 'GE_ComboWindow', duration: 'duration', durationSec: 0.6, cooldownSec: 0, color: ACCENT_CYAN, modifiers: [], grantedTags: ['State.ComboReady'] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-atk-block', sourceTag: 'State.Attacking', targetTag: 'Ability.Melee.*', type: 'blocks' },
    { id: 't-combo2-req', sourceTag: 'Combo.Window.2', targetTag: 'Ability.Melee.Slash2', type: 'requires' },
    { id: 't-combo3-req', sourceTag: 'Combo.Window.3', targetTag: 'Ability.Melee.Finisher', type: 'requires' },
    { id: 't-hitstop', sourceTag: 'State.HitStop', targetTag: 'Ability.*', type: 'blocks' },
  ],
  loadout: [
    { id: 'l-s1', slot: 1, abilityName: 'Slash1', iconColor: STATUS_ERROR, cooldownTag: 'Cooldown.Slash1' },
    { id: 'l-s2', slot: 2, abilityName: 'Slash2', iconColor: ACCENT_ORANGE, cooldownTag: 'Cooldown.Slash2' },
    { id: 'l-fin', slot: 3, abilityName: 'Finisher', iconColor: STATUS_WARNING, cooldownTag: 'Cooldown.Finisher' },
    { id: 'l-dodge', slot: 4, abilityName: 'DodgeRoll', iconColor: ACCENT_CYAN, cooldownTag: 'Cooldown.DodgeRoll' },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   2. PROJECTILE SPELL — fireball with travel time & AoE splash
   ══════════════════════════════════════════════════════════════════════════ */

const PROJECTILE_SPELL: GASTemplate = {
  id: 'projectile-spell',
  name: 'Projectile Spell',
  description: 'Classic fireball with mana cost, cast time, projectile travel, and AoE splash on impact. Includes ignite DoT on crit.',
  icon: '\u{1F525}',
  color: ACCENT_ORANGE,
  tags: ['ranged', 'projectile', 'AoE', 'mana'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-int', name: 'Intelligence', category: 'primary', defaultValue: 18 },
    { id: 'a-spellpow', name: 'SpellPower', category: 'combat', defaultValue: 25, clampMin: 0 },
    { id: 'a-castspd', name: 'CastSpeed', category: 'combat', defaultValue: 1.0, clampMin: 0.1 },
    { id: 'a-critchance', name: 'CriticalChance', category: 'combat', defaultValue: 0.15, clampMin: 0, clampMax: '1.0' },
    { id: 'a-critdmg', name: 'CriticalDamage', category: 'combat', defaultValue: 2.0, clampMin: 1 },
    { id: 'a-aoeradius', name: 'AoERadius', category: 'combat', defaultValue: 300, clampMin: 0 },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-int-sp', sourceId: 'a-int', targetId: 'a-spellpow', type: 'scale', formula: 'SpellPower += Intelligence * 3' },
    { id: 'r-int-mp', sourceId: 'a-int', targetId: 'a-maxmp', type: 'scale', formula: 'MaxMana += Intelligence * 5' },
  ],
  effects: [
    { id: 'e-manacost', name: 'GE_ManaCost_Fireball', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_CYAN, modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: -20 }], grantedTags: [] },
    { id: 'e-fireball', name: 'GE_Fireball_Impact', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_ORANGE, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 45 }], grantedTags: ['State.Burning'] },
    { id: 'e-splash', name: 'GE_Fireball_Splash', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_WARNING, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 20 }], grantedTags: [] },
    { id: 'e-ignite', name: 'GE_Ignite_DoT', duration: 'duration', durationSec: 4, cooldownSec: 1, color: STATUS_ERROR, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 8 }], grantedTags: ['State.Burning'] },
    { id: 'e-castbar', name: 'GE_CastBar', duration: 'duration', durationSec: 1.2, cooldownSec: 0, color: ACCENT_VIOLET, modifiers: [], grantedTags: ['State.Casting'] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-cast-block', sourceTag: 'State.Casting', targetTag: 'Ability.*', type: 'blocks' },
    { id: 't-cd-fb', sourceTag: 'Cooldown.Fireball', targetTag: 'Ability.Fireball', type: 'blocks' },
    { id: 't-silence', sourceTag: 'State.Silenced', targetTag: 'Ability.Spell.*', type: 'blocks' },
  ],
  loadout: [
    { id: 'l-fb', slot: 1, abilityName: 'Fireball', iconColor: ACCENT_ORANGE, cooldownTag: 'Cooldown.Fireball' },
    { id: 'l-frostbolt', slot: 2, abilityName: 'FrostBolt', iconColor: ACCENT_CYAN, cooldownTag: 'Cooldown.FrostBolt' },
    { id: 'l-blink', slot: 3, abilityName: 'Blink', iconColor: ACCENT_VIOLET, cooldownTag: 'Cooldown.Blink' },
    { id: 'l-barrier', slot: 4, abilityName: 'ManaBarrier', iconColor: MODULE_COLORS.core, cooldownTag: 'Cooldown.ManaBarrier' },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   3. CHANNELED ABILITY — beam/drain with tick-based effects
   ══════════════════════════════════════════════════════════════════════════ */

const CHANNELED_ABILITY: GASTemplate = {
  id: 'channeled-ability',
  name: 'Channeled Ability',
  description: 'Sustained beam/drain that ticks damage and heals the caster per tick. Interrupted by stun or movement. Drains mana per second.',
  icon: '\u{26A1}',
  color: ACCENT_VIOLET,
  tags: ['channel', 'drain', 'sustain', 'tick'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-int', name: 'Intelligence', category: 'primary', defaultValue: 14 },
    { id: 'a-spellpow', name: 'SpellPower', category: 'combat', defaultValue: 18, clampMin: 0 },
    { id: 'a-lifesteal', name: 'LifeSteal', category: 'combat', defaultValue: 0.15, clampMin: 0, clampMax: '1.0' },
    { id: 'a-chanrate', name: 'ChannelTickRate', category: 'combat', defaultValue: 0.5, clampMin: 0.1 },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-int-sp', sourceId: 'a-int', targetId: 'a-spellpow', type: 'scale', formula: 'SpellPower += Intelligence * 2' },
    { id: 'r-int-mp', sourceId: 'a-int', targetId: 'a-maxmp', type: 'scale', formula: 'MaxMana += Intelligence * 4' },
  ],
  effects: [
    { id: 'e-drain-tick', name: 'GE_DrainBeam_Tick', duration: 'duration', durationSec: 5, cooldownSec: 0.5, color: ACCENT_VIOLET, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 12 }], grantedTags: ['State.Channeling'] },
    { id: 'e-drain-heal', name: 'GE_DrainBeam_Heal', duration: 'duration', durationSec: 5, cooldownSec: 0.5, color: STATUS_SUCCESS, modifiers: [{ attribute: 'IncomingHeal', operation: 'add', magnitude: 6 }], grantedTags: [] },
    { id: 'e-mana-drain', name: 'GE_ManaDrain_PerSec', duration: 'duration', durationSec: 5, cooldownSec: 1, color: ACCENT_CYAN, modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: -8 }], grantedTags: [] },
    { id: 'e-channel-shield', name: 'GE_ChannelShield', duration: 'duration', durationSec: 5, cooldownSec: 0, color: MODULE_COLORS.core, modifiers: [{ attribute: 'MaxHealth', operation: 'add', magnitude: 30 }], grantedTags: ['State.Shielded'] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-chan-block', sourceTag: 'State.Channeling', targetTag: 'Ability.*', type: 'blocks' },
    { id: 't-stun-cancel', sourceTag: 'State.Stunned', targetTag: 'State.Channeling', type: 'cancels' },
    { id: 't-move-cancel', sourceTag: 'State.Moving', targetTag: 'State.Channeling', type: 'cancels' },
    { id: 't-cd-drain', sourceTag: 'Cooldown.DrainBeam', targetTag: 'Ability.DrainBeam', type: 'blocks' },
  ],
  loadout: [
    { id: 'l-drain', slot: 1, abilityName: 'DrainBeam', iconColor: ACCENT_VIOLET, cooldownTag: 'Cooldown.DrainBeam' },
    { id: 'l-shield', slot: 2, abilityName: 'BoneShield', iconColor: MODULE_COLORS.core, cooldownTag: 'Cooldown.BoneShield' },
    { id: 'l-blink', slot: 3, abilityName: 'ShadowStep', iconColor: STATUS_SUBDUED, cooldownTag: 'Cooldown.ShadowStep' },
    { id: 'l-ult', slot: 4, abilityName: 'SoulHarvest', iconColor: STATUS_ERROR, cooldownTag: 'Cooldown.SoulHarvest' },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   4. AURA BUFF — passive team-wide stat buff
   ══════════════════════════════════════════════════════════════════════════ */

const AURA_BUFF: GASTemplate = {
  id: 'aura-buff',
  name: 'Aura Buff',
  description: 'Toggle-on aura that passively buffs nearby allies with stat bonuses. Stacking rules, toggle cost, and radius scaling from attributes.',
  icon: '\u{1F6E1}',
  color: STATUS_SUCCESS,
  tags: ['aura', 'buff', 'support', 'toggle'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-str', name: 'Strength', category: 'primary', defaultValue: 12 },
    { id: 'a-cha', name: 'Charisma', category: 'primary', defaultValue: 16 },
    { id: 'a-atkpow', name: 'AttackPower', category: 'combat', defaultValue: 15, clampMin: 0 },
    { id: 'a-armor', name: 'Armor', category: 'combat', defaultValue: 10, clampMin: 0 },
    { id: 'a-aurarad', name: 'AuraRadius', category: 'combat', defaultValue: 600, clampMin: 100 },
    { id: 'a-aurapow', name: 'AuraPower', category: 'combat', defaultValue: 1.0, clampMin: 0 },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-cha-rad', sourceId: 'a-cha', targetId: 'a-aurarad', type: 'scale', formula: 'AuraRadius += Charisma * 25' },
    { id: 'r-cha-pow', sourceId: 'a-cha', targetId: 'a-aurapow', type: 'scale', formula: 'AuraPower += Charisma * 0.05' },
    { id: 'r-str-atk', sourceId: 'a-str', targetId: 'a-atkpow', type: 'scale', formula: 'AttackPower += Strength * 1.5' },
  ],
  effects: [
    { id: 'e-warcry', name: 'GE_WarCry_Aura', duration: 'infinite', durationSec: 0, cooldownSec: 2, color: STATUS_WARNING, modifiers: [{ attribute: 'AttackPower', operation: 'add', magnitude: 20 }, { attribute: 'Armor', operation: 'add', magnitude: 10 }], grantedTags: ['State.Buffed.WarCry'] },
    { id: 'e-rallying', name: 'GE_RallyingCry', duration: 'duration', durationSec: 10, cooldownSec: 0, color: STATUS_SUCCESS, modifiers: [{ attribute: 'MaxHealth', operation: 'add', magnitude: 50 }], grantedTags: ['State.Buffed.Rally'] },
    { id: 'e-manadrain', name: 'GE_AuraManaCost', duration: 'infinite', durationSec: 0, cooldownSec: 3, color: ACCENT_CYAN, modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: -5 }], grantedTags: [] },
    { id: 'e-cleanse', name: 'GE_Cleanse', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_SUCCESS, modifiers: [], grantedTags: ['State.Cleansed'] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-warcry-nostack', sourceTag: 'State.Buffed.WarCry', targetTag: 'Ability.WarCry', type: 'blocks' },
    { id: 't-rally-nostack', sourceTag: 'State.Buffed.Rally', targetTag: 'Ability.RallyingCry', type: 'blocks' },
    { id: 't-cleanse-cancel', sourceTag: 'State.Cleansed', targetTag: 'State.Burning', type: 'cancels' },
  ],
  loadout: [
    { id: 'l-warcry', slot: 1, abilityName: 'WarCry', iconColor: STATUS_WARNING, cooldownTag: 'Cooldown.WarCry' },
    { id: 'l-rally', slot: 2, abilityName: 'RallyingCry', iconColor: STATUS_SUCCESS, cooldownTag: 'Cooldown.RallyingCry' },
    { id: 'l-cleanse', slot: 3, abilityName: 'Cleanse', iconColor: ACCENT_EMERALD, cooldownTag: 'Cooldown.Cleanse' },
    { id: 'l-charge', slot: 4, abilityName: 'ShieldCharge', iconColor: MODULE_COLORS.core, cooldownTag: 'Cooldown.ShieldCharge' },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   5. DAMAGE OVER TIME — poison/bleed with stacking
   ══════════════════════════════════════════════════════════════════════════ */

const DAMAGE_OVER_TIME: GASTemplate = {
  id: 'damage-over-time',
  name: 'Damage Over Time',
  description: 'Stackable poison/bleed that ticks damage per second, with escalating potency per stack. Includes dispel interaction and execute threshold.',
  icon: '\u{2620}',
  color: STATUS_WARNING,
  tags: ['DoT', 'poison', 'bleed', 'stacking'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-dex', name: 'Dexterity', category: 'primary', defaultValue: 16 },
    { id: 'a-atkpow', name: 'AttackPower', category: 'combat', defaultValue: 12, clampMin: 0 },
    { id: 'a-dotpow', name: 'DoTPower', category: 'combat', defaultValue: 1.0, clampMin: 0 },
    { id: 'a-dotdur', name: 'DoTDuration', category: 'combat', defaultValue: 1.0, clampMin: 0.1 },
    { id: 'a-critchance', name: 'CriticalChance', category: 'combat', defaultValue: 0.2, clampMin: 0, clampMax: '1.0' },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-dex-dot', sourceId: 'a-dex', targetId: 'a-dotpow', type: 'scale', formula: 'DoTPower += Dexterity * 0.1' },
    { id: 'r-dex-atk', sourceId: 'a-dex', targetId: 'a-atkpow', type: 'scale', formula: 'AttackPower += Dexterity * 1.5' },
  ],
  effects: [
    { id: 'e-poison', name: 'GE_Poison_Stack', duration: 'duration', durationSec: 6, cooldownSec: 1, color: STATUS_SUCCESS, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 5 }], grantedTags: ['State.Poisoned'] },
    { id: 'e-bleed', name: 'GE_Bleed_Stack', duration: 'duration', durationSec: 8, cooldownSec: 1, color: STATUS_ERROR, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 4 }], grantedTags: ['State.Bleeding'] },
    { id: 'e-rupture', name: 'GE_Rupture', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_WARNING, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 30 }], grantedTags: [] },
    { id: 'e-execute', name: 'GE_Execute', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_RED, modifiers: [{ attribute: 'IncomingDamage', operation: 'multiply', magnitude: 3.0 }], grantedTags: ['State.Executed'] },
    { id: 'e-antidote', name: 'GE_Antidote', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_EMERALD, modifiers: [], grantedTags: ['State.Cleansed'] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-cleanse-poison', sourceTag: 'State.Cleansed', targetTag: 'State.Poisoned', type: 'cancels' },
    { id: 't-cleanse-bleed', sourceTag: 'State.Cleansed', targetTag: 'State.Bleeding', type: 'cancels' },
    { id: 't-poison-req', sourceTag: 'State.Poisoned', targetTag: 'Ability.Rupture', type: 'requires' },
    { id: 't-cd-rupture', sourceTag: 'Cooldown.Rupture', targetTag: 'Ability.Rupture', type: 'blocks' },
  ],
  loadout: [
    { id: 'l-strike', slot: 1, abilityName: 'PoisonStrike', iconColor: STATUS_SUCCESS, cooldownTag: 'Cooldown.PoisonStrike' },
    { id: 'l-bleed', slot: 2, abilityName: 'Lacerate', iconColor: STATUS_ERROR, cooldownTag: 'Cooldown.Lacerate' },
    { id: 'l-rupture', slot: 3, abilityName: 'Rupture', iconColor: STATUS_WARNING, cooldownTag: 'Cooldown.Rupture' },
    { id: 'l-vanish', slot: 4, abilityName: 'Vanish', iconColor: STATUS_SUBDUED, cooldownTag: 'Cooldown.Vanish' },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   6. SUMMON — conjure minion with linked lifetime
   ══════════════════════════════════════════════════════════════════════════ */

const SUMMON: GASTemplate = {
  id: 'summon',
  name: 'Summon Minion',
  description: 'Conjure a minion with its own HP pool and linked lifetime. Includes minion command abilities, unsummon, and sacrifice-for-burst mechanics.',
  icon: '\u{1F47B}',
  color: ACCENT_CYAN,
  tags: ['summon', 'minion', 'pet', 'command'],
  attributes: [
    ...BASE_VITALS,
    { id: 'a-int', name: 'Intelligence', category: 'primary', defaultValue: 20 },
    { id: 'a-spellpow', name: 'SpellPower', category: 'combat', defaultValue: 20, clampMin: 0 },
    { id: 'a-minionhp', name: 'MinionHealth', category: 'combat', defaultValue: 80, clampMin: 0 },
    { id: 'a-minionatk', name: 'MinionAttack', category: 'combat', defaultValue: 10, clampMin: 0 },
    { id: 'a-minioncount', name: 'MinionCount', category: 'combat', defaultValue: 0, clampMin: 0, clampMax: '3' },
  ],
  relationships: [
    ...BASE_RELATIONSHIPS,
    { id: 'r-int-sp', sourceId: 'a-int', targetId: 'a-spellpow', type: 'scale', formula: 'SpellPower += Intelligence * 2.5' },
    { id: 'r-sp-mhp', sourceId: 'a-spellpow', targetId: 'a-minionhp', type: 'scale', formula: 'MinionHealth += SpellPower * 3' },
    { id: 'r-sp-matk', sourceId: 'a-spellpow', targetId: 'a-minionatk', type: 'scale', formula: 'MinionAttack += SpellPower * 0.5' },
  ],
  effects: [
    { id: 'e-summon', name: 'GE_SummonMinion', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_CYAN, modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: -30 }, { attribute: 'MinionCount', operation: 'add', magnitude: 1 }], grantedTags: ['State.HasMinion'] },
    { id: 'e-minion-life', name: 'GE_MinionLifetime', duration: 'duration', durationSec: 30, cooldownSec: 0, color: MODULE_COLORS.core, modifiers: [], grantedTags: ['State.MinionActive'] },
    { id: 'e-command-atk', name: 'GE_CommandAttack', duration: 'duration', durationSec: 3, cooldownSec: 0, color: STATUS_ERROR, modifiers: [{ attribute: 'MinionAttack', operation: 'multiply', magnitude: 1.5 }], grantedTags: ['State.MinionAggressive'] },
    { id: 'e-sacrifice', name: 'GE_Sacrifice', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_VIOLET, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 80 }, { attribute: 'MinionCount', operation: 'add', magnitude: -1 }], grantedTags: [] },
    { id: 'e-unsummon', name: 'GE_Unsummon', duration: 'instant', durationSec: 0, cooldownSec: 0, color: STATUS_SUBDUED, modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: 15 }, { attribute: 'MinionCount', operation: 'add', magnitude: -1 }], grantedTags: [] },
  ],
  tagRules: [
    DEAD_BLOCKS_ALL,
    STUN_BLOCKS_ALL,
    { id: 't-max-minions', sourceTag: 'State.MinionCapped', targetTag: 'Ability.Summon', type: 'blocks' },
    { id: 't-cmd-req', sourceTag: 'State.HasMinion', targetTag: 'Ability.CommandAttack', type: 'requires' },
    { id: 't-sac-req', sourceTag: 'State.HasMinion', targetTag: 'Ability.Sacrifice', type: 'requires' },
    { id: 't-cd-summon', sourceTag: 'Cooldown.Summon', targetTag: 'Ability.Summon', type: 'blocks' },
  ],
  loadout: [
    { id: 'l-summon', slot: 1, abilityName: 'SummonMinion', iconColor: ACCENT_CYAN, cooldownTag: 'Cooldown.Summon' },
    { id: 'l-cmd', slot: 2, abilityName: 'CommandAttack', iconColor: STATUS_ERROR, cooldownTag: 'Cooldown.CommandAttack' },
    { id: 'l-sac', slot: 3, abilityName: 'Sacrifice', iconColor: ACCENT_VIOLET, cooldownTag: 'Cooldown.Sacrifice' },
    { id: 'l-bolt', slot: 4, abilityName: 'ArcaneBolt', iconColor: MODULE_COLORS.core, cooldownTag: 'Cooldown.ArcaneBolt' },
  ],
};

/* ── Export all templates ──────────────────────────────────────────────── */

export const GAS_TEMPLATES: GASTemplate[] = [
  MELEE_COMBO,
  PROJECTILE_SPELL,
  CHANNELED_ABILITY,
  AURA_BUFF,
  DAMAGE_OVER_TIME,
  SUMMON,
];
