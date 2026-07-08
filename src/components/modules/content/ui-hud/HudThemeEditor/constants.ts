import type { HudTheme } from './types';

// ── Defaults (matching C++ UPROPERTYs) ─────────────────────────────────────

export const DEFAULT_THEME: HudTheme = {
  healthyColor:       { r: 0.1, g: 0.8, b: 0.1, a: 1.0 },
  dangerColor:        { r: 0.9, g: 0.1, b: 0.1, a: 1.0 },
  manaColor:          { r: 0.2, g: 0.3, b: 1.0, a: 1.0 },
  lowHealthThreshold: 0.25,
  lowHealthPulseSpeed: 2.0,
  barInterpSpeed:     10.0,

  elementColors: {
    Physical:  { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    Fire:      { r: 1.0, g: 0.3, b: 0.1, a: 1.0 },
    Ice:       { r: 0.3, g: 0.6, b: 1.0, a: 1.0 },
    Lightning: { r: 1.0, g: 1.0, b: 0.2, a: 1.0 },
    Heal:      { r: 0.2, g: 1.0, b: 0.3, a: 1.0 },
  },
  normalFontSize:    18,
  critFontSize:      26,
  floatDistance:      80,
  horizontalSpread:  30,
  damageLifetime:    1.0,

  fadeInDuration:    0.2,
  fadeOutDuration:   0.5,
  fadeOutDelay:      3.0,
  enemyBarColor:     { r: 0.8, g: 0.1, b: 0.1, a: 1.0 },
};

// Scripted combat sequence — repeats every CYCLE_DURATION seconds
export const CYCLE_DURATION = 8.0;
