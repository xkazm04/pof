import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { Activity, Play, RefreshCw, Cpu } from 'lucide-react';
import type { HeatmapCell, GaugeMetric, TimelineEvent } from '@/types/unique-tab-improvements';
import type { LucideIcon } from 'lucide-react';

export const ACCENT = ACCENT_VIOLET;

/* ── Subtab definitions ──────────────────────────────────────────────────── */

export type AnimSubtab = 'features' | 'state-graph' | 'combos-montages' | 'retargeting' | 'budget';

export interface AnimSubtabDef {
  key: AnimSubtab;
  label: string;
  icon: LucideIcon;
  narrative: string;
  subtitle: string;
}

export const ANIM_SUBTABS: AnimSubtabDef[] = [
  { key: 'state-graph', label: 'State Graph & Transitions', icon: Activity, narrative: 'Define States', subtitle: 'State machine, blend spaces, transitions & responsiveness' },
  { key: 'combos-montages', label: 'Combos & Montages', icon: Play, narrative: 'Chain Actions', subtitle: 'Combo timelines, montage scrubbing & event notifies' },
  { key: 'retargeting', label: 'Retargeting & Trajectories', icon: RefreshCw, narrative: 'Port Across Skeletons', subtitle: 'Skeleton retargeting pipeline & root motion paths' },
  { key: 'budget', label: 'Budget & Assets', icon: Cpu, narrative: 'Budget Check', subtitle: 'Memory budgets, asset counts & category breakdown' },
];

/* ── Montage category types ───────────────────────────────────────────────── */

export type MontageCategory = 'Attack' | 'Dodge' | 'HitReact' | 'Death' | 'Idle' | 'Locomotion' | 'Ability' | 'Emote';

export interface MontageEntry {
  id: string;
  name: string;
  category: MontageCategory;
  totalFrames: number;
  fps: number;
  memorySizeMB: number;
  hasRootMotion: boolean;
  blendInTime: number;
}

function m(id: string, name: string, category: MontageCategory, totalFrames: number, fps: number, memorySizeMB: number, hasRootMotion: boolean, blendInTime: number): MontageEntry {
  return { id, name, category, totalFrames, fps, memorySizeMB, hasRootMotion, blendInTime };
}

