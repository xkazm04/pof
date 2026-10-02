import { describe, it, expect, beforeEach } from 'vitest';
import { useHudDesignStore, HUD_DESIGN_STORAGE_KEY } from '@/stores/hudDesignStore';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';
import { diffThemeExport } from '@/components/modules/content/ui-hud/HudThemeEditor/themeDiff';
import { DEFAULT_CONFIG as INVENTORY_DEFAULTS } from '@/lib/prompts/inventory';
import type { HudTheme } from '@/components/modules/content/ui-hud/HudThemeEditor/types';

/**
 * hudDesignStore: the HUD Theme Editor's and the Inventory Designer's drafts live
 * per project in a persisted store (ReviewableModuleView unmounts an inactive extra
 * tab, so component state died on every tab switch), plus the theme's applied
 * baseline, which moves only on a confirmed-successful apply.
 */

const store = () => useHudDesignStore.getState();
const withFade = (v: number): HudTheme => ({ ...structuredClone(DEFAULT_THEME), fadeOutDelay: v });

beforeEach(() => {
  localStorage.clear();
  useHudDesignStore.setState({ byProject: {} });
});

describe('hudDesignStore: per-project drafts', () => {
  it('a theme draft is per project and survives a rehydrate from the persist key', async () => {
    const T = withFade(4.5);
    store().setThemeDraft('C:/P1', T);
    expect(store().getThemeDraft('C:/P1')).toEqual(T);
    expect(store().getThemeDraft('C:/P2')).toEqual(DEFAULT_THEME);

    const persisted = localStorage.getItem(HUD_DESIGN_STORAGE_KEY);
    expect(persisted).toBeTruthy();
    useHudDesignStore.setState({ byProject: {} });
    expect(store().getThemeDraft('C:/P1')).toEqual(DEFAULT_THEME);
    localStorage.setItem(HUD_DESIGN_STORAGE_KEY, persisted!);
    await useHudDesignStore.persist.rehydrate();
    expect(store().getThemeDraft('C:/P1')).toEqual(T);
  });

  it('an older persisted draft loads losslessly: its values kept, missing fields from defaults', async () => {
    const older: Partial<HudTheme> = withFade(3.0);
    delete older.fadeOutDelay;
    const olderColors = { ...older.elementColors! };
    delete olderColors.Heal;
    const oldDraft = { ...older, barInterpSpeed: 22, elementColors: { ...olderColors, Fire: { r: 0.5, g: 0.5, b: 0.5, a: 1 } } };
    localStorage.setItem(HUD_DESIGN_STORAGE_KEY, JSON.stringify({
      state: { byProject: { 'C:/P1': { themeDraft: oldDraft, inventoryDraft: { gridCols: 10 } } } },
      version: 1,
    }));
    await useHudDesignStore.persist.rehydrate();

    const t = store().getThemeDraft('C:/P1');
    expect(t.barInterpSpeed).toBe(22);
    expect(t.elementColors.Fire).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
    expect(t.fadeOutDelay).toBe(DEFAULT_THEME.fadeOutDelay);
    expect(t.elementColors.Heal).toEqual(DEFAULT_THEME.elementColors.Heal);

    const inv = store().getInventoryDraft('C:/P1');
    expect(inv.gridCols).toBe(10);
    expect(inv.gridRows).toBe(INVENTORY_DEFAULTS.gridRows);
    expect(inv.slotTypes).toEqual(INVENTORY_DEFAULTS.slotTypes);
  });

  it('an inventory draft is per project and defaults to DEFAULT_CONFIG', () => {
    store().setInventoryDraft('C:/P1', { ...INVENTORY_DEFAULTS, gridCols: 10 });
    expect(store().getInventoryDraft('C:/P1').gridCols).toBe(10);
    expect(store().getInventoryDraft('C:/P2')).toEqual(INVENTORY_DEFAULTS);
  });
});

describe('hudDesignStore: apply lifecycle', () => {
  it('a successful apply commits the dispatch snapshot, not the later draft', () => {
    const S = withFade(4.5);
    store().setThemeDraft('C:/P1', S);
    expect(store().getThemeApplied('C:/P1')).toBeNull();
    store().beginApply('C:/P1', S);
    const D = { ...S, barInterpSpeed: 20 };
    store().setThemeDraft('C:/P1', D);
    store().commitApply('C:/P1', true);

    expect(store().getThemeApplied('C:/P1')).toEqual(S);
    expect(store().byProject['C:/P1'].lastApplyError ?? null).toBeNull();
    expect(store().byProject['C:/P1'].pendingApply ?? null).toBeNull();
    expect(diffThemeExport(store().getThemeApplied('C:/P1'), store().getThemeDraft('C:/P1')).map(c => c.name))
      .toEqual(['BarInterpSpeed']);
  });

  it('a failed apply leaves the baseline unchanged and records the failure', () => {
    store().beginApply('C:/P1', DEFAULT_THEME);
    store().commitApply('C:/P1', true);
    const S = withFade(4.5);
    store().beginApply('C:/P1', S);
    store().commitApply('C:/P1', false);

    expect(store().getThemeApplied('C:/P1')).toEqual(DEFAULT_THEME);
    expect(store().byProject['C:/P1'].lastApplyError).toMatch(/fail/i);
    expect(store().byProject['C:/P1'].pendingApply ?? null).toBeNull();
  });

  it('[guard] commitApply with nothing pending is a no-op', () => {
    store().commitApply('C:/P1', true);
    expect(store().getThemeApplied('C:/P1')).toBeNull();
  });
});
