import { CYCLE_DURATION } from './constants';
import type { HudTheme, RGBA, DamageEvent } from './types';
import {
  HUD_THEME_PARAMS, HUD_PARAM_BY_UE_NAME, EXPORT_BLOCKS,
  formatCategoryLine, formatExportLine, writeParam,
  type ExportBlock,
} from './themeSchema';

// ── Utility ────────────────────────────────────────────────────────────────

export function rgbaToCSS(c: RGBA): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}

export function rgbaToHex(c: RGBA): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function hexToRGBA(hex: string): RGBA {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1.0 };
}

export function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

export function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Scripted combat sequence ────────────────────────────────────────────────

/** Scripted combat hit table, shared by the damage numbers and the enemy bar fade. */
const COMBAT_HITS: Array<{ time: number; amount: number; element: string; isCrit: boolean; isHeal: boolean }> = [
  { time: 0.5, amount: 247, element: 'Physical', isCrit: false, isHeal: false },
  { time: 1.2, amount: 892, element: 'Fire',     isCrit: true,  isHeal: false },
  { time: 2.0, amount: 156, element: 'Ice',      isCrit: false, isHeal: false },
  { time: 2.8, amount: 1203, element: 'Lightning', isCrit: true, isHeal: false },
  { time: 3.5, amount: 310, element: 'Physical', isCrit: false, isHeal: false },
  { time: 4.2, amount: 567, element: 'Fire',     isCrit: false, isHeal: false },
  { time: 5.0, amount: 728, element: 'Ice',      isCrit: true,  isHeal: false },
  { time: 5.6, amount: 200, element: 'Heal',     isCrit: false, isHeal: true },
  { time: 6.2, amount: 350, element: 'Heal',     isCrit: false, isHeal: true },
];

/** The scripted enemy dies here (enemyHealth reaches 0). */
export const ENEMY_DEATH_TIME = 6.0;

/**
 * Enemy health-bar opacity at loop time `time`, stepping the UE fade FSM
 * (EnemyHealthBarWidget: Hidden -> FadingIn -> Visible -> FadingOut; damage re-enters
 * FadingIn or resets the timer; FadeOutDelay ends Visible). Death starts FadingOut.
 */
export function enemyBarAlpha(time: number, theme: HudTheme): number {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  const hits = COMBAT_HITS.filter((h) => !h.isHeal && h.time < ENEMY_DEATH_TIME).map((h) => h.time);
  const STEP = 0.01;
  type State = 'hidden' | 'in' | 'visible' | 'out';
  let state: State = 'hidden';
  let alpha = 0;
  let sinceDamage = 0;
  let dead = false;
  let nextHit = 0;
  const steps = Math.round(t / STEP);
  for (let i = 0; i <= steps; i++) {
    const now = i * STEP;
    while (nextHit < hits.length && hits[nextHit] <= now + 1e-9) {
      sinceDamage = 0;
      state = state === 'hidden' || state === 'out' ? 'in' : 'visible';
      nextHit++;
    }
    if (!dead && now >= ENEMY_DEATH_TIME - 1e-9) { dead = true; state = alpha <= 0 ? 'hidden' : 'out'; }
    if (i === steps) break;
    if (state === 'in') {
      alpha += STEP / Math.max(theme.fadeInDuration, 0.01);
      if (alpha >= 1) { alpha = 1; state = 'visible'; }
    } else if (state === 'visible') {
      sinceDamage += STEP;
      if (sinceDamage >= theme.fadeOutDelay) state = 'out';
    } else if (state === 'out') {
      alpha -= STEP / Math.max(theme.fadeOutDuration, 0.01);
      if (alpha <= 0) { alpha = 0; state = 'hidden'; }
    }
  }
  return clamp(alpha, 0, 1);
}

export function getCombatEvents(time: number, theme: HudTheme): {
  playerHealth: number;
  enemyHealth: number;
  damageEvents: DamageEvent[];
} {
  const t = time % CYCLE_DURATION;
  const cycle = Math.floor(time / CYCLE_DURATION);
  const events: DamageEvent[] = [];

  // Player health timeline: starts 100%, takes damage, heals, takes more
  let playerHealth: number;
  if (t < 1.0) playerHealth = 1.0;
  else if (t < 2.0) playerHealth = lerpNum(1.0, 0.6, (t - 1.0));
  else if (t < 3.0) playerHealth = 0.6;
  else if (t < 4.0) playerHealth = lerpNum(0.6, 0.15, (t - 3.0));
  else if (t < 5.5) playerHealth = 0.15; // low-health pulse zone
  else if (t < 6.5) playerHealth = lerpNum(0.15, 0.7, (t - 5.5));
  else playerHealth = 0.7;

  // Enemy health timeline: takes hits from player
  let enemyHealth: number;
  if (t < 0.5) enemyHealth = 1.0;
  else if (t < 1.5) enemyHealth = lerpNum(1.0, 0.75, (t - 0.5));
  else if (t < 3.0) enemyHealth = lerpNum(0.75, 0.4, (t - 1.5) / 1.5);
  else if (t < 5.0) enemyHealth = lerpNum(0.4, 0.1, (t - 3.0) / 2.0);
  else if (t < 6.0) enemyHealth = lerpNum(0.1, 0.0, (t - 5.0));
  else enemyHealth = 0;

  // Spawn damage numbers at scripted times
  const hitTimes = COMBAT_HITS;

  // Seeded pseudo-random for consistent offsets
  const seededRand = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // A hit spawned late in the previous loop is still alive into this one when its
  // lifetime outlasts the wrap (DamageLifetime up to 3.0s vs the 6.2s heal).
  // Ids are (loop, hit index): stable for the event's whole life.
  for (const spawnCycle of [cycle - 1, cycle]) {
    if (spawnCycle < 0) continue;
    hitTimes.forEach((hit, i) => {
      const age = t + (cycle - spawnCycle) * CYCLE_DURATION - hit.time;
      if (age < 0 || age >= theme.damageLifetime) return;
      events.push({
        id: spawnCycle * 100 + i,
        amount: hit.amount,
        element: hit.element,
        isCrit: hit.isCrit,
        isHeal: hit.isHeal,
        spawnTime: hit.time,
        age,
        offsetX: (seededRand(hit.time * 7.1) - 0.5) * 2 * theme.horizontalSpread,
      });
    });
  }

  return { playerHealth, enemyHealth, damageEvents: events };
}

