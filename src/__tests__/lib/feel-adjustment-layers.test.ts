import { describe, it, expect } from 'vitest';
import { FEEL_PRESETS, type FeelProfile } from '@/lib/character-feel-optimizer';
import {
  resolveStack,
  describeModifier,
  describeLayer,
  createBlankLayer,
  createLayerFromTemplate,
  moveLayer,
  sanitizeLayers,
  LAYER_TEMPLATES,
  type AdjustmentLayer,
} from '@/lib/feel-adjustment-layers';

/** Dark Souls Heavy — known base values: turnRate 360, attackSpeed 0.7, dodge.staminaCost 35. */
const BASE: FeelProfile = FEEL_PRESETS[0].profile;

function layer(partial: Partial<AdjustmentLayer> & Pick<AdjustmentLayer, 'modifiers'>): AdjustmentLayer {
  return { id: partial.id ?? 'l1', name: partial.name ?? 'Layer', enabled: partial.enabled ?? true, modifiers: partial.modifiers };
}

describe('resolveStack', () => {
  it('applies a percentage modifier multiplicatively', () => {
    const resolved = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'movement.turnRate', op: 'pct', value: -20 }] }),
    ]);
    // 360 * (1 - 0.20) = 288
    expect(resolved.movement.turnRate).toBe(288);
  });

  it('applies an additive modifier', () => {
    const resolved = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'dodge.staminaCost', op: 'add', value: 10 }] }),
    ]);
    expect(resolved.dodge.staminaCost).toBe(45);
  });

  it('applies a set (absolute override) modifier', () => {
    const resolved = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'dodge.staminaCost', op: 'set', value: 0 }] }),
    ]);
    expect(resolved.dodge.staminaCost).toBe(0);
  });

  it('stacks multiple enabled layers in order', () => {
    const resolved = resolveStack(BASE, [
      layer({ id: 'a', modifiers: [{ field: 'movement.turnRate', op: 'pct', value: -20 }] }),
      layer({ id: 'b', modifiers: [{ field: 'combat.attackSpeed', op: 'pct', value: 30 }] }),
    ]);
    expect(resolved.movement.turnRate).toBe(288);
    expect(resolved.combat.attackSpeed).toBeCloseTo(0.91, 5);
  });

  it('skips disabled layers', () => {
    const resolved = resolveStack(BASE, [
      layer({ enabled: false, modifiers: [{ field: 'movement.turnRate', op: 'set', value: 999 }] }),
    ]);
    expect(resolved.movement.turnRate).toBe(360);
  });

  it('later layers win for conflicting set ops (order matters)', () => {
    const layers: AdjustmentLayer[] = [
      layer({ id: 'a', modifiers: [{ field: 'movement.turnRate', op: 'set', value: 400 }] }),
      layer({ id: 'b', modifiers: [{ field: 'movement.turnRate', op: 'set', value: 800 }] }),
    ];
    expect(resolveStack(BASE, layers).movement.turnRate).toBe(800);
    // Reordering flips the winner
    expect(resolveStack(BASE, [layers[1], layers[0]]).movement.turnRate).toBe(400);
  });

  it('clamps resolved values to the field metadata range', () => {
    const high = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'movement.turnRate', op: 'set', value: 5000 }] }),
    ]);
    expect(high.movement.turnRate).toBe(1200); // meta max

    const low = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'movement.turnRate', op: 'set', value: -100 }] }),
    ]);
    expect(low.movement.turnRate).toBe(200); // meta min
  });

  it('applies modifiers to fields without metadata (no clamp)', () => {
    const resolved = resolveStack(BASE, [
      layer({ modifiers: [{ field: 'dodge.cancelWindowStart', op: 'add', value: 0.1 }] }),
    ]);
    // base cancelWindowStart = 0.55
    expect(resolved.dodge.cancelWindowStart).toBeCloseTo(0.65, 5);
  });

  it('does not mutate the base profile', () => {
    const before = BASE.movement.turnRate;
    resolveStack(BASE, [layer({ modifiers: [{ field: 'movement.turnRate', op: 'set', value: 111 }] })]);
    expect(BASE.movement.turnRate).toBe(before);
  });

  it('returns a clone equal to base when there are no layers', () => {
    const resolved = resolveStack(BASE, []);
    expect(resolved).toEqual(BASE);
    expect(resolved).not.toBe(BASE);
    expect(resolved.movement).not.toBe(BASE.movement);
  });
});

