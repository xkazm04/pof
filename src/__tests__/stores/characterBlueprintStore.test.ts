import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { createBlankLayer, createLayerFromTemplate, LAYER_TEMPLATES } from '@/lib/feel-adjustment-layers';

const store = useCharacterBlueprintStore;

beforeEach(() => {
  store.setState({ baseFeelPresetId: FEEL_PRESETS[0].id, feelLayers: [] });
});

describe('characterBlueprintStore feel stack', () => {
  it('defaults to the first preset and an empty stack', () => {
    expect(store.getState().baseFeelPresetId).toBe(FEEL_PRESETS[0].id);
    expect(store.getState().feelLayers).toEqual([]);
  });

  it('sets the base preset', () => {
    store.getState().setBaseFeelPreset('hades');
    expect(store.getState().baseFeelPresetId).toBe('hades');
  });

  it('adds and removes layers', () => {
    const layer = createBlankLayer('Boss');
    store.getState().addFeelLayer(layer);
    expect(store.getState().feelLayers).toHaveLength(1);
    store.getState().removeFeelLayer(layer.id);
    expect(store.getState().feelLayers).toHaveLength(0);
  });

  it('toggles a layer enabled flag', () => {
    const layer = createBlankLayer();
    store.getState().addFeelLayer(layer);
    store.getState().toggleFeelLayer(layer.id);
    expect(store.getState().feelLayers[0].enabled).toBe(false);
    store.getState().toggleFeelLayer(layer.id);
    expect(store.getState().feelLayers[0].enabled).toBe(true);
  });

  it('renames a layer but ignores blank names', () => {
    const layer = createBlankLayer('Old');
    store.getState().addFeelLayer(layer);
    store.getState().renameFeelLayer(layer.id, 'New');
    expect(store.getState().feelLayers[0].name).toBe('New');
    store.getState().renameFeelLayer(layer.id, '   ');
    expect(store.getState().feelLayers[0].name).toBe('New');
  });

  it('reorders layers', () => {
    const a = createBlankLayer('A');
    const b = createBlankLayer('B');
    store.getState().addFeelLayer(a);
    store.getState().addFeelLayer(b);
    store.getState().moveFeelLayer(b.id, 'up');
    expect(store.getState().feelLayers.map((l) => l.name)).toEqual(['B', 'A']);
  });

  it('replaces a layer’s modifiers', () => {
    const layer = createLayerFromTemplate(LAYER_TEMPLATES[0].templateId)!;
    store.getState().addFeelLayer(layer);
    store.getState().setLayerModifiers(layer.id, [{ field: 'combat.baseDamage', op: 'add', value: 5 }]);
    expect(store.getState().feelLayers[0].modifiers).toEqual([{ field: 'combat.baseDamage', op: 'add', value: 5 }]);
  });

  it('clears the stack', () => {
    store.getState().addFeelLayer(createBlankLayer());
    store.getState().clearFeelLayers();
    expect(store.getState().feelLayers).toEqual([]);
  });
});