// ── UE5 Export generator ───────────────────────────────────────────────────

const EXPORT_PREAMBLE = [
  '// ══════════════════════════════════════════════════════════════════════',
  '// UMG HUD Theme Configuration — generated by PoF HUD Theme Editor',
  '// Copy these values into your UE5 C++ UPROPERTY defaults or Blueprint.',
  '// ══════════════════════════════════════════════════════════════════════',
];

/** Walks HUD_THEME_PARAMS in order: one UPROPERTY pair per row, a header per block. */
export function generateUE5Config(theme: HudTheme): string {
  const lines: string[] = [...EXPORT_PREAMBLE, ''];
  let block: ExportBlock | null = null;
  for (const p of HUD_THEME_PARAMS) {
    if (p.block !== block) {
      block = p.block;
      lines.push(EXPORT_BLOCKS[block]);
    }
    lines.push(formatCategoryLine(p), formatExportLine(p, theme), '');
  }
  lines.pop();
  return lines.join('\n');
}

// ── UE5 .h import (inverse of the export) ──────────────────────────────────

export interface HudImportWarning { name: string; clampedFrom: number; component?: keyof RGBA }
export interface HudImportMalformed { line: number; text: string; reason: string }
export interface HudImportResult {
  theme: HudTheme;
  /** UE names applied, in the order they appeared. */
  applied: string[];
  /** Well-formed declarations whose name is not a HUD theme UPROPERTY. */
  unknown: string[];
  /** Values outside the row's [min, max] — clamped, never silently. */
  warnings: HudImportWarning[];
  /** Lines that are neither blank, a comment, a UPROPERTY() macro nor a parsable declaration. */
  malformed: HudImportMalformed[];
}

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fF]?`;
const FLOAT_DECL = new RegExp(String.raw`^float\s+(\w+)\s*=\s*(${NUM})\s*;$`);
const COLOR_DECL = new RegExp(
  String.raw`^FLinearColor\s+(\w+)\s*=\s*FLinearColor\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*;$`,
);
const SKIPPED = /^(?:$|\/\/|\/\*|\*|UPROPERTY\s*\()/;

const num = (s: string) => parseFloat(s.replace(/[fF]$/, ''));

/**
 * Parse a HUD theme .h (the export, or a header tuned in-engine) onto `base`.
 * The key space is closed: a well-formed declaration with an unregistered name
 * lands in `unknown`, an unparsable line in `malformed`, an out-of-range value is
 * clamped to the row's range with a warning. Nothing is dropped silently.
 */
export function parseUE5Config(text: string, base: HudTheme): HudImportResult {
  let theme = structuredClone(base);
  const out: Omit<HudImportResult, 'theme'> = { applied: [], unknown: [], warnings: [], malformed: [] };
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, i) => {
    const src = raw.trim();
    if (SKIPPED.test(src)) return;
    const line = i + 1;
    const bad = (reason: string) => out.malformed.push({ line, text: src, reason });
    const f = FLOAT_DECL.exec(src);
    const c = f ? null : COLOR_DECL.exec(src);
    if (!f && !c) return bad('not a float or FLinearColor declaration');
    const name = (f ?? c)![1];
    const p = HUD_PARAM_BY_UE_NAME.get(name);
    if (!p) { out.unknown.push(name); return; }
    if (seen.has(name)) return bad(`duplicate declaration of ${name}`);
    if (p.kind === 'float' && !f) return bad(`${name} is a float, got a color`);
    if (p.kind === 'color' && !c) return bad(`${name} is a color, got a float`);
    seen.add(name);
    if (p.kind === 'float') {
      const v = num(f![2]);
      const clamped = clamp(v, p.min, p.max);
      if (clamped !== v) out.warnings.push({ name, clampedFrom: v });
      theme = writeParam(theme, p, clamped);
    } else {
      const parts = c!.slice(2, 6).map(num);
      const rgba = {} as RGBA;
      (['r', 'g', 'b', 'a'] as const).forEach((k, j) => {
        rgba[k] = clamp(parts[j], 0, 1);
        if (rgba[k] !== parts[j]) out.warnings.push({ name, clampedFrom: parts[j], component: k });
      });
      theme = writeParam(theme, p, rgba);
    }
    out.applied.push(name);
  });

  return { theme, ...out };
}
