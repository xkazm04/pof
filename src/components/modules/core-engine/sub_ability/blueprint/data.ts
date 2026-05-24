/**
 * Types, constants, and seed data for the GAS Blueprint Editor.
 *
 * Re-exports canonical types from @/lib/gas-codegen and adds editor-specific
 * interfaces (relationships, graph nodes, wires, validation).
 */

import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  ACCENT_RED, ACCENT_EMERALD_DARK, STATUS_STALE, STATUS_SUBDUED,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { AttrCategory, EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';
import type { AttrRelationship } from './types';

export type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot, AttrCategory };

export const ACCENT = MODULE_COLORS.systems;

/* ── Category → colour mapping ─────────────────────────────────────────── */

export const CAT_COLORS: Record<AttrCategory, string> = {
  meta: ACCENT_CYAN,
  vital: STATUS_SUCCESS,
  primary: ACCENT_VIOLET,
  combat: ACCENT_ORANGE,
  progression: MODULE_COLORS.core,
};

/* ── Duration picker options ───────────────────────────────────────────── */

export const DURATION_OPTIONS = [
  { id: 'instant', label: 'Instant' },
  { id: 'duration', label: 'Duration' },
  { id: 'infinite', label: 'Infinite' },
];

/* ── Wiring graph constants ────────────────────────────────────────────── */

export const NODE_W_GRAPH = 140;
export const NODE_H_GRAPH = 28;
export const PIN_R = 3.5;

/* ── Editor panels ─────────────────────────────────────────────────────── */

export type EditorPanel =
  | 'wiring'
  | 'relationships'
  | 'effects'
  | 'tags'
  | 'loadout'
  | 'simulate'
  | 'codegen';

/** Breadcrumb path per panel -- maps to UE5 class hierarchy */
export const PANEL_BREADCRUMBS: Record<EditorPanel, string[]> = {
  wiring: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Data Pipeline'],
  relationships: ['AARPGCharacterBase', 'UARPGAttributeSet', 'Dependencies'],
  effects: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'UGameplayEffect'],
  tags: ['AARPGCharacterBase', 'FGameplayTagContainer', 'Rules'],
  loadout: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Loadout Slots'],
  simulate: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Simulation Sandbox'],
  codegen: ['AARPGCharacterBase', 'Generated C++'],
};

/* ── Seed data from real C++ ARPGAttributeSet / ARPGGameplayTags ──────── */

export const SEED_ATTRIBUTES: EditorAttribute[] = [
  { id: 'a-indmg', name: 'IncomingDamage', category: 'meta', defaultValue: 0 },
  { id: 'a-incrit', name: 'IncomingCrit', category: 'meta', defaultValue: 0 },
  { id: 'a-inheal', name: 'IncomingHeal', category: 'meta', defaultValue: 0 },
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100, clampMin: 0, clampMax: 'MaxHealth' },
  { id: 'a-maxhp', name: 'MaxHealth', category: 'vital', defaultValue: 100, clampMin: 1 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50, clampMin: 0, clampMax: 'MaxMana' },
  { id: 'a-maxmp', name: 'MaxMana', category: 'vital', defaultValue: 50, clampMin: 0 },
  { id: 'a-str', name: 'Strength', category: 'primary', defaultValue: 10 },
  { id: 'a-dex', name: 'Dexterity', category: 'primary', defaultValue: 10 },
  { id: 'a-int', name: 'Intelligence', category: 'primary', defaultValue: 10 },
  { id: 'a-armor', name: 'Armor', category: 'combat', defaultValue: 0, clampMin: 0 },
  { id: 'a-atkpow', name: 'AttackPower', category: 'combat', defaultValue: 10, clampMin: 0 },
  { id: 'a-crit', name: 'CriticalChance', category: 'combat', defaultValue: 0.05, clampMin: 0, clampMax: '1.0' },
  { id: 'a-critdmg', name: 'CriticalDamage', category: 'combat', defaultValue: 1.5, clampMin: 1 },
  { id: 'a-xp', name: 'CurrentXP', category: 'progression', defaultValue: 0, clampMin: 0 },
  { id: 'a-xpnext', name: 'XPToNextLevel', category: 'progression', defaultValue: 100, clampMin: 1 },
  { id: 'a-level', name: 'CharacterLevel', category: 'progression', defaultValue: 1, clampMin: 1, clampMax: '50' },
];

