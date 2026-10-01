import { cppFloat } from '@/lib/genome/codegen';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO,
  ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { HudTheme, RGBA } from './types';

// ── One HUD theme parameter table ───────────────────────────────────────────
//
// Every UE UPROPERTY the HUD Theme Editor tunes is declared ONCE here, in export
// order. DEFAULT_THEME (themeDefaults), the slider sections (sectionParams), the
// .h export (generateUE5Config), its stats (exportStats) and the .h import
// (parseUE5Config) are all projections of this table — adding or retuning a
// UPROPERTY is a one-row edit.

export type HudSection = 'health' | 'damage' | 'enemy';
export type HudWidget = 'ARPGHUDWidget' | 'EnemyHealthBarWidget' | 'DamageNumberWidget';

export const HUD_ELEMENTS = ['Physical', 'Fire', 'Ice', 'Lightning', 'Heal'] as const;
export type HudElement = (typeof HUD_ELEMENTS)[number];

type KeysOfType<T> = { [K in keyof HudTheme]: HudTheme[K] extends T ? K : never }[keyof HudTheme];
export type HudScalarKey = KeysOfType<number>;
export type HudColorKey = KeysOfType<RGBA>;

/** The .h export's section blocks, each opened by its verbatim header comment. */
export const EXPORT_BLOCKS = {
  health: '// ── ARPGHUDWidget — Player Health Bar ──────────────────────────────',
  mana: '// ── ARPGHUDWidget — Mana Bar ──────────────────────────────────────',
  enemy: '// ── EnemyHealthBarWidget — Enemy HP Bar ────────────────────────────',
  damage: '// ── DamageNumberWidget — Floating Damage Numbers ───────────────────',
} as const;
export type ExportBlock = keyof typeof EXPORT_BLOCKS;

interface ParamCommon {
  ueName: string;
  label: string;
  widget: HudWidget;
  block: ExportBlock;
  category: string;
  section: HudSection;
  /** Decimal places the .h export prints. */
  precision: number;
  accent?: string;
}

export interface HudFloatParam extends ParamCommon {
  kind: 'float';
  key: HudScalarKey;
  default: number;
  /** Range and step in theme units; the import clamps to [min, max]. */
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Slider shows value × displayScale (e.g. 100 for a 0–1 fraction shown as %). */
  displayScale: number;
}

export interface HudColorParam extends ParamCommon {
  kind: 'color';
  key: HudColorKey | 'elementColors';
  /** Set only for rows of the elementColors map. */
  element?: HudElement;
  default: RGBA;
}

export type HudThemeParam = HudFloatParam | HudColorParam;

const rgba = (r: number, g: number, b: number, a = 1.0): RGBA => ({ r, g, b, a });

function color(
  key: HudColorKey, ueName: string, label: string, def: RGBA,
  at: Pick<ParamCommon, 'widget' | 'block' | 'category' | 'section'>,
): HudColorParam {
  return { kind: 'color', key, ueName, label, default: def, precision: 2, ...at };
}

function float(
  key: HudScalarKey, ueName: string, label: string, def: number,
  range: { min: number; max: number; step: number; unit: string; precision: number; displayScale?: number; accent?: string },
  at: Pick<ParamCommon, 'widget' | 'block' | 'category' | 'section'>,
): HudFloatParam {
  return { kind: 'float', key, ueName, label, default: def, displayScale: 1, ...range, ...at };
}

const HEALTH = { widget: 'ARPGHUDWidget', block: 'health', category: 'HUD|Health', section: 'health' } as const;
const MANA = { widget: 'ARPGHUDWidget', block: 'mana', category: 'HUD|Mana', section: 'health' } as const;
const ENEMY = { widget: 'EnemyHealthBarWidget', block: 'enemy', category: 'EnemyHP', section: 'enemy' } as const;
const FADE = { ...ENEMY, category: 'EnemyHP|Fade' } as const;
const DMG = { widget: 'DamageNumberWidget', block: 'damage', section: 'damage' } as const;
const FONT = { ...DMG, category: 'DamageNumbers|Font' } as const;
const ANIM = { ...DMG, category: 'DamageNumbers|Animation' } as const;

const ELEMENT_DEFAULTS: Record<HudElement, RGBA> = {
  Physical: rgba(1.0, 1.0, 1.0),
  Fire: rgba(1.0, 0.3, 0.1),
  Ice: rgba(0.3, 0.6, 1.0),
  Lightning: rgba(1.0, 1.0, 0.2),
  Heal: rgba(0.2, 1.0, 0.3),
};

