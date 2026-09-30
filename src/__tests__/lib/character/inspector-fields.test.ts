import { describe, it, expect } from 'vitest';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveStack, sanitizeLayers, type AdjustmentLayer } from '@/lib/feel-adjustment-layers';
import {
  INSPECTOR_LAYER_ID,
  inspectorRows,
  setInspectorOverride,
  cameraMetricValues,
} from '@/lib/character/inspector-fields';

const BASE = FEEL_PRESETS[0].profile; // dark-souls: the store's default base preset

function rowOf(layers: AdjustmentLayer[], name: string) {
  const row = inspectorRows(BASE, layers).rows.find((r) => r.name === name);
  if (!row) throw new Error(`no row ${name}`);
  return row;
}

function inspectorLayer(layers: AdjustmentLayer[]) {
  return layers.find((l) => l.id === INSPECTOR_LAYER_ID);
}

describe('inspector-fields — the inspector reads the persisted feel stack', () => {
  it('case 1: rows come from the resolved base, not a hand-typed constant', () => {
    const row = rowOf([], 'MaxWalkSpeed');
    expect(row.current).toBe(320);
    expect(row.defaultVal).toBe(320);
    expect(row.isModified).toBe(false);
  });

  it('case 2: an edit becomes one set modifier in the reserved inspector layer', () => {
    const layers = setInspectorOverride([], 'MaxWalkSpeed', 450, BASE);
    const inspector = layers.filter((l) => l.id === INSPECTOR_LAYER_ID);
    expect(inspector).toHaveLength(1);
    expect(inspector[0].modifiers).toEqual([{ field: 'movement.maxWalkSpeed', op: 'set', value: 450 }]);
    expect(resolveStack(BASE, layers).movement.maxWalkSpeed).toBe(450);
  });

  it('case 3: a repeat edit replaces; setting the value beneath drops the modifier and the empty layer', () => {
    const once = setInspectorOverride([], 'MaxWalkSpeed', 450, BASE);
    const twice = setInspectorOverride(once, 'MaxWalkSpeed', 500, BASE);
    expect(inspectorLayer(twice)?.modifiers).toEqual([{ field: 'movement.maxWalkSpeed', op: 'set', value: 500 }]);
    const back = setInspectorOverride(twice, 'MaxWalkSpeed', 320, BASE);
    expect(inspectorLayer(back)).toBeUndefined();
    expect(back).toEqual([]);
  });

  it('case 4: values clamp to FEEL_FIELD_META and slider bounds come from it', () => {
    const layers = setInspectorOverride([], 'MaxWalkSpeed', 900, BASE);
    const row = rowOf(layers, 'MaxWalkSpeed');
    expect(row.current).toBe(600);
    expect({ min: row.min, max: row.max }).toEqual({ min: 200, max: 600 });
    expect(row.isModified).toBe(true);
  });

  it('case 6: fields FeelProfile does not model are flagged, counted and read-only', () => {
    const view = inspectorRows(BASE, []);
    for (const name of ['BlockReduction', 'CameraOffset', 'RotationLag']) {
      const row = view.rows.find((r) => r.name === name);
      expect(row, name).toBeDefined();
      expect(row?.applies).toBe(false);
      expect(row?.editable).toBe(false);
    }
    expect(view.unmappedCount).toBe(3);
    expect(view.rows.filter((r) => r.applies)).toHaveLength(12);
  });

  it('case 7: the camera metric reads the resolved profile', () => {
    expect(cameraMetricValues(resolveStack(BASE, []))).toEqual({ fov: 80, arm: 600, lag: 6 });
  });

  it('case 8 [guard]: a disabled inspector layer is inert and survives a JSON round-trip', () => {
    const other: AdjustmentLayer = {
      id: 'layer_x', name: 'Frenzy', enabled: true,
      modifiers: [{ field: 'combat.attackSpeed', op: 'pct', value: 30 }],
    };
    const withInspector = setInspectorOverride([other], 'FOV', 95, BASE);
    const disabled = withInspector.map((l) => (l.id === INSPECTOR_LAYER_ID ? { ...l, enabled: false } : l));
    expect(resolveStack(BASE, disabled)).toEqual(resolveStack(BASE, [other]));
    const roundTripped = sanitizeLayers(JSON.parse(JSON.stringify(withInspector)));
    expect(inspectorLayer(roundTripped)?.modifiers).toEqual([{ field: 'camera.fovBase', op: 'set', value: 95 }]);
  });
});
