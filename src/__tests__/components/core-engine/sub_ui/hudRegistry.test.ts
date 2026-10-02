import { describe, it, expect } from 'vitest';
import {
  HUD_REGISTRY, validateHudRegistry, placementsForContext, resolveWidgetId,
  arpgPreviewLayout, performanceBudgets,
} from '@/components/modules/core-engine/sub_ui/_shared/hudRegistry';
import {
  Z_LAYERS, Z_DEPTH_LABELS, WIDGET_PLACEMENTS, WIDGET_Z_COLOR, HUD_OVERLAYS, FLOW_EDGES,
  PERFORMANCE_BUDGETS, HUD_CONTEXTS,
} from '@/components/modules/core-engine/sub_ui/_shared/data';
import { STATUS_ERROR } from '@/lib/chart-colors';

/**
 * Acceptance for scan-sweep --challenge card game-ui-hud/A: one HUD widget
 * registry owns widget identity, and every hand table in sub_ui is a projection
 * of it. validateHudRegistry turns a broken join into a named issue.
 */

const widgetIdsAt = (depth: number) =>
  HUD_REGISTRY.widgets.filter(w => w.zDepth === depth).map(w => w.id);

describe('HUD widget registry (game-ui-hud/A)', () => {
  it('case 1: the shipped registry validates clean', () => {
    expect(validateHudRegistry(HUD_REGISTRY)).toEqual([]);
  });

  it('case 2: an unknown widget reference in a context is a named issue', () => {
    const broken = {
      ...HUD_REGISTRY,
      contexts: [...HUD_REGISTRY.contexts, { name: 'X', color: STATUS_ERROR, visible: ['Nope'], hidden: [] }],
    };
    expect(validateHudRegistry(broken)).toContainEqual({ kind: 'unknown-widget', context: 'X', widget: 'Nope' });
  });

  it('case 3: Force Focus and Lightsaber Combat each resolve all 3 visible widgets to a placement', () => {
    expect(placementsForContext('Force Focus')).toHaveLength(3);
    expect(placementsForContext('Lightsaber Combat')).toHaveLength(3);
  });

  it('case 4: every placement depth is labelled and Z_LAYERS is the registry grouped by depth', () => {
    for (const p of WIDGET_PLACEMENTS) expect(Z_DEPTH_LABELS[p.zDepth], p.id).toBeDefined();
    const depths = [...new Set(HUD_REGISTRY.widgets.map(w => w.zDepth))].sort((a, b) => a - b);
    expect(Z_LAYERS.map(l => l.depth)).toEqual(depths);
    for (const layer of Z_LAYERS) {
      expect(layer.widgets).toEqual(widgetIdsAt(layer.depth));
      expect(layer.label).toBe(Z_DEPTH_LABELS[layer.depth].label);
    }
  });

  it('case 5: the ARPG preview health globe uses the compositor placement rect', () => {
    const preview = arpgPreviewLayout().find(e => e.id === 'health-globe');
    const placement = WIDGET_PLACEMENTS.find(p => p.id === 'health-globe');
    expect(preview).toBeDefined();
    expect(placement).toBeDefined();
    const rect = (r: { x: number; y: number; w: number; h: number }) => [r.x, r.y, r.w, r.h];
    expect(rect(preview!)).toEqual(rect(placement!));
  });

  it('case 6: every spelling of one widget resolves to one id', () => {
    const enemy = resolveWidgetId('EnemyBars');
    expect(enemy).toBeDefined();
    expect(resolveWidgetId('EnemyHealthBar')).toBe(enemy);
    expect(resolveWidgetId('WBP_EnemyHealthBar')).toBe(enemy);
    const dmg = resolveWidgetId('DamageNumbers');
    expect(dmg).toBeDefined();
    expect(resolveWidgetId('DamageText')).toBe(dmg);
    expect(resolveWidgetId('DamageNumber')).toBe(dmg);
    expect(resolveWidgetId('Nope')).toBeUndefined();
  });

  it('case 7: the Inventory trigger row and the HUD->Inventory edge come from one input action', () => {
    const row = HUD_OVERLAYS.find(n => n.id === 'inventory');
    const edge = FLOW_EDGES.find(e => e.source === 'HUD' && e.target === 'Inventory');
    expect(row?.trigger).toBe('IA_OpenInventory (Tab / I)');
    expect(edge?.label).toBe(row?.trigger);
  });

  it('case 8 [guard]: Combat keeps its 6 placements and Bindings counts the bound widgets', () => {
    expect(placementsForContext('Combat').map(p => [p.id, p.x, p.y, p.w, p.h])).toEqual([
      ['HealthBar', 2, 3, 18, 5],
      ['ManaBar', 2, 10, 14, 4],
      ['AbilitySlots', 30, 88, 40, 9],
      ['EnemyBars', 35, 20, 14, 4],
      ['DamageNumbers', 45, 30, 12, 5],
      ['StaminaBar', 2, 16, 12, 3],
    ]);
    const bindings = PERFORMANCE_BUDGETS.find(b => b.label === 'Bindings');
    expect(bindings?.current).toBe(8);
    expect(performanceBudgets().find(b => b.label === 'Bindings')?.current)
      .toBe(HUD_REGISTRY.widgets.filter(w => w.binding).length);
  });
});

describe('validateHudRegistry lint rules beyond unknown-widget', () => {
  it('flags a widget whose depth has no label', () => {
    const broken = {
      ...HUD_REGISTRY,
      widgets: [...HUD_REGISTRY.widgets, { id: 'Stray', label: 'Stray', zDepth: 9 }],
    };
    expect(validateHudRegistry(broken)).toContainEqual({ kind: 'unlabelled-depth', widget: 'Stray', zDepth: 9 });
  });

  it('flags a placement no context shows', () => {
    const broken = {
      ...HUD_REGISTRY,
      widgets: [...HUD_REGISTRY.widgets, { id: 'Orphan', label: 'Orphan', zDepth: 1, placement: { x: 1, y: 1, w: 1, h: 1 } }],
    };
    expect(validateHudRegistry(broken)).toContainEqual({ kind: 'unreachable-placement', widget: 'Orphan' });
  });

  it('flags a visible widget with no placement (the compositor cannot draw it)', () => {
    const broken = {
      ...HUD_REGISTRY,
      contexts: [...HUD_REGISTRY.contexts, { name: 'Y', color: STATUS_ERROR, visible: ['Inventory'], hidden: [] }],
    };
    expect(validateHudRegistry(broken)).toContainEqual({ kind: 'unplaced-widget', context: 'Y', widget: 'Inventory' });
  });

  it('flags a name claimed by two widgets', () => {
    const broken = {
      ...HUD_REGISTRY,
      widgets: [...HUD_REGISTRY.widgets, { id: 'Dup', label: 'Dup', zDepth: 1, aliases: ['EnemyHealthBar'] }],
    };
    expect(validateHudRegistry(broken)).toContainEqual({ kind: 'duplicate-name', widget: 'EnemyHealthBar' });
  });
});

describe('projections', () => {
  it('every placement has a depth colour without hand overrides, and contexts carry canonical ids', () => {
    for (const p of WIDGET_PLACEMENTS) expect(WIDGET_Z_COLOR[p.id], p.id).toBe(Z_DEPTH_LABELS[p.zDepth].color);
    const ids = new Set(HUD_REGISTRY.widgets.map(w => w.id));
    for (const ctx of HUD_CONTEXTS) {
      for (const w of [...ctx.visible, ...ctx.hidden]) expect(ids.has(w), `${ctx.name}:${w}`).toBe(true);
    }
  });
});