describe('describeModifier', () => {
  it('formats a percentage modifier with the field label and sign', () => {
    expect(describeModifier({ field: 'movement.turnRate', op: 'pct', value: -20 })).toBe('Turn Rate -20%');
    expect(describeModifier({ field: 'combat.attackSpeed', op: 'pct', value: 30 })).toBe('Attack Speed +30%');
  });

  it('formats an additive modifier', () => {
    expect(describeModifier({ field: 'dodge.staminaCost', op: 'add', value: 10 })).toBe('Dodge Stamina Cost +10');
  });

  it('formats a set modifier', () => {
    expect(describeModifier({ field: 'dodge.staminaCost', op: 'set', value: 0 })).toBe('Dodge Stamina Cost = 0');
  });
});

describe('describeLayer', () => {
  it('joins modifier descriptions', () => {
    const text = describeLayer(layer({
      modifiers: [
        { field: 'movement.turnRate', op: 'pct', value: -20 },
        { field: 'combat.attackSpeed', op: 'pct', value: 30 },
      ],
    }));
    expect(text).toBe('Turn Rate -20%, Attack Speed +30%');
  });

  it('describes an empty layer', () => {
    expect(describeLayer(layer({ modifiers: [] }))).toBe('No modifiers');
  });
});

describe('createLayerFromTemplate', () => {
  it('creates an enabled layer with a unique id and cloned modifiers', () => {
    const tpl = LAYER_TEMPLATES[0];
    const a = createLayerFromTemplate(tpl.templateId);
    const b = createLayerFromTemplate(tpl.templateId);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.enabled).toBe(true);
    expect(a!.name).toBe(tpl.name);
    expect(a!.id).not.toBe(b!.id);
    // Mutating the created layer must not affect the template
    a!.modifiers[0].value = 999;
    expect(tpl.modifiers[0].value).not.toBe(999);
  });

  it('returns null for an unknown template id', () => {
    expect(createLayerFromTemplate('does-not-exist')).toBeNull();
  });
});

describe('createBlankLayer', () => {
  it('creates an enabled layer with no modifiers and a unique id', () => {
    const a = createBlankLayer();
    const b = createBlankLayer();
    expect(a.enabled).toBe(true);
    expect(a.modifiers).toEqual([]);
    expect(a.id).not.toBe(b.id);
  });
});

describe('moveLayer', () => {
  const layers: AdjustmentLayer[] = [
    layer({ id: 'a', modifiers: [] }),
    layer({ id: 'b', modifiers: [] }),
    layer({ id: 'c', modifiers: [] }),
  ];

  it('moves a layer up', () => {
    expect(moveLayer(layers, 'b', 'up').map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves a layer down', () => {
    expect(moveLayer(layers, 'b', 'down').map((l) => l.id)).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op at the boundary', () => {
    expect(moveLayer(layers, 'a', 'up').map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(moveLayer(layers, 'c', 'down').map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for an unknown id', () => {
    expect(moveLayer(layers, 'z', 'up').map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('sanitizeLayers', () => {
  it('keeps well-formed layers and drops malformed ones', () => {
    const result = sanitizeLayers([
      { id: 'a', name: 'Good', enabled: true, modifiers: [{ field: 'movement.turnRate', op: 'pct', value: -20 }] },
      { id: 'b', name: 'Bad op', enabled: true, modifiers: [{ field: 'x', op: 'nope', value: 1 }] },
      { name: 'No id', enabled: true, modifiers: [] },
      'not an object',
      null,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns an empty array for non-array input', () => {
    expect(sanitizeLayers(undefined)).toEqual([]);
    expect(sanitizeLayers({})).toEqual([]);
  });

  it('regenerates duplicate ids', () => {
    const result = sanitizeLayers([
      { id: 'dup', name: 'One', enabled: true, modifiers: [] },
      { id: 'dup', name: 'Two', enabled: true, modifiers: [] },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
  });
});
