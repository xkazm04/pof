import type { CharacterGenome } from '@/types/character-genome';

/* ── Field definition for profile sliders ──────────────────────────────── */

export interface FieldDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

/* ── Balance constraint warning ────────────────────────────────────────── */

export type WarningSeverity = 'warning' | 'error';

export interface FieldWarning {
  /** profile.field key, e.g. 'dodge.iFrameDuration' */
  fieldKey: string;
  severity: WarningSeverity;
  message: string;
}

/* ── Profile key union ─────────────────────────────────────────────────── */

export type ProfileKey = 'movement' | 'combat' | 'dodge' | 'camera' | 'attributes';

/* ── Radar axis for compact overview ───────────────────────────────────── */

export interface CompactRadarAxis {
  label: string;
  getValue: (g: CharacterGenome) => number;
  max: number;
}

/* ── Comparison axis for archetype panel ───────────────────────────────── */

export interface ComparisonAxis {
  label: string;
  getValue: (g: CharacterGenome) => number;
  max: number;
  unit: string;
  higherIsBetter: boolean;
}

/* ── Power curve types ─────────────────────────────────────────────────── */

export type PowerCurveStat = 'hp' | 'armor' | 'stamina' | 'mana' | 'power';

export interface PowerCurveCrossover {
  level: number;
  value: number;
  nameA: string;
  nameB: string;
  colorA: string;
  colorB: string;
}

/* ── Comparison table stat row ─────────────────────────────────────────── */

export interface CompStatRow {
  label: string;
  unit: string;
  getValue: (g: CharacterGenome) => number;
  higherIsBetter: boolean;
}