export const SEED_RELATIONSHIPS: AttrRelationship[] = [
  { id: 'r1', sourceId: 'a-indmg', targetId: 'a-hp', type: 'clamp', formula: 'Health -= IncomingDamage' },
  { id: 'r2', sourceId: 'a-inheal', targetId: 'a-hp', type: 'clamp', formula: 'Health += IncomingHeal' },
  { id: 'r3', sourceId: 'a-maxhp', targetId: 'a-hp', type: 'clamp', formula: 'clamp(0, MaxHealth)' },
  { id: 'r4', sourceId: 'a-maxmp', targetId: 'a-mp', type: 'clamp', formula: 'clamp(0, MaxMana)' },
  { id: 'r5', sourceId: 'a-int', targetId: 'a-maxmp', type: 'scale', formula: 'MaxMana += Intelligence * 5' },
  { id: 'r6', sourceId: 'a-str', targetId: 'a-atkpow', type: 'scale', formula: 'AttackPower += Strength * 2' },
];

export const SEED_EFFECTS: EditorEffect[] = [
  { id: 'e1', name: 'GE_Damage', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_RED, modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 0 }], grantedTags: [] },
  { id: 'e2', name: 'GE_Heal', duration: 'instant', durationSec: 0, cooldownSec: 0, color: ACCENT_EMERALD_DARK, modifiers: [{ attribute: 'IncomingHeal', operation: 'add', magnitude: 25 }], grantedTags: [] },
  { id: 'e3', name: 'GE_Regen_Health', duration: 'infinite', durationSec: 0, cooldownSec: 2, color: STATUS_STALE, modifiers: [{ attribute: 'Health', operation: 'add', magnitude: 5 }], grantedTags: [] },
  { id: 'e4', name: 'GE_Buff_WarCry', duration: 'duration', durationSec: 15, cooldownSec: 0, color: MODULE_COLORS.core, modifiers: [{ attribute: 'AttackPower', operation: 'add', magnitude: 20 }, { attribute: 'Armor', operation: 'add', magnitude: 15 }], grantedTags: ['State.Buffed.WarCry'] },
  { id: 'e5', name: 'GE_Stun', duration: 'duration', durationSec: 2, cooldownSec: 0, color: MODULE_COLORS.content, modifiers: [], grantedTags: ['State.Stunned'] },
];

export const SEED_TAG_RULES: TagRule[] = [
  { id: 't1', sourceTag: 'State.Dead', targetTag: 'Ability.*', type: 'blocks' },
  { id: 't2', sourceTag: 'State.Stunned', targetTag: 'Ability.*', type: 'blocks' },
  { id: 't3', sourceTag: 'State.Invulnerable', targetTag: 'Damage.*', type: 'blocks' },
  { id: 't4', sourceTag: 'State.Attacking', targetTag: 'Ability.Melee.*', type: 'blocks' },
  { id: 't5', sourceTag: 'Cooldown.Fireball', targetTag: 'Ability.Fireball', type: 'blocks' },
];

export const SEED_LOADOUT: GASLoadoutSlot[] = [
  { id: 'l1', slot: 1, abilityName: 'Fireball', iconColor: ACCENT_RED, cooldownTag: 'Cooldown.Fireball' },
  { id: 'l2', slot: 2, abilityName: 'GroundSlam', iconColor: ACCENT_EMERALD_DARK, cooldownTag: 'Cooldown.GroundSlam' },
  { id: 'l3', slot: 3, abilityName: 'DashStrike', iconColor: ACCENT_CYAN, cooldownTag: 'Cooldown.DashStrike' },
  { id: 'l4', slot: 4, abilityName: 'WarCry', iconColor: STATUS_WARNING, cooldownTag: 'Cooldown.WarCry' },
];
