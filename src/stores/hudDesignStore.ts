'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';
import type { HudTheme } from '@/components/modules/content/ui-hud/HudThemeEditor/types';
import { DEFAULT_CONFIG as INVENTORY_DEFAULTS, type InventoryConfig } from '@/lib/prompts/inventory';

/**
 * Per-project HUD design drafts: the HUD Theme Editor's theme and the Inventory
 * Designer's config. ReviewableModuleView renders an extra tab only while it is
 * active, so both tools lost every edit on a tab switch while they kept their
 * draft in component state.
 *
 * The theme also carries its APPLIED baseline: the values the last
 * confirmed-successful "Apply to project" run wrote. `beginApply` snapshots the
 * draft at dispatch; `commitApply(true)` moves the baseline to that snapshot (never
 * to a later draft), `commitApply(false)` leaves it and records why.
 */

export const HUD_DESIGN_STORAGE_KEY = 'pof-hud-design';

/** A dispatched apply awaiting its run's outcome. In memory only: a reload drops it. */
export interface PendingThemeApply {
  snapshot: HudTheme;
  /** The apply session's runSeq before this dispatch; its run is the first with a higher seq. */
  runSeqBefore: number;
}

export interface HudProjectDesign {
  themeDraft?: HudTheme;
  /** null/absent = never applied, so an apply sends every row. */
  themeApplied?: HudTheme | null;
  pendingApply?: PendingThemeApply | null;
  lastApplyError?: string | null;
  inventoryDraft?: InventoryConfig;
}

interface HudDesignState {
  byProject: Record<string, HudProjectDesign>;
  setThemeDraft: (projectPath: string, theme: HudTheme) => void;
  getThemeDraft: (projectPath: string) => HudTheme;
  getThemeApplied: (projectPath: string) => HudTheme | null;
  setInventoryDraft: (projectPath: string, config: InventoryConfig) => void;
  getInventoryDraft: (projectPath: string) => InventoryConfig;
  beginApply: (projectPath: string, snapshot: HudTheme, runSeqBefore?: number) => void;
  commitApply: (projectPath: string, success: boolean, error?: string) => void;
}

export const APPLY_FAILED_MESSAGE = 'The apply run failed. The project keeps its previously applied values.';

// ── Lossless load: a persisted draft keeps every value it has; fields added since
// it was saved come from today's defaults. ──────────────────────────────────

export function loadThemeDraft(saved: Partial<HudTheme> | undefined): HudTheme | undefined {
  if (!saved) return undefined;
  return {
    ...DEFAULT_THEME, ...saved,
    elementColors: { ...DEFAULT_THEME.elementColors, ...saved.elementColors },
  };
}

export function loadInventoryDraft(saved: Partial<InventoryConfig> | undefined): InventoryConfig | undefined {
  return saved ? { ...INVENTORY_DEFAULTS, ...saved } : undefined;
}

function loadProject(saved: HudProjectDesign): HudProjectDesign {
  return {
    ...saved,
    themeDraft: loadThemeDraft(saved.themeDraft),
    themeApplied: loadThemeDraft(saved.themeApplied ?? undefined) ?? null,
    inventoryDraft: loadInventoryDraft(saved.inventoryDraft),
    pendingApply: null,
  };
}

export const useHudDesignStore = create<HudDesignState>()(
  persist(
    (set, get) => {
      const patch = (projectPath: string, fn: (d: HudProjectDesign) => HudProjectDesign) =>
        set((s) => ({ byProject: { ...s.byProject, [projectPath]: fn(s.byProject[projectPath] ?? {}) } }));

      return {
        byProject: {},

        setThemeDraft: (projectPath, theme) => patch(projectPath, (d) => ({ ...d, themeDraft: theme })),
        getThemeDraft: (projectPath) => get().byProject[projectPath]?.themeDraft ?? DEFAULT_THEME,
        getThemeApplied: (projectPath) => get().byProject[projectPath]?.themeApplied ?? null,

        setInventoryDraft: (projectPath, config) => patch(projectPath, (d) => ({ ...d, inventoryDraft: config })),
        getInventoryDraft: (projectPath) => get().byProject[projectPath]?.inventoryDraft ?? INVENTORY_DEFAULTS,

        beginApply: (projectPath, snapshot, runSeqBefore = 0) =>
          patch(projectPath, (d) => ({ ...d, pendingApply: { snapshot, runSeqBefore }, lastApplyError: null })),

        commitApply: (projectPath, success, error) => {
          const pending = get().byProject[projectPath]?.pendingApply;
          if (!pending) return;
          patch(projectPath, (d) => (success
            ? { ...d, themeApplied: pending.snapshot, pendingApply: null, lastApplyError: null }
            : { ...d, pendingApply: null, lastApplyError: error ?? APPLY_FAILED_MESSAGE }));
        },
      };
    },
    {
      name: HUD_DESIGN_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // A pending apply belongs to a run in this page's memory; never persist it.
      partialize: (s) => ({
        byProject: Object.fromEntries(
          Object.entries(s.byProject).map(([k, d]) => [k, { ...d, pendingApply: null }]),
        ),
      }),
      merge: (persisted, current) => {
        const saved = (persisted as { byProject?: Record<string, HudProjectDesign> } | undefined)?.byProject ?? {};
        return {
          ...current,
          byProject: Object.fromEntries(Object.entries(saved).map(([k, d]) => [k, loadProject(d)])),
        };
      },
    },
  ),
);
