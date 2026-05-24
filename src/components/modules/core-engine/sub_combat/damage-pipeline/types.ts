import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_CYAN_LIGHT, ACCENT_VIOLET,
  ACCENT_EMERALD, ACCENT_EMERALD_DARK,
  MODULE_COLORS, OPACITY_15,
} from '@/lib/chart-colors';

// ── Element colors (matching requirement spec) ───────────────────────────────

export const ELEMENT_COLORS = {
  Physical: STATUS_ERROR,
  Fire:     ACCENT_ORANGE,
  Ice:      ACCENT_CYAN,
  Lightning:'#eab308',
  Heal:     STATUS_SUCCESS,
} as const;

export type ElementType = keyof typeof ELEMENT_COLORS;

// ── Pipeline node types ──────────────────────────────────────────────────────

export type NodeKind = 'entry' | 'action' | 'branch' | 'broadcast' | 'event' | 'terminal';

export interface PipelineNode {
  id: string;
  label: string;
  detail: string;
  kind: NodeKind;
  cppRef?: string;
  element?: ElementType;
}

// ── Node kind styling ────────────────────────────────────────────────────────

export const KIND_STYLE: Record<NodeKind, { bg: string; border: string; text: string }> = {
  entry:     { bg: MODULE_COLORS.core + OPACITY_15, border: MODULE_COLORS.core, text: STATUS_INFO },
  action:    { bg: MODULE_COLORS.systems + OPACITY_15, border: MODULE_COLORS.systems, text: ACCENT_VIOLET },
  branch:    { bg: MODULE_COLORS.content + OPACITY_15, border: MODULE_COLORS.content, text: STATUS_WARNING },
  broadcast: { bg: ACCENT_CYAN + OPACITY_15, border: ACCENT_CYAN, text: ACCENT_CYAN_LIGHT },
  event:     { bg: ACCENT_EMERALD_DARK + OPACITY_15, border: ACCENT_EMERALD_DARK, text: ACCENT_EMERALD },
  terminal:  { bg: STATUS_ERROR + OPACITY_15, border: STATUS_ERROR, text: STATUS_ERROR },
};

// ── Element type tag detection order ─────────────────────────────────────────

export const ELEMENT_TAGS: { tag: string; element: ElementType }[] = [
  { tag: 'Damage.Fire', element: 'Fire' },
  { tag: 'Damage.Ice', element: 'Ice' },
  { tag: 'Damage.Lightning', element: 'Lightning' },
  { tag: 'Damage.Physical', element: 'Physical' },
];

// ── SVG layout constants ─────────────────────────────────────────────────────

export const NODE_W = 200;
export const NODE_H = 40;
export const GAP_Y = 12;
export const BRANCH_OFFSET_X = 130;

// ── Execution calculation types ──────────────────────────────────────────────

export interface CalcInputs {
  attackPower: number;
  critChance: number;
  critDamage: number;
  armor: number;
  baseDamage: number;
  scaling: number;
  critRoll: number;
}

export const DEFAULT_CALC: CalcInputs = {
  attackPower: 50,
  critChance: 0.25,
  critDamage: 1.5,
  armor: 30,
  baseDamage: 20,
  scaling: 1.0,
  critRoll: 0.5,
};

export const fmtNum = (v: number, dec = 2) => v.toFixed(dec);

// ── Fade mask type ───────────────────────────────────────────────────────────

export type FadeMask = 'none' | 'right' | 'left' | 'both';
