import { describe, it, expect } from 'vitest';
import { FEEL_FIELD_META, FEEL_PRESETS, getNestedValue } from '@/lib/character-feel-optimizer';
import {
  createLayerFromTemplate,
  resolveStack,
  type AdjustmentLayer,
} from '@/lib/feel-adjustment-layers';
import { INSPECTOR_LAYER_ID, setInspectorOverride } from '@/lib/character/inspector-fields';
import {
  CURVE_CHANNELS,
  PLAYGROUND_LAYER_ID,
  applyCurveEdit,
  channelCoord,
  decodeCurves,
  encodeCurves,
  type CurvePoint,
} from '@/lib/character/feel-curve-codec';

const darkSouls = FEEL_PRESETS.find((p) => p.id === 'dark-souls')!;
const diablo4 = FEEL_PRESETS.find((p) => p.id === 'diablo4')!;

const SECONDS = new Set(['dodge.duration', 'dodge.iFrameStart', 'dodge.iFrameDuration']);

function channel(field: string) {
  const ch = CURVE_CHANNELS.find((c) => c.field === field);
  if (!ch) throw new Error(`no channel ${field}`);
  return ch;
}

/** Copy of `points` with `field`'s bound coordinate moved to encode `value`. */
function withHandle(points: CurvePoint[], field: string, value: number): CurvePoint[] {
  const ch = channel(field);
  const out = points.map((p) => ({ ...p }));
  out[ch.index][ch.axis] = channelCoord(field, value);
  return out;
}

describe('feel-curve-codec — one invertible table over FEEL_FIELD_META', () => {
  it('case 1: encode then decode returns every preset value (66 of 66)', () => {
    let exact = 0;
    for (const p of FEEL_PRESETS) {
      const decoded = decodeCurves(encodeCurves(p.profile));
      for (const ch of CURVE_CHANNELS) {
        const want = getNestedValue(p.profile, ch.field);
        const got = decoded[ch.field];
        const tol = SECONDS.has(ch.field) ? 0.005 : ch.field === 'camera.lagSpeed' ? 0.05 : 0;
        if (Math.abs(got - want) <= tol) exact++;
      }
    }
    expect(CURVE_CHANNELS).toHaveLength(11);
    expect(exact).toBe(66);
  });

  it('case 2: every channel range is the FEEL_FIELD_META row; diablo4 fov/arm round-trip', () => {
    for (const ch of CURVE_CHANNELS) {
      const meta = FEEL_FIELD_META.find((m) => m.key === ch.field)!;
      expect(meta, ch.field).toBeDefined();
      expect([ch.min, ch.max], ch.field).toEqual([meta.min, meta.max]);
    }
    const decoded = decodeCurves(encodeCurves(diablo4.profile));
    expect(decoded['camera.fovBase']).toBe(60);
    expect(decoded['camera.armLength']).toBe(1400);
  });

  it('case 3: moving only the dodge.distance coordinate changes only dodge.distance', () => {
    const curves = encodeCurves(darkSouls.profile);
    const before = decodeCurves(curves);
    const ch = channel('dodge.distance');
    const dodge = curves.dodge.map((p) => ({ ...p }));
    dodge[ch.index][ch.axis] += 0.1;
    const after = decodeCurves({ ...curves, dodge });
    expect(after['dodge.distance']).not.toBe(before['dodge.distance']);
    for (const c of CURVE_CHANNELS) {
      if (c.field === 'dodge.distance') continue;
      expect(Object.is(after[c.field], before[c.field]), c.field).toBe(true);
    }
  });

  it('case 4: a walk-handle edit writes one set modifier in the reserved layer', () => {
    const pts = withHandle(encodeCurves(darkSouls.profile).accel, 'movement.maxWalkSpeed', 450);
    const result = applyCurveEdit([], darkSouls.profile, 'accel', pts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: PLAYGROUND_LAYER_ID, enabled: true });
    expect(result[0].modifiers).toEqual([{ field: 'movement.maxWalkSpeed', op: 'set', value: 450 }]);
    expect(resolveStack(darkSouls.profile, result).movement.maxWalkSpeed).toBe(450);
  });

  it('case 5: dragging back to the value beneath removes the modifier and drops the emptied layer', () => {
    for (const input of [[] as AdjustmentLayer[], [createLayerFromTemplate('frenzy')!]]) {
      const beneathCurves = encodeCurves(resolveStack(darkSouls.profile, input));
      const edited = applyCurveEdit(
        input, darkSouls.profile, 'accel',
        withHandle(beneathCurves.accel, 'movement.maxWalkSpeed', 450),
      );
      expect(edited.some((l) => l.id === PLAYGROUND_LAYER_ID)).toBe(true);
      const back = applyCurveEdit(edited, darkSouls.profile, 'accel', beneathCurves.accel);
      expect(back).toEqual(input);
    }
  });

  it('case 6: a Frenzy layer beneath decodes walk 352; a sprint-only drag writes sprint alone', () => {
    const layers = [createLayerFromTemplate('frenzy')!];
    const curves = encodeCurves(resolveStack(darkSouls.profile, layers));
    expect(decodeCurves(curves)['movement.maxWalkSpeed']).toBe(352);
    const result = applyCurveEdit(
      layers, darkSouls.profile, 'accel',
      withHandle(curves.accel, 'movement.maxSprintSpeed', 700),
    );
    const reserved = result.find((l) => l.id === PLAYGROUND_LAYER_ID)!;
    expect(reserved.modifiers).toEqual([{ field: 'movement.maxSprintSpeed', op: 'set', value: 700 }]);
    expect(result[0]).toBe(layers[0]);
    expect(resolveStack(darkSouls.profile, result).movement.maxWalkSpeed).toBeCloseTo(352, 6);
  });

  it('case 8 [guard]: a playground edit never touches the inspector-overrides layer', () => {
    const withInspector = setInspectorOverride([], 'FOV', 95, darkSouls.profile);
    const inspector = withInspector.find((l) => l.id === INSPECTOR_LAYER_ID)!;
    const curves = encodeCurves(resolveStack(darkSouls.profile, withInspector));
    const result = applyCurveEdit(
      withInspector, darkSouls.profile, 'dodge',
      withHandle(curves.dodge, 'dodge.distance', 500),
    );
    expect(result.find((l) => l.id === INSPECTOR_LAYER_ID)).toBe(inspector);
    expect(result.find((l) => l.id === PLAYGROUND_LAYER_ID)!.modifiers)
      .toEqual([{ field: 'dodge.distance', op: 'set', value: 500 }]);
  });
});
