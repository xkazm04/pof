import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { type StateType } from '../shared/state-machine-shared';
import type { EditorState, EditorTransition } from './types';

export const EDITOR_ACCENT = ACCENT_VIOLET;

// StateType + STATE_TYPE_COLORS are imported from ../shared/state-machine-shared
// (shared with AnimationStateMachine). The editor only ever assigns the four
// options below; the shared union additionally carries `montage`.

export const STATE_TYPE_OPTIONS: { value: StateType; label: string }[] = [
  { value: 'locomotion', label: 'Locomotion' },
  { value: 'combat', label: 'Combat' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'other', label: 'Other' },
];

// ── Known UE5 AnimInstance flags ──

export const KNOWN_FLAGS = [
  'bIsAttacking',
  'bIsDodging',
  'bIsHitReacting',
  'bIsDead',
  'bIsInAir',
  'bIsSprinting',
  'bIsFullBodyMontage',
  'bIsComboWindowOpen',
  'bCanInterruptDodge',
  'bIsAttackRecovery',
  'bHitReactInterrupt',
  'bDodgeCancelsAttack',
  'bIsUpperBodyAction',
  'bIsAnyMontageActive',
  'bShouldMove',
  'bIsUsingRootMotion',
];

export const KNOWN_RULE_TEMPLATES = [
  '{flag} == true',
  '{flag} == false',
  '{flag} == true && !bIsFullBodyMontage',
  '{flag} == true && bCanInterruptDodge',
  'bIsAttacking == false && !bIsFullBodyMontage',
  'bIsDodging == false',
  'bIsHitReacting == false',
  'Montage ends (bIsAnyMontageActive == false)',
  'StateTime > {threshold}',
  '(default) // fallback',
];

// ── Default 5-state setup matching C++ ──

export const DEFAULT_STATES: EditorState[] = [
  { id: 'state-locomotion', name: 'Locomotion', stateType: 'locomotion', priority: 4, flag: '(default)', x: 50, y: 50, isDefault: true },
  { id: 'state-attacking', name: 'Attacking', stateType: 'combat', priority: 3, flag: 'bIsAttacking', x: 20, y: 25, montageRef: 'AM_Melee_Combo' },
  { id: 'state-dodging', name: 'Dodging', stateType: 'combat', priority: 2, flag: 'bIsDodging', x: 80, y: 25, montageRef: 'AM_Dodge' },
  { id: 'state-hitreact', name: 'HitReact', stateType: 'reaction', priority: 1, flag: 'bIsHitReacting', x: 20, y: 75, montageRef: 'AM_HitReact' },
  { id: 'state-death', name: 'Death', stateType: 'reaction', priority: 0, flag: 'bIsDead', x: 80, y: 75, montageRef: 'AM_Death' },
];

export const DEFAULT_TRANSITIONS: EditorTransition[] = [
  { id: 't-loco-atk', from: 'state-locomotion', to: 'state-attacking', rule: 'bIsAttacking == true' },
  { id: 't-loco-dodge', from: 'state-locomotion', to: 'state-dodging', rule: 'bIsDodging == true' },
  { id: 't-loco-hit', from: 'state-locomotion', to: 'state-hitreact', rule: 'bIsHitReacting == true' },
  { id: 't-loco-death', from: 'state-locomotion', to: 'state-death', rule: 'bIsDead == true' },
  { id: 't-atk-loco', from: 'state-attacking', to: 'state-locomotion', rule: 'bIsAttacking == false && !bIsFullBodyMontage' },
  { id: 't-atk-dodge', from: 'state-attacking', to: 'state-dodging', rule: 'bIsDodging == true', description: 'Dodge cancels attack recovery' },
  { id: 't-atk-hit', from: 'state-attacking', to: 'state-hitreact', rule: 'bIsHitReacting == true', description: 'Hit interrupts attack' },
  { id: 't-dodge-loco', from: 'state-dodging', to: 'state-locomotion', rule: 'bIsDodging == false' },
  { id: 't-dodge-atk', from: 'state-dodging', to: 'state-attacking', rule: 'bIsAttacking == true && bCanInterruptDodge', description: 'Cancel window' },
  { id: 't-hit-loco', from: 'state-hitreact', to: 'state-locomotion', rule: 'bIsHitReacting == false' },
  { id: 't-hit-death', from: 'state-hitreact', to: 'state-death', rule: 'bIsDead == true' },
];

export const NODE_W = 120;
export const NODE_H = 52;
