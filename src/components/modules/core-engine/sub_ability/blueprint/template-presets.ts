/**
 * Additional GAS archetype templates (aura, DoT, summon) and the combined
 * GAS_TEMPLATES export.
 *
 * Split from templates.ts to keep every file under 200 lines.
 */

import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
  ACCENT_RED, MODULE_COLORS, STATUS_SUBDUED,
} from '@/lib/chart-colors';
import {
  type GASTemplate,
  BASE_VITALS, BASE_RELATIONSHIPS,
  DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
  MELEE_COMBO, PROJECTILE_SPELL, CHANNELED_ABILITY,
} from './templates';

/* ── 4. Aura Buff ─────────────────────────────────────────────────────── */

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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

/* ── 5. Damage Over Time ──────────────────────────────────────────────── */

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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

/* ── 6. Summon Minion ─────────────────────────────────────────────────── */

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
    DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
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

/* ── Export all ────────────────────────────────────────────────────────── */

export const GAS_TEMPLATES: GASTemplate[] = [
  MELEE_COMBO,
  PROJECTILE_SPELL,
  CHANNELED_ABILITY,
  AURA_BUFF,
  DAMAGE_OVER_TIME,
  SUMMON,
];
