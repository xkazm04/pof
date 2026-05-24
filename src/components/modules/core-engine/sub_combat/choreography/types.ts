import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { DamageEvent, FeedbackEvent, ChoreographyAlert } from '@/lib/combat/choreography-sim';

// ── Re-export alias ────────────────────────────────────────────────────────
export type BalanceAlert = ChoreographyAlert;

// ── Grid Constants ─────────────────────────────────────────────────────────
export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const CELL_SIZE = 48;

// ── Archetype Visual Maps ──────────────────────────────────────────────────
export const ARCHETYPE_COLORS: Record<string, string> = {
  'melee-grunt': ACCENT_EMERALD,
  'ranged-caster': ACCENT_VIOLET,
  'brute': ACCENT_ORANGE,
  'elite-knight': STATUS_ERROR,
};

export const ARCHETYPE_ICONS: Record<string, string> = {
  'melee-grunt': 'FG',
  'ranged-caster': 'DM',
  'brute': 'SB',
  'elite-knight': 'HK',
};

// ── Feedback Channel Config ────────────────────────────────────────────────
export const FEEDBACK_CHANNEL_COLORS = {
  hitstop: STATUS_WARNING,
  shake: ACCENT_ORANGE,
  vfx: ACCENT_CYAN,
  sfx: ACCENT_VIOLET,
};

export const FEEDBACK_CHANNELS = [
  { type: 'hitstop', label: 'Hitstop', color: FEEDBACK_CHANNEL_COLORS.hitstop },
  { type: 'shake', label: 'Shake', color: FEEDBACK_CHANNEL_COLORS.shake },
  { type: 'vfx', label: 'VFX', color: FEEDBACK_CHANNEL_COLORS.vfx },
  { type: 'sfx', label: 'SFX', color: FEEDBACK_CHANNEL_COLORS.sfx },
] as const;

// ── Lane Heights ───────────────────────────────────────────────────────────
export const LANE_PACING_H = 48;
export const LANE_DAMAGE_H = 28;
export const LANE_ALERT_H = 20;
export const LANE_FEEDBACK_H = 14;
export const LANE_GAP = 4;

// ── Severity Colors ────────────────────────────────────────────────────────
export function severityColor(severity: string): string {
  if (severity === 'critical') return STATUS_ERROR;
  if (severity === 'warning') return STATUS_WARNING;
  return STATUS_INFO;
}

// ── Drag State ─────────────────────────────────────────────────────────────
export interface DragState {
  enemyId: string;
  sourceX: number;
  sourceY: number;
  sourceWave: number;
  shiftHeld: boolean;
}

// ── Scrub Tooltip Data ─────────────────────────────────────────────────────
export interface ScrubData {
  damageEvent: DamageEvent | null;
  feedbackStates: Record<string, FeedbackEvent | null>;
  alert: BalanceAlert | null;
}

export interface HoverState {
  time: number;
  tooltipLeft: number;
}

// ── ID Generator ───────────────────────────────────────────────────────────
let _nextId = 1;
export function nextId(): string {
  return `e${_nextId++}`;
}

// ── Scrub Data Computation ─────────────────────────────────────────────────
export function computeScrubData(
  time: number,
  damageEvents: DamageEvent[],
  feedbackEvents: FeedbackEvent[],
  alerts: BalanceAlert[],
): ScrubData {
  let closestDmg: DamageEvent | null = null;
  let closestDist = 0.3;
  for (const evt of damageEvents) {
    const d = Math.abs(evt.timeSec - time);
    if (d < closestDist) { closestDmg = evt; closestDist = d; }
  }

  const feedbackStates: Record<string, FeedbackEvent | null> = {
    hitstop: null, shake: null, vfx: null, sfx: null,
  };
  for (const evt of feedbackEvents) {
    if (evt.timeSec <= time && evt.timeSec + evt.durationSec >= time) {
      feedbackStates[evt.type] = evt;
    }
  }

  let closestAlert: BalanceAlert | null = null;
  let closestAlertDist = 1;
  for (const a of alerts) {
    if (a.timeSec === undefined) continue;
    const d = Math.abs(a.timeSec - time);
    if (d < closestAlertDist) { closestAlert = a; closestAlertDist = d; }
  }

  return { damageEvent: closestDmg, feedbackStates, alert: closestAlert };
}
