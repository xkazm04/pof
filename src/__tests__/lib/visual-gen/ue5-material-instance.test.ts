/* eslint-disable no-restricted-syntax -- the hex literals below are PBR base
   COLOURS under test (material data), not UI theme colours. */
/**
 * The Material Lab promised UE5 export in three places (module description,
 * `ml-3` quick action, `mat-ue5` checklist item) and implemented it in none.
 *
 * Generation is the deliverable, execution is not — every assertion here is on
 * the generated text, with **no UE running**.
 */
import { describe, it, expect } from 'vitest';
import {
  buildUE5MaterialInstance,
  sanitizeAssetName,
  hexToLinearColor,
  DEFAULT_PARENT_MATERIAL,
  type UE5MaterialParams,
} from '@/lib/visual-gen/ue5-material-instance';

const PARAMS: UE5MaterialParams = {
  baseColor: '#ffd700',
  metallic: 1,
  roughness: 0.2,
  normalStrength: 1.6,
  aoStrength: 0.4,
};

const build = (over: Partial<Parameters<typeof buildUE5MaterialInstance>[0]> = {}) =>
  buildUE5MaterialInstance({ name: 'LabMaterial', params: PARAMS, ...over });

describe('buildUE5MaterialInstance', () => {
  it('is deterministic — the same material emits byte-identical text', () => {
    expect(build().script).toBe(build().script);
  });

  it('emits a MaterialInstanceConstant of the shared master, not a one-off Material', () => {
    const emitted = build();
    expect(emitted.parentMaterial).toBe(DEFAULT_PARENT_MATERIAL);
    expect(emitted.script).toContain('M_ARPG_Surface_Master');
    expect(emitted.script).toContain('unreal.MaterialInstanceConstant');
    expect(emitted.script).toContain('unreal.MaterialInstanceConstantFactoryNew()');
    expect(emitted.assetPath).toBe('/Game/PoF/Materials/MI_LabMaterial');
  });

  it('sets every lab parameter through the documented API', () => {
    const emitted = build();
    expect(emitted.script).toContain('set_material_instance_scalar_parameter_value');
    expect(emitted.script).toContain('set_material_instance_vector_parameter_value');
    expect(emitted.script).toContain('"Metallic": 1.0,');
    expect(emitted.script).toContain('"Roughness": 0.2,');
    // The two strengths that could not reach Blender DO reach UE5.
    expect(emitted.script).toContain('"NormalStrength": 1.6,');
    expect(emitted.script).toContain('"AOStrength": 0.4,');
    expect(emitted.script).toContain('"BaseColorTint": (1, 0.843137, 0, 1.0),');
    expect(emitted.parameters.map((p) => p.name)).toEqual([
      'BaseColorTint', 'Metallic', 'Roughness', 'NormalStrength', 'AOStrength',
    ]);
  });

  it('survives the Constant3Vector empty-pin trap in the GENERATED code, not just a comment', () => {
    const script = build().script;
    // The gotcha is encoded as a function the script must call: a Constant3Vector's
    // colour output pin is "", a VectorParameter's is "RGB".
    expect(script).toContain('def _color_pin(expression)');
    expect(script).toContain('unreal.MaterialExpressionConstant3Vector');
    expect(script).toContain('return "RGB"');
    // ...and a silent False is refused rather than compiling a black material.
    expect(script).toContain('connect_material_property');
    expect(script).toContain('raise RuntimeError');
    // Every real call site passes the ASKED-FOR pin, never a hardcoded literal.
    const callSites = script
      .split('\n')
      .filter((line) => line.includes('unreal.MaterialEditingLibrary.connect_material_property('));
    expect(callSites).toHaveLength(1);
    expect(callSites[0]).toContain('(expression, pin, prop)');
  });

  it('names a parameter that cannot survive the round trip instead of dropping it', () => {
    const emitted = build({ textures: { albedo: 'blob:http://localhost/abc', normal: 'https://cdn/x.png' } });
    expect(emitted.notExported.map((d) => d.label)).toEqual(['Albedo texture', 'Normal texture']);
    expect(emitted.notExported[0].reason).toContain('blob:');
    expect(emitted.notExported[1].reason).toContain('not a UE asset path');
    // And at run time the script reports what the parent master would not accept.
    expect(emitted.script).toContain('unsupported');
    expect(emitted.script).toContain('did NOT land');
  });

  it('carries an already-imported UE texture asset as a texture parameter', () => {
    const emitted = build({ textures: { albedo: '/Game/PoF/Textures/T_Gold_A' } });
    expect(emitted.notExported).toEqual([]);
    expect(emitted.script).toContain('"Albedo": "/Game/PoF/Textures/T_Gold_A",');
    expect(emitted.script).toContain('set_material_instance_texture_parameter_value');
  });

  it('authors a stand-in master only when the project has none', () => {
    const script = build().script;
    expect(script).toContain('does_asset_exist(PARENT_MATERIAL)');
    expect(script).toContain('authoring a minimal stand-in');
  });

  it('honours an overridden parent and package path', () => {
    const emitted = build({ parentMaterial: '/Game/Custom/M_Master', packagePath: '/Game/Custom' });
    expect(emitted.assetPath).toBe('/Game/Custom/MI_LabMaterial');
    expect(emitted.script).toContain('PARENT_MATERIAL = "/Game/Custom/M_Master"');
  });

  it('emits importable Python, not a fragment', () => {
    const script = build().script;
    expect(script.startsWith('#')).toBe(true);
    expect(script).toContain('import unreal');
    expect(script.trimEnd().endsWith('build()')).toBe(true);
    // No stray template placeholders survived.
    expect(script).not.toContain('${');
    expect(script).not.toContain('undefined');
  });
});

describe('sanitizeAssetName', () => {
  it('produces a legal, prefixed UE asset name', () => {
    expect(sanitizeAssetName('Rough Stone')).toBe('MI_Rough_Stone');
    expect(sanitizeAssetName('MI_Gold')).toBe('MI_Gold');
    expect(sanitizeAssetName('  ')).toBe('MI_LabMaterial');
    expect(sanitizeAssetName('3d-metal!')).toBe('MI_M3d_metal');
    expect(sanitizeAssetName('a/b"c')).toBe('MI_a_b_c');
  });
});

describe('hexToLinearColor', () => {
  it('converts and rounds so the output stays byte-stable', () => {
    expect(hexToLinearColor('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinearColor('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinearColor('#808080')).toEqual([0.501961, 0.501961, 0.501961]);
    expect(hexToLinearColor('zzzzzz')).toEqual([0, 0, 0]);
  });
});
