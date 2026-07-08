import type { StateType } from '../shared/state-machine-shared';

// ── Types ──

export interface EditorState {
  id: string;
  name: string;
  stateType: StateType;
  priority: number; // 0 = highest priority (checked first in ComputeAnimState)
  flag: string; // e.g., 'bIsDead', 'bIsAttacking'
  x: number; // Percent position (0-100)
  y: number;
  isDefault?: boolean; // Locomotion is default (no flag needed)
  montageRef?: string; // e.g., 'AM_Dodge'
}

export interface EditorTransition {
  id: string;
  from: string; // state id
  to: string; // state id
  rule: string; // e.g., 'bIsAttacking == true'
  description?: string;
}

// ── Diff tracking ──

export interface DiffResult {
  newStates: string[];
  removedStates: string[];
  modifiedStates: string[]; // states with changed properties
  newTransitions: string[];
  removedTransitions: string[];
  modifiedTransitions: string[]; // transitions with changed rules
}