export const ALL_MONTAGES: MontageEntry[] = [
  // Attack (20)
  m('atk-combo1', 'AM_Combo1', 'Attack', 30, 30, 1.2, true, 0.05),
  m('atk-combo2', 'AM_Combo2', 'Attack', 36, 30, 1.3, true, 0.05),
  m('atk-combo3', 'AM_Combo3', 'Attack', 45, 30, 1.5, true, 0.08),
  m('atk-heavy', 'AM_HeavyAttack', 'Attack', 50, 30, 1.8, true, 0.08),
  m('atk-uppercut', 'AM_Uppercut', 'Attack', 28, 30, 1.1, true, 0.05),
  m('atk-spin', 'AM_SpinSlash', 'Attack', 40, 30, 1.6, true, 0.06),
  m('atk-thrust', 'AM_Thrust', 'Attack', 32, 30, 1.2, true, 0.05),
  m('atk-slam', 'AM_GroundSlam', 'Attack', 55, 30, 2.0, true, 0.10),
  m('atk-leapstrike', 'AM_LeapStrike', 'Attack', 48, 30, 1.9, true, 0.08),
  m('atk-backstab', 'AM_Backstab', 'Attack', 35, 30, 1.4, true, 0.05),
  m('atk-riposte', 'AM_Riposte', 'Attack', 38, 30, 1.3, true, 0.06),
  m('atk-parry', 'AM_ParryStrike', 'Attack', 25, 30, 1.0, false, 0.04),
  m('atk-charge', 'AM_ChargedSwing', 'Attack', 60, 30, 2.2, true, 0.12),
  m('atk-dualslash', 'AM_DualSlash', 'Attack', 34, 30, 1.4, true, 0.05),
  m('atk-kick', 'AM_RoundKick', 'Attack', 22, 30, 0.9, true, 0.04),
  m('atk-pommel', 'AM_PommelStrike', 'Attack', 20, 30, 0.8, false, 0.03),
  m('atk-cleave', 'AM_Cleave', 'Attack', 42, 30, 1.7, true, 0.07),
  m('atk-sweeplow', 'AM_LowSweep', 'Attack', 30, 30, 1.2, true, 0.05),
  m('atk-aerial', 'AM_AerialSlash', 'Attack', 50, 30, 2.1, true, 0.10),
  m('atk-execute', 'AM_Execute', 'Attack', 70, 30, 2.8, true, 0.15),

  // Dodge (12)
  m('dodge-fwd', 'AM_DodgeFwd', 'Dodge', 15, 30, 0.6, true, 0.03),
  m('dodge-back', 'AM_DodgeBack', 'Dodge', 15, 30, 0.6, true, 0.03),
  m('dodge-left', 'AM_DodgeLeft', 'Dodge', 15, 30, 0.6, true, 0.03),
  m('dodge-right', 'AM_DodgeRight', 'Dodge', 15, 30, 0.6, true, 0.03),
  m('dodge-roll', 'AM_DodgeRoll', 'Dodge', 24, 30, 0.9, true, 0.04),
  m('dodge-slide', 'AM_SlideEvade', 'Dodge', 20, 30, 0.7, true, 0.03),
  m('dodge-sprint', 'AM_SprintDodge', 'Dodge', 18, 30, 0.7, true, 0.04),
  m('dodge-aerial', 'AM_AerialDodge', 'Dodge', 22, 30, 0.8, true, 0.05),
  m('dodge-backstep', 'AM_Backstep', 'Dodge', 12, 30, 0.5, true, 0.02),
  m('dodge-sidestep-l', 'AM_SidestepL', 'Dodge', 10, 30, 0.4, true, 0.02),
  m('dodge-sidestep-r', 'AM_SidestepR', 'Dodge', 10, 30, 0.4, true, 0.02),
  m('dodge-iframes', 'AM_IFrameDodge', 'Dodge', 16, 30, 0.6, true, 0.03),

  // HitReact (10)
  m('hit-light', 'AM_HitReactLight', 'HitReact', 12, 30, 0.4, false, 0.0),
  m('hit-heavy', 'AM_HitReactHeavy', 'HitReact', 18, 30, 0.6, false, 0.0),
  m('hit-stagger', 'AM_Stagger', 'HitReact', 24, 30, 0.8, true, 0.0),
  m('hit-knockback', 'AM_Knockback', 'HitReact', 30, 30, 1.0, true, 0.0),
  m('hit-knockdown', 'AM_Knockdown', 'HitReact', 40, 30, 1.3, true, 0.0),
  m('hit-launch', 'AM_Launch', 'HitReact', 35, 30, 1.2, true, 0.0),
  m('hit-block', 'AM_BlockImpact', 'HitReact', 10, 30, 0.3, false, 0.0),
  m('hit-parried', 'AM_Parried', 'HitReact', 20, 30, 0.7, false, 0.0),
  m('hit-guardbreak', 'AM_GuardBreak', 'HitReact', 28, 30, 0.9, false, 0.0),
  m('hit-stumble', 'AM_Stumble', 'HitReact', 16, 30, 0.5, true, 0.0),

  // Death (6)
  m('death-fwd', 'AM_DeathFwd', 'Death', 45, 30, 1.5, true, 0.0),
  m('death-back', 'AM_DeathBack', 'Death', 45, 30, 1.5, true, 0.0),
  m('death-left', 'AM_DeathLeft', 'Death', 40, 30, 1.3, true, 0.0),
  m('death-right', 'AM_DeathRight', 'Death', 40, 30, 1.3, true, 0.0),
  m('death-explode', 'AM_DeathExplode', 'Death', 55, 30, 2.0, true, 0.0),
  m('death-dissolve', 'AM_DeathDissolve', 'Death', 60, 30, 1.8, false, 0.0),

  // Idle (8)
  m('idle-default', 'AM_IdleDefault', 'Idle', 90, 30, 0.8, false, 0.10),
  m('idle-combat', 'AM_IdleCombat', 'Idle', 60, 30, 0.6, false, 0.08),
  m('idle-tired', 'AM_IdleTired', 'Idle', 120, 30, 1.0, false, 0.10),
  m('idle-fidget1', 'AM_IdleFidget1', 'Idle', 90, 30, 0.7, false, 0.10),
  m('idle-fidget2', 'AM_IdleFidget2', 'Idle', 80, 30, 0.6, false, 0.10),
  m('idle-sheathe', 'AM_IdleSheathe', 'Idle', 45, 30, 0.5, false, 0.08),
  m('idle-draw', 'AM_IdleDraw', 'Idle', 40, 30, 0.5, false, 0.06),
  m('idle-lookback', 'AM_IdleLookBack', 'Idle', 60, 30, 0.5, false, 0.10),

  // Locomotion (10)
  m('loco-walk', 'AM_Walk', 'Locomotion', 30, 30, 0.8, true, 0.05),
  m('loco-run', 'AM_Run', 'Locomotion', 24, 30, 0.9, true, 0.05),
  m('loco-sprint', 'AM_Sprint', 'Locomotion', 20, 30, 1.0, true, 0.05),
  m('loco-crouch', 'AM_CrouchWalk', 'Locomotion', 36, 30, 0.7, true, 0.06),
  m('loco-jump', 'AM_Jump', 'Locomotion', 25, 30, 0.8, true, 0.04),
  m('loco-land', 'AM_Land', 'Locomotion', 12, 30, 0.4, false, 0.03),
  m('loco-fall', 'AM_Fall', 'Locomotion', 30, 30, 0.5, false, 0.0),
  m('loco-climb', 'AM_Climb', 'Locomotion', 40, 30, 1.2, true, 0.08),
  m('loco-swim', 'AM_Swim', 'Locomotion', 36, 30, 1.0, true, 0.06),
  m('loco-slide', 'AM_Slide', 'Locomotion', 18, 30, 0.6, true, 0.04),

  // Ability (12)
  m('abl-forcepush', 'AM_ForcePush', 'Ability', 25, 30, 1.1, false, 0.10),
  m('abl-saberthrow', 'AM_SaberThrow', 'Ability', 40, 30, 1.5, false, 0.15),
  m('abl-lightning', 'AM_ForceLightning', 'Ability', 60, 30, 2.0, false, 0.20),
  m('abl-heal', 'AM_ForceHeal', 'Ability', 45, 30, 1.2, false, 0.25),
  m('abl-shield', 'AM_ForceShield', 'Ability', 30, 30, 1.0, false, 0.10),
  m('abl-teleport', 'AM_Teleport', 'Ability', 20, 30, 0.8, false, 0.05),
  m('abl-mindtrick', 'AM_MindTrick', 'Ability', 35, 30, 1.1, false, 0.12),
  m('abl-choke', 'AM_ForceChoke', 'Ability', 50, 30, 1.4, false, 0.15),
  m('abl-pull', 'AM_ForcePull', 'Ability', 22, 30, 0.9, false, 0.08),
  m('abl-wave', 'AM_ForceWave', 'Ability', 35, 30, 1.3, true, 0.10),
  m('abl-meteor', 'AM_MeteorStrike', 'Ability', 65, 30, 2.5, true, 0.15),
  m('abl-summon', 'AM_SummonCompanion', 'Ability', 55, 30, 1.8, false, 0.20),

  // Emote (8)
  m('emote-wave', 'AM_EmoteWave', 'Emote', 60, 30, 0.5, false, 0.10),
  m('emote-bow', 'AM_EmoteBow', 'Emote', 50, 30, 0.4, false, 0.10),
  m('emote-cheer', 'AM_EmoteCheer', 'Emote', 70, 30, 0.6, false, 0.10),
  m('emote-sit', 'AM_EmoteSit', 'Emote', 90, 30, 0.7, false, 0.15),
  m('emote-dance', 'AM_EmoteDance', 'Emote', 120, 30, 0.9, false, 0.10),
  m('emote-taunt', 'AM_EmoteTaunt', 'Emote', 60, 30, 0.5, false, 0.10),
  m('emote-point', 'AM_EmotePoint', 'Emote', 40, 30, 0.3, false, 0.08),
  m('emote-salute', 'AM_EmoteSalute', 'Emote', 45, 30, 0.4, false, 0.10),
];

