import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { StateNode, TransitionEdge } from './types';

export const ANIM_ACCENT = ACCENT_VIOLET;

// ── State type classification ──

export const LOCOMOTION_KEYWORDS = ['idle', 'walk', 'run', 'sprint', 'jump', 'jumpstart', 'jumploop', 'fall', 'falling', 'land', 'landing', 'locomotion', 'swimming', 'climbing'];
export const COMBAT_KEYWORDS = ['attack', 'attacking', 'combo', 'block', 'blocking', 'dodge', 'dodging', 'cast', 'casting'];
export const REACTION_KEYWORDS = ['hit', 'hitreact', 'stun', 'stunned', 'death', 'dead', 'knockback', 'flinch'];

// ── Hardcoded fallback states ──

export const FALLBACK_STATES: StateNode[] = [
  { id: 'anim-idle', label: 'Idle', prompt: 'Implement the Idle state in the Animation Blueprint. Set up the idle animation with subtle breathing/sway, transition conditions to Walk (movement speed > 0), and an idle break montage system for variety.', x: 14, y: 50, stateType: 'locomotion' },
  { id: 'anim-walk', label: 'Walk', prompt: 'Implement the Walk state in the Animation Blueprint. Create a walk blend space driven by direction and speed, with transitions to Idle (speed ~ 0), Run (speed > walk threshold), and Jump (jump input).', x: 34, y: 50, stateType: 'locomotion' },
  { id: 'anim-run', label: 'Run', prompt: 'Implement the Run state in the Animation Blueprint. Create a run blend space with lean animations, transitions to Walk (speed < run threshold), Jump (jump input), and stamina-based sprint variation.', x: 54, y: 50, stateType: 'locomotion' },
  { id: 'anim-jump', label: 'Jump', prompt: 'Implement the Jump state in the Animation Blueprint. Create jump start animation with root motion, transition to Fall when vertical velocity becomes negative, and support for double-jump if enabled.', x: 50, y: 14, stateType: 'locomotion' },
  { id: 'anim-fall', label: 'Fall', prompt: 'Implement the Fall state in the Animation Blueprint. Create a falling loop animation with air control blend, transition to Land on ground contact, and a long-fall variant for extended airtime.', x: 78, y: 14, stateType: 'locomotion' },
  { id: 'anim-land', label: 'Land', prompt: 'Implement the Land state in the Animation Blueprint. Create soft and hard landing animations based on fall duration/velocity, with recovery transition back to Idle and optional roll for high falls.', x: 78, y: 50, stateType: 'locomotion' },
];

export const FALLBACK_TRANSITIONS: TransitionEdge[] = [
  { from: 'anim-idle', to: 'anim-walk', rule: 'Speed > 0' },
  { from: 'anim-walk', to: 'anim-idle', rule: 'Speed ~ 0' },
  { from: 'anim-walk', to: 'anim-run', rule: 'Speed > Threshold' },
  { from: 'anim-run', to: 'anim-walk', rule: 'Speed < Threshold' },
  { from: 'anim-walk', to: 'anim-jump', rule: 'IsInAir' },
  { from: 'anim-run', to: 'anim-jump', rule: 'IsInAir' },
  { from: 'anim-jump', to: 'anim-fall', rule: 'VelZ < 0' },
  { from: 'anim-fall', to: 'anim-land', rule: '!IsInAir' },
  { from: 'anim-land', to: 'anim-idle', rule: 'AnimTime < 0.2' },
];

// ── Graph provenance ──
//
// Where the drawn graph actually came from. The header used to badge EVERY
// graph `RUNTIME` unconditionally, including the six hardcoded fallback states
// — i.e. the app claimed live/authored data while showing a template nobody's
// project produced. The three sources are mutually exclusive and each names
// itself; `resolveGraphProvenance` is the single place the precedence lives.

export type GraphProvenance = 'bridge' | 'scanned' | 'template';

export const GRAPH_PROVENANCE: Record<GraphProvenance, { badge: string; label: string }> = {
  bridge: { badge: 'BRIDGE', label: 'LIVE FROM BRIDGE' },
  scanned: { badge: 'PROJECT SCAN', label: 'SCANNED FROM PROJECT' },
  template: { badge: 'TEMPLATE', label: 'UNSCANNED TEMPLATE — CLICK TO IMPLEMENT' },
};

export const EMPTY_PROGRESS: Record<string, boolean> = {};
export const NODE_W = 110;
export const NODE_H = 46;
