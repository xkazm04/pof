import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { DamageEvent, FeedbackEvent, ChoreographyAlert } from '@/lib/combat/choreography-sim';
import type { DramaticBeatType, TensionCurve } from '@/lib/combat/tension-curve';

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

// ── Dramatic Beat Visual Map ───────────────────────────────────────────────
// Color + short label per beat type. Icons live in the React components so this
// module stays free of JSX. `tone` mirrors tension-curve's BeatTone.
export const BEAT_STYLES: Record<DramaticBeatType, { color: string; label: string; tone: 'peak' | 'valley' | 'issue' }> = {
  climax: { color: STATUS_WARNING, label: 'Climax', tone: 'peak' },
  'near-death': { color: STATUS_ERROR, label: 'Near-death', tone: 'peak' },
  comeback: { color: ACCENT_EMERALD, label: 'Comeback', tone: 'peak' },
  breather: { color: ACCENT_CYAN, label: 'Breather', tone: 'valley' },
  'dead-zone': { color: STATUS_INFO, label: 'Dead zone', tone: 'issue' },
  anticlimax: { color: ACCENT_VIOLET, label: 'Anticlimax', tone: 'issue' },
  'flat-pacing': { color: ACCENT_ORANGE, label: 'Flat pacing', tone: 'issue' },
};

// ── Lane Heights ───────────────────────────────────────────────────────────
export const LANE_TENSION_H = 60;
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
  /** Dramatic tension at the scrub time, 0–1 (null when no curve) */
  tension: number | null;
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
  tensionCurve?: TensionCurve,
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

  let tension: number | null = null;
  if (tensionCurve && tensionCurve.samples.length > 0) {
    let best = tensionCurve.samples[0];
    let bestDist = Math.abs(best.timeSec - time);
    for (const s of tensionCurve.samples) {
      const d = Math.abs(s.timeSec - time);
      if (d < bestDist) { best = s; bestDist = d; }
    }
    tension = best.tension;
  }

  return { damageEvent: closestDmg, feedbackStates, alert: closestAlert, tension };
}