/** Category display order. */
export const MONTAGE_CATEGORIES: MontageCategory[] = ['Attack', 'Dodge', 'HitReact', 'Death', 'Idle', 'Locomotion', 'Ability', 'Emote'];

/** Montage count per category. */
export const MONTAGE_CATEGORY_COUNTS: Record<MontageCategory, number> = (() => {
  const counts = {} as Record<MontageCategory, number>;
  for (const cat of MONTAGE_CATEGORIES) counts[cat] = 0;
  for (const m of ALL_MONTAGES) counts[m.category]++;
  return counts;
})();

/** Total memory per category. */
export const MONTAGE_CATEGORY_MEMORY: Record<MontageCategory, number> = (() => {
  const mem = {} as Record<MontageCategory, number>;
  for (const cat of MONTAGE_CATEGORIES) mem[cat] = 0;
  for (const m of ALL_MONTAGES) mem[m.category] += m.memorySizeMB;
  return mem;
})();

/** Total memory across all montages. */
export const TOTAL_MONTAGE_MEMORY = ALL_MONTAGES.reduce((s, m) => s + m.memorySizeMB, 0);

/* ── State machine nodes ───────────────────────────────────────────────────── */

export interface StateNode {
  name: string;
  featureName: string;
  ref: string;
  transitions: { to: string; label: string }[];
}

export type StateGroup = 'Movement' | 'Combat' | 'Reaction' | 'Ability' | 'Social' | 'Traversal';

export interface StateGroupDef {
  group: StateGroup;
  states: string[];
}

export const STATE_GROUPS: StateGroupDef[] = [
  { group: 'Movement', states: ['Locomotion', 'Dodging', 'Sprinting', 'Crouching', 'Jumping', 'Falling', 'Landing', 'Sliding'] },
  { group: 'Combat', states: ['Attacking', 'Blocking', 'Parrying', 'AimingRanged', 'ChargedAttack', 'ComboFinisher'] },
  { group: 'Reaction', states: ['HitReact', 'Death', 'Stagger', 'Knockdown', 'Knockback', 'Launched', 'GuardBroken'] },
  { group: 'Ability', states: ['CastingAbility', 'Channeling', 'AbilityRecovery', 'Teleporting'] },
  { group: 'Social', states: ['Emoting', 'Interacting', 'Sitting'] },
  { group: 'Traversal', states: ['Climbing', 'Swimming', 'Vaulting', 'WallRunning'] },
];

