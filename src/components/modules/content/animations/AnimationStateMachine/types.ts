import type { StateType } from '../shared/state-machine-shared';

// ── Hardcoded fallback states ──

export interface StateNode {
  id: string;
  label: string;
  prompt: string;
  x: number;
  y: number;
  stateType: StateType;
}

export interface TransitionEdge {
  from: string;
  to: string;
  rule: string | null;
}

// Enriched node used at render time (derived in useAnimationStateMachine).
export interface StateNodeView extends StateNode {
  completed: boolean;
  isActive: boolean;
  hasMontage: boolean;
  isNew: boolean;
}

// ── Component ──

export interface AnimationStateMachineProps {
  onSelectState: (stateId: string, prompt: string) => void;
  isRunning: boolean;
  activeStateId: string | null;
}
