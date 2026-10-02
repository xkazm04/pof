import { HUD_THEME_PARAMS, formatExportLine, type HudWidget } from './themeSchema';
import type { HudTheme } from './types';

// ── Theme diff: what an apply would change in the project ───────────────────
//
// Rows come from HUD_THEME_PARAMS and each side is rendered with the same
// formatExportLine the .h export uses, so the diff speaks the export's own
// vocabulary (no second name map, no .h parsing). A row is a change when its
// export line differs: a move below the row's export precision writes the same
// literal, so it is not a change.

export interface ThemeChange {
  /** The UPROPERTY name (row ueName). */
  name: string;
  widget: HudWidget;
  /** The UPROPERTY Category. */
  category: string;
  /** The applied declaration, or null when nothing has been applied yet. */
  from: string | null;
  /** The draft declaration the apply writes. */
  to: string;
}

/** Rows whose export line differs between `applied` (null = never applied: every row) and `draft`. */
export function diffThemeExport(applied: HudTheme | null, draft: HudTheme): ThemeChange[] {
  const changes: ThemeChange[] = [];
  for (const p of HUD_THEME_PARAMS) {
    const to = formatExportLine(p, draft);
    const from = applied ? formatExportLine(p, applied) : null;
    if (from === to) continue;
    changes.push({ name: p.ueName, widget: p.widget, category: p.category, from, to });
  }
  return changes;
}

export interface ApplyStatus { label: string; disabled: boolean }

/** The Apply button's honest state: running wins, then nothing-to-send, then the count. */
export function applyStatus({ pending, running }: { pending: number; running: boolean }): ApplyStatus {
  if (running) return { label: 'Applying...', disabled: true };
  if (pending === 0) return { label: 'Up to date', disabled: true };
  return { label: `Apply ${pending} change${pending === 1 ? '' : 's'}`, disabled: false };
}