export const STATE_NODES: StateNode[] = [
  // Movement
  { name: 'Locomotion', featureName: 'Locomotion Blend Space', ref: 'BS_Locomotion1D',
    transitions: [{ to: 'Attacking', label: 'Input.Attack' }, { to: 'Dodging', label: 'Input.Dodge' }, { to: 'HitReact', label: 'State.Hit' }, { to: 'Death', label: 'bIsDead' }, { to: 'Sprinting', label: 'Input.Sprint' }, { to: 'CastingAbility', label: 'Input.Ability' }] },
  { name: 'Dodging', featureName: 'Root motion toggle', ref: 'AM_Dodge',
    transitions: [{ to: 'Locomotion', label: 'Montage ends' }, { to: 'Attacking', label: 'Cancel window' }] },
  { name: 'Sprinting', featureName: 'Sprint movement', ref: 'BS_Sprint',
    transitions: [{ to: 'Locomotion', label: 'Release sprint' }, { to: 'Sliding', label: 'Input.Crouch' }, { to: 'Attacking', label: 'Input.Attack' }] },
  { name: 'Crouching', featureName: 'Crouch movement', ref: 'BS_Crouch',
    transitions: [{ to: 'Locomotion', label: 'Release crouch' }, { to: 'Attacking', label: 'Input.Attack' }] },
  { name: 'Jumping', featureName: 'Jump system', ref: 'AM_Jump',
    transitions: [{ to: 'Falling', label: 'Apex reached' }, { to: 'Attacking', label: 'Input.Attack' }] },
  { name: 'Falling', featureName: 'Fall handling', ref: 'BS_Fall',
    transitions: [{ to: 'Landing', label: 'Ground hit' }, { to: 'HitReact', label: 'State.Hit' }] },
  { name: 'Landing', featureName: 'Land recovery', ref: 'AM_Land',
    transitions: [{ to: 'Locomotion', label: 'Recovered' }] },
  { name: 'Sliding', featureName: 'Slide movement', ref: 'AM_Slide',
    transitions: [{ to: 'Locomotion', label: 'Slide ends' }, { to: 'Crouching', label: 'Slide decel' }] },

  // Combat
  { name: 'Attacking', featureName: 'Attack montages', ref: 'AM_Melee_Combo',
    transitions: [{ to: 'Locomotion', label: 'Montage ends' }, { to: 'Dodging', label: 'Input.Dodge' }, { to: 'HitReact', label: 'State.Hit' }, { to: 'ComboFinisher', label: 'Combo.Full' }] },
  { name: 'Blocking', featureName: 'Block system', ref: 'AM_Block',
    transitions: [{ to: 'Locomotion', label: 'Release block' }, { to: 'Parrying', label: 'Perfect timing' }, { to: 'GuardBroken', label: 'Stamina depleted' }] },
  { name: 'Parrying', featureName: 'Parry system', ref: 'AM_Parry',
    transitions: [{ to: 'Attacking', label: 'Riposte window' }, { to: 'Locomotion', label: 'No riposte' }] },
  { name: 'AimingRanged', featureName: 'Ranged aim', ref: 'AO_AimOffset',
    transitions: [{ to: 'Attacking', label: 'Input.Fire' }, { to: 'Locomotion', label: 'Cancel aim' }] },
  { name: 'ChargedAttack', featureName: 'Charged attack', ref: 'AM_ChargeLoop',
    transitions: [{ to: 'Attacking', label: 'Release charge' }, { to: 'Locomotion', label: 'Cancel charge' }] },
  { name: 'ComboFinisher', featureName: 'Combo finisher', ref: 'AM_Finisher',
    transitions: [{ to: 'Locomotion', label: 'Montage ends' }] },

  // Reaction
  { name: 'HitReact', featureName: 'Animation state machine', ref: 'AM_HitReact',
    transitions: [{ to: 'Locomotion', label: 'Recover' }, { to: 'Death', label: 'HP <= 0' }, { to: 'Stagger', label: 'Heavy hit' }] },
  { name: 'Death', featureName: 'Animation state machine', ref: 'AM_Death', transitions: [] },
  { name: 'Stagger', featureName: 'Stagger system', ref: 'AM_Stagger',
    transitions: [{ to: 'Locomotion', label: 'Recover' }, { to: 'Knockdown', label: 'Poise break' }] },
  { name: 'Knockdown', featureName: 'Knockdown system', ref: 'AM_Knockdown',
    transitions: [{ to: 'Locomotion', label: 'GetUp montage' }] },
  { name: 'Knockback', featureName: 'Knockback system', ref: 'AM_Knockback',
    transitions: [{ to: 'Locomotion', label: 'Recover' }, { to: 'HitReact', label: 'Wall impact' }] },
  { name: 'Launched', featureName: 'Launch system', ref: 'AM_Launch',
    transitions: [{ to: 'Falling', label: 'Gravity takes over' }] },
  { name: 'GuardBroken', featureName: 'Guard break', ref: 'AM_GuardBreak',
    transitions: [{ to: 'Locomotion', label: 'Recover' }] },

  // Ability
  { name: 'CastingAbility', featureName: 'Ability casting', ref: 'AM_CastAbility',
    transitions: [{ to: 'Channeling', label: 'Hold cast' }, { to: 'AbilityRecovery', label: 'Instant cast' }, { to: 'HitReact', label: 'Interrupted' }] },
  { name: 'Channeling', featureName: 'Channel loop', ref: 'AM_ChannelLoop',
    transitions: [{ to: 'AbilityRecovery', label: 'Release' }, { to: 'HitReact', label: 'Interrupted' }] },
  { name: 'AbilityRecovery', featureName: 'Ability recovery', ref: 'AM_AbilityEnd',
    transitions: [{ to: 'Locomotion', label: 'Recovery ends' }] },
  { name: 'Teleporting', featureName: 'Teleport dash', ref: 'AM_Teleport',
    transitions: [{ to: 'Locomotion', label: 'Arrive' }] },

  // Social
  { name: 'Emoting', featureName: 'Emote system', ref: 'AM_Emote',
    transitions: [{ to: 'Locomotion', label: 'Cancel / end' }] },
  { name: 'Interacting', featureName: 'Interact system', ref: 'AM_Interact',
    transitions: [{ to: 'Locomotion', label: 'Interaction done' }] },
  { name: 'Sitting', featureName: 'Sit system', ref: 'AM_Sit',
    transitions: [{ to: 'Locomotion', label: 'Stand up' }] },

  // Traversal
  { name: 'Climbing', featureName: 'Climb system', ref: 'AM_Climb',
    transitions: [{ to: 'Locomotion', label: 'Reach top' }, { to: 'Falling', label: 'Let go' }] },
  { name: 'Swimming', featureName: 'Swim system', ref: 'BS_Swim',
    transitions: [{ to: 'Locomotion', label: 'Exit water' }] },
  { name: 'Vaulting', featureName: 'Vault system', ref: 'AM_Vault',
    transitions: [{ to: 'Locomotion', label: 'Vault complete' }] },
  { name: 'WallRunning', featureName: 'Wall run', ref: 'AM_WallRun',
    transitions: [{ to: 'Falling', label: 'Detach' }, { to: 'Jumping', label: 'Wall jump' }] },
];

