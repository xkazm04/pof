import type { HudTheme } from './types';
import { themeDefaults } from './themeSchema';

// ── Defaults (matching C++ UPROPERTYs) ─────────────────────────────────────

// Derived from HUD_THEME_PARAMS (themeSchema.ts) — the one place each default is declared.
export const DEFAULT_THEME: HudTheme = themeDefaults();

// Scripted combat sequence — repeats every CYCLE_DURATION seconds
export const CYCLE_DURATION = 8.0;