export const HUD_THEME_PARAMS: readonly HudThemeParam[] = [
  color('healthyColor', 'HealthBarColor', 'Healthy Color', rgba(0.1, 0.8, 0.1), HEALTH),
  color('dangerColor', 'LowHealthColor', 'Danger Color', rgba(0.9, 0.1, 0.1), HEALTH),
  float('lowHealthThreshold', 'LowHealthThreshold', 'LowHealthThreshold', 0.25,
    { min: 0.05, max: 0.75, step: 0.01, unit: '%', precision: 2, displayScale: 100, accent: STATUS_WARNING }, HEALTH),
  float('lowHealthPulseSpeed', 'LowHealthPulseSpeed', 'LowHealthPulseSpeed', 2.0,
    { min: 0.5, max: 6, step: 0.1, unit: ' Hz', precision: 1, accent: STATUS_SUCCESS }, HEALTH),
  color('manaColor', 'ManaBarColor', 'Mana Color', rgba(0.2, 0.3, 1.0), MANA),
  color('enemyBarColor', 'BarColor', 'Enemy Bar Color', rgba(0.8, 0.1, 0.1), ENEMY),
  float('barInterpSpeed', 'BarInterpSpeed', 'BarInterpSpeed', 10.0,
    { min: 1, max: 30, step: 0.5, unit: '/s', precision: 1, accent: ACCENT_CYAN }, ENEMY),
  float('fadeInDuration', 'FadeInDuration', 'FadeInDuration', 0.2,
    { min: 0.05, max: 1.0, step: 0.05, unit: 's', precision: 2, accent: STATUS_SUCCESS }, FADE),
  float('fadeOutDuration', 'FadeOutDuration', 'FadeOutDuration', 0.5,
    { min: 0.1, max: 2.0, step: 0.05, unit: 's', precision: 2, accent: ACCENT_VIOLET }, FADE),
  float('fadeOutDelay', 'FadeOutDelay', 'FadeOutDelay', 3.0,
    { min: 0.5, max: 10, step: 0.5, unit: 's', precision: 1, accent: STATUS_WARNING }, FADE),
  ...HUD_ELEMENTS.map((element): HudColorParam => ({
    kind: 'color', key: 'elementColors', element, ueName: `${element}Color`, label: element,
    default: ELEMENT_DEFAULTS[element], precision: 2, ...DMG, category: 'DamageNumbers|Colors',
  })),
  float('normalFontSize', 'NormalFontSize', 'NormalFontSize', 18,
    { min: 10, max: 32, step: 1, unit: 'pt', precision: 0, accent: STATUS_INFO }, FONT),
  float('critFontSize', 'CritFontSize', 'CritFontSize', 26,
    { min: 16, max: 48, step: 1, unit: 'pt', precision: 0, accent: STATUS_WARNING }, FONT),
  float('floatDistance', 'FloatDistance', 'FloatDistance', 80,
    { min: 20, max: 200, step: 5, unit: 'px', precision: 0 }, ANIM),
  float('horizontalSpread', 'HorizontalSpread', 'HorizontalSpread', 30,
    { min: 0, max: 80, step: 5, unit: 'px', precision: 0 }, ANIM),
  float('damageLifetime', 'DamageLifetime', 'DamageLifetime', 1.0,
    { min: 0.3, max: 3.0, step: 0.1, unit: 's', precision: 2, accent: ACCENT_VIOLET }, ANIM),
];

export const HUD_PARAM_BY_UE_NAME: ReadonlyMap<string, HudThemeParam> =
  new Map(HUD_THEME_PARAMS.map(p => [p.ueName, p]));

// ── Reading / writing one row on a theme ────────────────────────────────────

export function readColor(theme: HudTheme, p: HudColorParam): RGBA {
  return p.key === 'elementColors' ? theme.elementColors[p.element!] : theme[p.key];
}

/** Returns a new theme with one row's value replaced. */
export function writeParam(theme: HudTheme, p: HudThemeParam, value: number | RGBA): HudTheme {
  if (p.kind === 'float') return { ...theme, [p.key]: value as number };
  if (p.key === 'elementColors') {
    return { ...theme, elementColors: { ...theme.elementColors, [p.element!]: value as RGBA } };
  }
  return { ...theme, [p.key]: value as RGBA };
}

export function themeDefaults(): HudTheme {
  let theme = { elementColors: {} } as HudTheme;
  for (const p of HUD_THEME_PARAMS) {
    theme = writeParam(theme, p, p.kind === 'color' ? { ...p.default } : p.default);
  }
  return theme;
}

export function sectionParams(section: HudSection): HudThemeParam[] {
  return HUD_THEME_PARAMS.filter(p => p.section === section);
}

// ── Export-line formatting (shared by the .h export and theme diffs) ────────

/**
 * A C++ float literal at a fixed precision: `0.25f`, `10.0f`, `18.0f` — always
 * with a decimal point, never `18f` (invalid for integers). Non-finite or
 * exponent-form values fall back to the shared cppFloat.
 */
export function cppFixedFloat(v: number, precision: number): string {
  if (!Number.isFinite(v)) return cppFloat(v);
  const s = v.toFixed(precision);
  if (/e/i.test(s)) return cppFloat(v);
  return s.includes('.') ? `${s}f` : `${s}.0f`;
}

export function formatCategoryLine(p: HudThemeParam): string {
  return `UPROPERTY(EditAnywhere, Category = "${p.category}")`;
}

export function formatExportLine(p: HudThemeParam, theme: HudTheme): string {
  if (p.kind === 'float') return `float ${p.ueName} = ${cppFixedFloat(theme[p.key], p.precision)};`;
  const c = readColor(theme, p);
  const f = (n: number) => cppFixedFloat(n, p.precision);
  return `FLinearColor ${p.ueName} = FLinearColor(${f(c.r)}, ${f(c.g)}, ${f(c.b)}, ${f(c.a)});`;
}

export interface HudExportStats { uproperties: number; widgetClasses: number; elements: number }

/** Counts what the .h export of `theme` declares: the rows whose value the theme carries. */
export function exportStats(theme: HudTheme): HudExportStats {
  const rows = HUD_THEME_PARAMS.filter(p => p.kind === 'float' || readColor(theme, p) !== undefined);
  return {
    uproperties: rows.length,
    widgetClasses: new Set(rows.map(p => p.widget)).size,
    elements: rows.filter(p => p.key === 'elementColors').length,
  };
}