/* ── Montage notify windows ────────────────────────────────────────────────── */

export interface NotifyWindow {
  name: string;
  color: string;
  start: number;
  width: number;
}

export interface ComboSection {
  label: string;
  duration: string;
  windows: NotifyWindow[];
}

export const COMBO_SECTIONS: ComboSection[] = [
  {
    label: 'Montage 1',
    duration: '0.45s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.55, width: 0.3 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.2, width: 0.25 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.2, width: 0.15 },
    ],
  },
  {
    label: 'Montage 2',
    duration: '0.50s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.5, width: 0.35 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.18, width: 0.28 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.18, width: 0.15 },
    ],
  },
  {
    label: 'Montage 3',
    duration: '0.60s',
    windows: [
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.15, width: 0.35 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.15, width: 0.2 },
    ],
  },
];

/* ── Combo definitions ─────────────────────────────────────────────────────── */

export interface ComboDef {
  id: string;
  label: string;
  sectionIds: number[];
  damages?: number[];
}

export const COMBO_DEFS: ComboDef[] = [
  { id: 'basic', label: 'Basic 3-Hit', sectionIds: [0, 1, 2], damages: [25, 35, 60] },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

export const ASSET_FEATURES = [
  'UARPGAnimInstance',
  'Locomotion Blend Space',
  'Attack montages',
  'Anim Notify classes',
  'Motion Warping',
  'Mixamo import & retarget pipeline',
  'Asset automation commandlet',
];

/* ── State Transition Heatmap data ─────────────────────────────────────────── */

export const HEATMAP_STATE_NAMES = ['Locomotion', 'Attacking', 'Dodging', 'HitReact', 'Death'];

export const HEATMAP_CELLS: HeatmapCell[] = [
  { row: 0, col: 1, value: 0.85, label: '.85', tooltip: 'Locomotion \u2192 Attacking: 85%' },
  { row: 0, col: 2, value: 0.6, label: '.60', tooltip: 'Locomotion \u2192 Dodging: 60%' },
  { row: 0, col: 3, value: 0.15, label: '.15', tooltip: 'Locomotion \u2192 HitReact: 15%' },
  { row: 0, col: 4, value: 0.02, label: '.02', tooltip: 'Locomotion \u2192 Death: 2%' },
  { row: 1, col: 0, value: 0.9, label: '.90', tooltip: 'Attacking \u2192 Locomotion: 90%' },
  { row: 1, col: 2, value: 0.25, label: '.25', tooltip: 'Attacking \u2192 Dodging: 25%' },
  { row: 1, col: 3, value: 0.3, label: '.30', tooltip: 'Attacking \u2192 HitReact: 30%' },
  { row: 2, col: 0, value: 0.95, label: '.95', tooltip: 'Dodging \u2192 Locomotion: 95%' },
  { row: 2, col: 1, value: 0.1, label: '.10', tooltip: 'Dodging \u2192 Attacking: 10%' },
  { row: 3, col: 0, value: 0.7, label: '.70', tooltip: 'HitReact \u2192 Locomotion: 70%' },
  { row: 3, col: 4, value: 0.05, label: '.05', tooltip: 'HitReact \u2192 Death: 5%' },
];

/* ── Montage Frame Scrubber data ───────────────────────────────────────────── */

export interface NotifyLane {
  name: string;
  color: string;
  startFrame: number;
  endFrame: number;
}

export const SCRUBBER_LANES: NotifyLane[] = [
  { name: 'HitDetection', color: STATUS_ERROR, startFrame: 6, endFrame: 14 },
  { name: 'ComboWindow', color: ACCENT_CYAN, startFrame: 16, endFrame: 24 },
  { name: 'SpawnVFX', color: STATUS_WARNING, startFrame: 6, endFrame: 10 },
  { name: 'Sound', color: STATUS_INFO, startFrame: 3, endFrame: 5 },
];

export const SCRUBBER_TOTAL_FRAMES = 30;

/* ── Blend Space Visualizer data ───────────────────────────────────────────── */

export interface BlendClip {
  name: string;
  x: number;
  y: number;
}

export const BLEND_CLIPS: BlendClip[] = [
  { name: 'Idle', x: 0, y: 0 },
  { name: 'WalkFwd', x: 0, y: 0.3 },
  { name: 'RunFwd', x: 0, y: 0.7 },
  { name: 'WalkLeft', x: -90, y: 0.3 },
  { name: 'WalkRight', x: 90, y: 0.3 },
  { name: 'WalkBack', x: 180, y: 0.3 },
];

export const BLEND_CURRENT = { x: 15, y: 0.5 };

/* ── Animation Budget Tracker data ─────────────────────────────────────────── */

export const BUDGET_GAUGES: GaugeMetric[] = [
  { label: 'Montage Slots', current: 2, target: 4, unit: '' },
  { label: 'Blend Depth', current: 3, target: 8, unit: '' },
  { label: 'Active IK', current: 1, target: 4, unit: '' },
  { label: 'Bone Count', current: 65, target: 120, unit: '' },
];

/* ── Combo Chain Graph Editor data ─────────────────────────────────────────── */

export interface ComboNode {
  id: string;
  name: string;
  montage: string;
  damage: number;
  x: number;
  y: number;
}

export const COMBO_CHAIN_NODES: ComboNode[] = [
  { id: 'atk1', name: 'Light Slash', montage: 'AM_Combo1', damage: 25, x: 44, y: 47 },
  { id: 'atk2', name: 'Cross Cut', montage: 'AM_Combo2', damage: 35, x: 178, y: 47 },
  { id: 'atk3', name: 'Heavy Finisher', montage: 'AM_Combo3', damage: 60, x: 311, y: 47 },
  { id: 'force-push', name: 'Force Push', montage: 'AM_ForcePush', damage: 80, x: 500, y: 100 },
  { id: 'saber-throw', name: 'Saber Throw', montage: 'AM_SaberThrow', damage: 120, x: 600, y: 200 },
  { id: 'force-lightning', name: 'Force Lightning', montage: 'AM_ForceLightning', damage: 200, x: 700, y: 100 },
];

export const COMBO_CHAIN_EDGES = [
  { from: 'atk1', to: 'atk2', window: '0.4-0.6s' },
  { from: 'atk2', to: 'atk3', window: '0.35-0.55s' },
  { from: 'atk3', to: 'force-push', label: 'combo → Force', inputWindow: '200ms' },
  { from: 'force-push', to: 'saber-throw', label: 'Force → ranged', inputWindow: '300ms' },
];

/* ── Root Motion Trajectory data ───────────────────────────────────────────── */

export interface TrajectoryPath {
  name: string;
  color: string;
  points: { x: number; y: number }[];
  distance: string;
}

export const ROOT_MOTION_PATHS: TrajectoryPath[] = [
  {
    name: 'LightAttack',
    color: STATUS_INFO,
    points: [{ x: 60, y: 104 }, { x: 60, y: 92 }, { x: 60, y: 80 }, { x: 60, y: 72 }],
    distance: '40 cm',
  },
  {
    name: 'HeavyAttack',
    color: STATUS_ERROR,
    points: [{ x: 60, y: 104 }, { x: 61, y: 88 }, { x: 62, y: 68 }, { x: 62, y: 48 }, { x: 62, y: 36 }],
    distance: '85 cm',
  },
  {
    name: 'Dodge',
    color: ACCENT_EMERALD,
    points: [{ x: 60, y: 104 }, { x: 58, y: 108 }, { x: 54, y: 112 }, { x: 50, y: 114 }, { x: 44, y: 112 }],
    distance: '55 cm',
  },
];

/* ── Retarget Pipeline data ────────────────────────────────────────────────── */

export interface RetargetStep {
  name: string;
  color: string;
  detail: string;
}

export const RETARGET_PIPELINE_STEPS: RetargetStep[] = [
  { name: 'Import', color: STATUS_SUCCESS, detail: 'Mixamo FBX files imported. 24 animations loaded.' },
  { name: 'Strip', color: STATUS_SUCCESS, detail: 'Bone prefix "mixamorig:" stripped from all bones.' },
  { name: 'Retarget', color: STATUS_WARNING, detail: 'IK Retargeter shows minor foot drift on RunFwd. Acceptable for now.' },
  { name: 'RootMotion', color: STATUS_SUCCESS, detail: 'Root motion extracted and validated for all locomotion clips.' },
  { name: 'Commandlet', color: STATUS_SUCCESS, detail: 'Asset automation ran successfully. All assets cooked.' },
];

/* ── Notify Coverage data ──────────────────────────────────────────────────── */

export interface NotifyCoverageIssue {
  montage: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MontageCoverage {
  montage: string;
  coverage: number;
}

export const NOTIFY_ISSUES: NotifyCoverageIssue[] = [
  { montage: 'AM_HeavyAttack', message: 'Missing HitDetection notify', severity: 'error' },
  { montage: 'AM_Dodge', message: 'No sound notify', severity: 'warning' },
  { montage: 'AM_Combo3', message: 'ComboWindow has no follow-up', severity: 'warning' },
  { montage: 'AM_Death', message: 'No VFX notify', severity: 'warning' },
];

export const MONTAGE_COVERAGES: MontageCoverage[] = [
  { montage: 'AM_Combo1', coverage: 1.0 },
  { montage: 'AM_Combo2', coverage: 1.0 },
  { montage: 'AM_Combo3', coverage: 0.6 },
  { montage: 'AM_HeavyAttack', coverage: 0.3 },
  { montage: 'AM_Dodge', coverage: 0.5 },
  { montage: 'AM_Death', coverage: 0.4 },
];

/* ── State Duration Statistics data ────────────────────────────────────────── */

export interface BoxWhiskerData {
  state: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  hasOutlier?: boolean;
  isInfinite?: boolean;
}

export const STATE_DURATIONS: BoxWhiskerData[] = [
  { state: 'Locomotion', min: 0.5, q1: 2.0, median: 5.0, q3: 10.0, max: 30.0 },
  { state: 'Attacking', min: 0.3, q1: 0.4, median: 0.5, q3: 0.6, max: 1.2 },
  { state: 'Dodging', min: 0.2, q1: 0.3, median: 0.3, q3: 0.35, max: 0.4 },
  { state: 'HitReact', min: 0.1, q1: 0.2, median: 0.3, q3: 0.5, max: 5.0, hasOutlier: true },
  { state: 'Death', min: 0, q1: 0, median: 0, q3: 0, max: 0, isInfinite: true },
];

export const DURATION_SCALE_MAX = 32;

/* ── Animation Event Timeline data ─────────────────────────────────────────── */

export const ANIMATION_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 'evt1', timestamp: 0.0, label: 'Locomotion', category: 'state', color: STATUS_INFO, duration: 2.5 },
  { id: 'evt2', timestamp: 2.5, label: 'Enter Attack', category: 'state', color: STATUS_INFO },
  { id: 'evt3', timestamp: 2.5, label: 'AM_Combo1', category: 'montage', color: STATUS_WARNING, duration: 0.45 },
  { id: 'evt4', timestamp: 2.7, label: 'HitDetect', category: 'notify', color: ACCENT_EMERALD, duration: 0.15 },
  { id: 'evt5', timestamp: 2.85, label: 'ComboWindow', category: 'notify', color: ACCENT_EMERALD, duration: 0.2 },
  { id: 'evt6', timestamp: 2.95, label: 'AM_Combo2', category: 'montage', color: STATUS_WARNING, duration: 0.5 },
  { id: 'evt7', timestamp: 3.2, label: 'HitDetect', category: 'notify', color: ACCENT_EMERALD, duration: 0.18 },
  { id: 'evt8', timestamp: 3.45, label: 'Return Loco', category: 'state', color: STATUS_INFO },
  { id: 'evt9', timestamp: 5.0, label: 'HitReact', category: 'state', color: STATUS_INFO, duration: 0.3 },
  { id: 'evt10', timestamp: 5.3, label: 'Recover', category: 'state', color: STATUS_INFO },
];

