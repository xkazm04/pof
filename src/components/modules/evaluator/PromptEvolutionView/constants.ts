import type { VariantStyle } from '@/types/prompt-evolution';
import { MODULE_COLORS, STATUS_NEUTRAL, ACCENT_EMERALD_DARK } from '@/lib/chart-colors';
import { SUB_MODULES } from '@/lib/module-registry';

// ── Constants ───────────────────────────────────────────────────────────────

export const ACCENT = ACCENT_EMERALD_DARK; // Emerald for evolution/growth

// Plain-language Simple Mode vs. full statistical Advanced Mode.
export type ViewMode = 'simple' | 'advanced';

export const STYLE_COLORS: Record<VariantStyle, string> = {
  imperative: MODULE_COLORS.evaluator,
  descriptive: MODULE_COLORS.core,
  'step-by-step': MODULE_COLORS.content,
  holistic: MODULE_COLORS.systems,
  'example-rich': ACCENT_EMERALD_DARK,
  minimal: STATUS_NEUTRAL,
};

export const STATUS_COLORS = {
  running: MODULE_COLORS.content,
  concluded: ACCENT_EMERALD_DARK,
  cancelled: STATUS_NEUTRAL,
};

// ── Module picker options ───────────────────────────────────────────────────
// Derived from the registry (the single source of truth getModuleChecklist
// reads). The old hardcoded list had drifted: 5 phantom ids (arpg-abilities,
// arpg-ai, arpg-audio, arpg-vfx, arpg-multiplayer) returned empty checklists
// and dead-ended the create form, while 5 real modules (arpg-animation,
// arpg-gas, arpg-enemy-ai, arpg-loot, arpg-polish) were unreachable.
export const MODULE_OPTIONS = SUB_MODULES.map((m) => ({ id: m.id, label: m.label }));
