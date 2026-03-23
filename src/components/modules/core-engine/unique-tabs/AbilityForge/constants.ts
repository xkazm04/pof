import {
  ACCENT_RED, ACCENT_ORANGE, ACCENT_PURPLE_BOLD,
  MODULE_COLORS, STATUS_WARNING, STATUS_NEUTRAL,
} from '@/lib/chart-colors';

/* ── Accent ──────────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_PURPLE_BOLD;

/* ── Example prompts for the input ───────────────────────────────────── */

export const EXAMPLE_PROMPTS = [
  'A dashing slash that chains into three spinning attacks with increasing fire damage',
  'A ground pound that stuns enemies in a radius and leaves a fire patch',
  'A battle cry that grants allies a shield and increases their attack speed',
  'A shadow step that teleports behind the target and deals backstab damage',
  'A whirlwind spin dealing physical damage to all nearby enemies for 2 seconds',
  'An ice lance projectile that pierces through enemies and slows them',
];

/* ── Damage type → color mapping ─────────────────────────────────────── */

export const DAMAGE_TYPE_COLORS: Record<string, string> = {
  Physical: ACCENT_RED,
  Fire: ACCENT_ORANGE,
  Ice: MODULE_COLORS.core,
  Lightning: STATUS_WARNING,
  None: STATUS_NEUTRAL,
};