/* ── Predictive Responsiveness Analyzer data ───────────────────────────────── */

export type AnimStateName = 'Locomotion' | 'Attacking' | 'Dodging' | 'HitReact' | 'Death';

export interface MontageTiming {
  name: string;
  state: AnimStateName;
  totalFrames: number;
  fps: number;
  cancelWindowStart?: number;
  cancelWindowEnd?: number;
  blendInTime: number;
}

export const MONTAGE_TIMINGS: MontageTiming[] = [
  { name: 'AM_Combo1', state: 'Attacking', totalFrames: 30, fps: 30, cancelWindowStart: 20, cancelWindowEnd: 30, blendInTime: 0.05 },
  { name: 'AM_Combo2', state: 'Attacking', totalFrames: 36, fps: 30, cancelWindowStart: 24, cancelWindowEnd: 36, blendInTime: 0.05 },
  { name: 'AM_Combo3', state: 'Attacking', totalFrames: 45, fps: 30, cancelWindowStart: 30, cancelWindowEnd: 45, blendInTime: 0.08 },
  { name: 'AM_HeavyAttack', state: 'Attacking', totalFrames: 50, fps: 30, cancelWindowStart: 35, cancelWindowEnd: 50, blendInTime: 0.08 },
  { name: 'AM_Dodge', state: 'Dodging', totalFrames: 15, fps: 30, cancelWindowStart: 10, cancelWindowEnd: 15, blendInTime: 0.03 },
  { name: 'AM_HitReact', state: 'HitReact', totalFrames: 12, fps: 30, blendInTime: 0.0 },
  { name: 'AM_ForcePush', state: 'Attacking' as AnimStateName, totalFrames: 25, fps: 30, cancelWindowStart: 15, cancelWindowEnd: 20, blendInTime: 0.1 },
  { name: 'AM_SaberThrow', state: 'Attacking' as AnimStateName, totalFrames: 40, fps: 30, cancelWindowStart: 30, cancelWindowEnd: 35, blendInTime: 0.15 },
  { name: 'AM_ForceLightning', state: 'Attacking' as AnimStateName, totalFrames: 60, fps: 30, blendInTime: 0.2 },
  { name: 'AM_ForceHeal', state: 'Locomotion' as AnimStateName, totalFrames: 45, fps: 30, blendInTime: 0.25 },
];

