/**
 * Preset archetype templates for the GAS Blueprint Editor.
 *
 * Each template provides production-quality seed data matching UE5 GAS conventions
 * for a common ARPG ability archetype.
 *
 * Split across two files:
 *   templates.ts        - interface, shared base data, melee / projectile / channel
 *   template-presets.ts - aura / DoT / summon + combined GAS_TEMPLATES export
 */

import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_ORANGE,
  MODULE_COLORS, STATUS_SUBDUED,
} from '@/lib/chart-colors';
import type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';
import type { AttrRelationship } from './types';

/* ── Template definition ──────────────────────────────────────────────── */

export interface GASTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  loadout: GASLoadoutSlot[];
}

/* ── Shared base data ─────────────────────────────────────────────────── */

export const BASE_VITALS: EditorAttribute[] = [
  { id: 'a-indmg', name: 'IncomingDamage', category: 'meta', defaultValue: 0 },
  { id: 'a-inheal', name: 'IncomingHeal', category: 'meta', defaultValue: 0 },
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100, clampMin: 0, clampMax: 'MaxHealth' },
  { id: 'a-maxhp', name: 'MaxHealth', category: 'vital', defaultValue: 100, clampMin: 1 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50, clampMin: 0, clampMax: 'MaxMana' },
  { id: 'a-maxmp', name: 'MaxMana', category: 'vital', defaultValue: 50, clampMin: 0 },
];

export const BASE_RELATIONSHIPS: AttrRelationship[] = [
  { id: 'r-dmg', sourceId: 'a-indmg', targetId: 'a-hp', type: 'clamp', formula: 'Health -= IncomingDamage' },
  { id: 'r-heal', sourceId: 'a-inheal', targetId: 'a-hp', type: 'clamp', formula: 'Health += IncomingHeal' },
  { id: 'r-hpclamp', sourceId: 'a-maxhp', targetId: 'a-hp', type: 'clamp', formula: 'clamp(0, MaxHealth)' },
  { id: 'r-mpclamp', sourceId: 'a-maxmp', targetId: 'a-mp', type: 'clamp', formula: 'clamp(0, MaxMana)' },
];

export const DEAD_BLOCKS_ALL: TagRule = { id: 't-dead', sourceTag: 'State.Dead', targetTag: 'Ability.*', type: 'blocks' };
export const STUN_BLOCKS_ALL: TagRule = { id: 't-stun', sourceTag: 'State.Stunned', targetTag: 'Ability.*', type: 'blocks' };

/* ── 1. Melee Combo ───────────────────────────────────────────────────── */

export const MELEE_COMBO: GASTemplate = {
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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

/* ── 2. Projectile Spell ──────────────────────────────────────────────── */

export const PROJECTILE_SPELL: GASTemplate = {
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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

/* ── 3. Channeled Ability ─────────────────────────────────────────────── */

export const CHANNELED_ABILITY: GASTemplate = {
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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

export { GAS_TEMPLATES } from './template-presets';
