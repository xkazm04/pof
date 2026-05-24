import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_NEUTRAL,
} from '@/lib/chart-colors';

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface DodgeParams {
  dodgeDuration: number;
  dodgeDistance: number;
  iFrameStart: number;
  iFrameDuration: number;
  cancelWindowStart: number;
  cancelWindowEnd: number;
  cooldown: number;
  staminaCost: number;
}

export interface DodgePhases {
  movement: Phase;
  invuln: Phase;
  cancel: Phase;
  recovery: Phase;
  totalTimeline: number;
}

export interface Phase {
  start: number;
  end: number;
  color: string;
  label: string;
}

export interface HitMarker {
  id: string;
  time: number;
  label: string;
  damage: number;
}

export interface DodgeChainEntry {
  id: string;
  startTime: number;
  params: DodgeParams;
}

export type ExportFormat = 'cpp' | 'csv';

export type HapticEffect = { type: 'dodge' | 'hit'; id: string } | null;

export interface DodgeTimelineEditorProps {
  /** Optional initial params from a genome or external source */
  initialParams?: Partial<DodgeParams>;
}

/* ── Field definitions for editable params ────────────────────────────────── */

export interface FieldDef {
  key: keyof DodgeParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  color: string;
}

export const PARAM_FIELDS: FieldDef[] = [
  { key: 'dodgeDuration', label: 'Duration', unit: 's', min: 0.1, max: 2.0, step: 0.05, color: ACCENT_CYAN },
  { key: 'dodgeDistance', label: 'Distance', unit: 'cm', min: 100, max: 2000, step: 25, color: ACCENT_CYAN },
  { key: 'iFrameStart', label: 'I-Frame Start', unit: 's', min: 0, max: 0.5, step: 0.01, color: ACCENT_ORANGE },
  { key: 'iFrameDuration', label: 'I-Frame Dur.', unit: 's', min: 0, max: 1.0, step: 0.01, color: ACCENT_ORANGE },
  { key: 'cancelWindowStart', label: 'Cancel Start', unit: 's', min: 0, max: 1.5, step: 0.01, color: ACCENT_VIOLET },
  { key: 'cancelWindowEnd', label: 'Cancel End', unit: 's', min: 0, max: 2.0, step: 0.01, color: ACCENT_VIOLET },
  { key: 'cooldown', label: 'Cooldown', unit: 's', min: 0, max: 3.0, step: 0.05, color: STATUS_NEUTRAL },
  { key: 'staminaCost', label: 'Stamina Cost', unit: '', min: 0, max: 100, step: 1, color: ACCENT_EMERALD },
];

/* ── Defaults ─────────────────────────────────────────────────────────────── */

export const DEFAULT_PARAMS: DodgeParams = {
  dodgeDuration: 0.5,
  dodgeDistance: 500,
  iFrameStart: 0.05,
  iFrameDuration: 0.3,
  cancelWindowStart: 0.35,
  cancelWindowEnd: 0.5,
  cooldown: 0.8,
  staminaCost: 25,
};

/** Default montage length assumed to be 1.0s — play rate scales it to match dodgeDuration */
export const REFERENCE_MONTAGE_LENGTH = 1.0;