export interface TransitionRule {
  from: AnimStateName;
  to: AnimStateName;
  condition: string;
  useCancelWindow: boolean;
  gateBool: string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  { from: 'Locomotion', to: 'Attacking', condition: 'bIsAttacking', useCancelWindow: false, gateBool: 'bIsAttacking' },
  { from: 'Locomotion', to: 'Dodging', condition: 'bIsDodging', useCancelWindow: false, gateBool: 'bIsDodging' },
  { from: 'Locomotion', to: 'HitReact', condition: 'bIsHitReacting', useCancelWindow: false, gateBool: 'bIsHitReacting' },
  { from: 'Locomotion', to: 'Death', condition: 'bIsDead', useCancelWindow: false, gateBool: 'bIsDead' },
  { from: 'Attacking', to: 'Locomotion', condition: '!bIsAttacking && !bIsFullBodyMontage', useCancelWindow: false, gateBool: 'bIsAttackRecovery' },
  { from: 'Attacking', to: 'Dodging', condition: 'bDodgeCancelsAttack', useCancelWindow: true, gateBool: 'bDodgeCancelsAttack' },
  { from: 'Attacking', to: 'HitReact', condition: 'bHitReactInterrupt', useCancelWindow: false, gateBool: 'bHitReactInterrupt' },
  { from: 'Dodging', to: 'Locomotion', condition: '!bIsDodging', useCancelWindow: false, gateBool: 'bIsDodging' },
  { from: 'Dodging', to: 'Attacking', condition: 'bCanInterruptDodge && bIsAttacking', useCancelWindow: true, gateBool: 'bCanInterruptDodge' },
  { from: 'HitReact', to: 'Locomotion', condition: '!bIsHitReacting', useCancelWindow: false, gateBool: 'bIsHitReacting' },
  { from: 'HitReact', to: 'Death', condition: 'bIsDead', useCancelWindow: false, gateBool: 'bIsDead' },
];

export const GENRE_NORMS: Record<string, number> = {
  'Locomotion': 0.05,
  'Attacking': 0.20,
  'Dodging': 0.15,
  'HitReact': 0.10,
};

export interface ResponsivenessResult {
  from: AnimStateName;
  to: AnimStateName;
  action: string;
  bestCase: number;
  worstCase: number;
  avgCase: number;
  frameRange: string;
  cancelPct: string;
  exceedsNorm: boolean;
  normThreshold: number;
  gateBool: string;
}

function computeResponsiveness(): ResponsivenessResult[] {
  const results: ResponsivenessResult[] = [];

  for (const rule of TRANSITION_RULES) {
    const sourceMontages = MONTAGE_TIMINGS.filter(m => m.state === rule.from);

    if (rule.from === 'Locomotion') {
      const blendIn = 0.05;
      const inputLag = 1 / 60;
      const total = blendIn + inputLag;
      results.push({
        from: rule.from, to: rule.to,
        action: `${rule.to} from idle`,
        bestCase: inputLag, worstCase: total, avgCase: (inputLag + total) / 2,
        frameRange: 'frame 0-1', cancelPct: 'immediate',
        exceedsNorm: total > (GENRE_NORMS[rule.from] ?? 0.2),
        normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
        gateBool: rule.gateBool,
      });
      continue;
    }

    if (sourceMontages.length === 0) {
      const montage = MONTAGE_TIMINGS.find(m => m.state === rule.from);
      const dur = montage ? montage.totalFrames / montage.fps : 0.3;
      results.push({
        from: rule.from, to: rule.to,
        action: `${rule.to} from ${rule.from}`,
        bestCase: 0, worstCase: dur, avgCase: dur / 2,
        frameRange: `0-${montage?.totalFrames ?? '?'}`,
        cancelPct: 'on completion',
        exceedsNorm: dur > (GENRE_NORMS[rule.from] ?? 0.2),
        normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
        gateBool: rule.gateBool,
      });
      continue;
    }

    for (const montage of sourceMontages) {
      const frameDur = 1 / montage.fps;
      const totalDur = montage.totalFrames * frameDur;

      if (rule.useCancelWindow && montage.cancelWindowStart !== undefined && montage.cancelWindowEnd !== undefined) {
        const cancelStart = montage.cancelWindowStart * frameDur;
        const cancelEnd = montage.cancelWindowEnd * frameDur;
        const blendIn = montage.blendInTime;
        const best = cancelStart + blendIn;
        const worst = cancelEnd + blendIn;
        const pctStart = Math.round((montage.cancelWindowStart / montage.totalFrames) * 100);
        const pctEnd = Math.round((montage.cancelWindowEnd / montage.totalFrames) * 100);

        results.push({
          from: rule.from, to: rule.to,
          action: `${rule.to} from ${montage.name}`,
          bestCase: best, worstCase: worst, avgCase: (best + worst) / 2,
          frameRange: `frames ${montage.cancelWindowStart}-${montage.cancelWindowEnd} of ${montage.totalFrames}`,
          cancelPct: `${pctStart}-${pctEnd}%`,
          exceedsNorm: best > (GENRE_NORMS[rule.from] ?? 0.2),
          normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
          gateBool: rule.gateBool,
        });
      } else {
        const blendIn = montage.blendInTime;
        results.push({
          from: rule.from, to: rule.to,
          action: `${rule.to} from ${montage.name}`,
          bestCase: totalDur + blendIn, worstCase: totalDur + blendIn, avgCase: totalDur + blendIn,
          frameRange: `after frame ${montage.totalFrames}`,
          cancelPct: 'on completion',
          exceedsNorm: (totalDur + blendIn) > (GENRE_NORMS[rule.from] ?? 0.2),
          normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
          gateBool: rule.gateBool,
        });
      }
    }
  }

  return results;
}

export const RESPONSIVENESS_RESULTS = computeResponsiveness();

export const RESPONSIVENESS_GRADE_THRESHOLDS = [
  { max: 0.05, label: 'Instant', color: STATUS_SUCCESS },
  { max: 0.10, label: 'Excellent', color: STATUS_SUCCESS },
  { max: 0.15, label: 'Good', color: ACCENT_EMERALD },
  { max: 0.25, label: 'Acceptable', color: STATUS_WARNING },
  { max: 0.50, label: 'Sluggish', color: ACCENT_VIOLET },
  { max: Infinity, label: 'Unresponsive', color: STATUS_ERROR },
];

export function getGrade(seconds: number) {
  return RESPONSIVENESS_GRADE_THRESHOLDS.find(t => seconds <= t.max) ?? RESPONSIVENESS_GRADE_THRESHOLDS[RESPONSIVENESS_GRADE_THRESHOLDS.length - 1];
}
