/**
 * "Material created in Blender" used to follow a send that carried three of the
 * lab's parameters and dropped the rest. These assert the two halves of the fix:
 * the generated script text contains every parameter the UI claims to have sent,
 * and every parameter it cannot carry is NAMED with a reason.
 *
 * No live Blender: the deliverable is the generated script, so the assertions
 * are on its text.
 */
import { describe, it, expect } from 'vitest';
import { createMaterialScript } from '@/lib/blender-mcp/scripts/create-material';
import {
  planMaterialTransfer,
  resolveTextureSource,
} from '@/components/modules/visual-gen/material-lab/materialTransfer';
import type { PBRParams } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

const PARAMS: PBRParams = {
  baseColor: '#c0c0c0',
  metallic: 0.9,
  roughness: 0.25,
  normalStrength: 1.6,
  aoStrength: 0.4,
};

const NO_TEXTURES = { albedo: null, normal: null, metallic: null, roughness: null, ao: null };
const ORIGIN = 'http://localhost:3001';

describe('createMaterialScript carries every parameter it is given', () => {
  it('writes the scalars onto the Principled BSDF', () => {
    const code = createMaterialScript({
      name: 'Test Mat',
      baseColor: [0.75, 0.75, 0.75],
      metallic: 0.9,
      roughness: 0.25,
      normalStrength: 1.6,
      aoStrength: 0.4,
    });
    expect(code).toContain('bsdf.inputs["Metallic"].default_value = 0.9');
    expect(code).toContain('bsdf.inputs["Roughness"].default_value = 0.25');
    expect(code).toContain('bsdf.inputs["Base Color"].default_value = (0.75, 0.75, 0.75, 1.0)');
  });

  it('wires normalStrength through a Normal Map node when a normal map is supplied', () => {
    const code = createMaterialScript({
      name: 'Test Mat',
      baseColor: [0, 0, 0],
      metallic: 0,
      roughness: 0.5,
      normalStrength: 1.6,
      aoStrength: 1,
      textures: { normal: 'https://cdn.example/normal.png' },
    });
    expect(code).toContain('ShaderNodeNormalMap');
    expect(code).toContain('normal_map.inputs["Strength"].default_value = 1.6');
    expect(code).toContain('links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])');
    expect(code).toContain('https://cdn.example/normal.png');
  });

  it('wires aoStrength as a MULTIPLY of the AO map over base colour', () => {
    const code = createMaterialScript({
      name: 'Test Mat',
      baseColor: [0.1, 0.2, 0.3],
      metallic: 0,
      roughness: 0.5,
      normalStrength: 1,
      aoStrength: 0.4,
      textures: { ao: 'https://cdn.example/ao.png', albedo: 'https://cdn.example/albedo.png' },
    });
    expect(code).toContain('_multiply_node(nodes, 0.4)');
    expect(code).toContain('links.new(albedo_tex.outputs["Color"], ao_a)');
    expect(code).toContain('links.new(ao_out, bsdf.inputs["Base Color"])');
  });

  it('carries all five channels with the right colour spaces', () => {
    const code = createMaterialScript({
      name: 'Test Mat',
      baseColor: [0, 0, 0],
      metallic: 0,
      roughness: 0.5,
      normalStrength: 1,
      aoStrength: 1,
      textures: {
        albedo: '/tmp/a.png',
        normal: '/tmp/n.png',
        metallic: '/tmp/m.png',
        roughness: '/tmp/r.png',
        ao: '/tmp/o.png',
      },
    });
    for (const file of ['/tmp/a.png', '/tmp/n.png', '/tmp/m.png', '/tmp/r.png', '/tmp/o.png']) {
      expect(code).toContain(file);
    }
    expect(code).toContain('"sRGB"');
    expect(code.match(/"Non-Color"/g)?.length).toBeGreaterThanOrEqual(4);
    // Blender cannot fetch over the network on its own — the script downloads.
    expect(code).toContain('urllib.request.urlretrieve');
  });

  it('escapes a name that would otherwise break out of the Python literal', () => {
    const code = createMaterialScript({
      name: 'evil") or bpy.ops.wm.quit_blender(',
      baseColor: [0, 0, 0],
      metallic: 0,
      roughness: 0,
      normalStrength: 1,
      aoStrength: 1,
    });
    expect(code).not.toContain('bpy.ops.wm.quit_blender()');
    expect(code).toContain('\\"');
  });
});

describe('planMaterialTransfer names what did NOT travel', () => {
  it('always reports the three scalars that do travel', () => {
    const plan = planMaterialTransfer(PARAMS, NO_TEXTURES, ORIGIN);
    expect(plan.sent).toEqual(expect.arrayContaining(['Base colour', 'Metallic', 'Roughness']));
  });

  it('reports a browser-only blob upload as NOT sent, with the reason', () => {
    const plan = planMaterialTransfer(PARAMS, { ...NO_TEXTURES, albedo: 'blob:http://localhost/abc' }, ORIGIN);
    const dropped = plan.notSent.find((d) => d.label === 'Albedo map');
    expect(dropped).toBeTruthy();
    expect(dropped!.reason).toContain('blob:');
    expect(plan.sent).not.toContain('Albedo map');
    expect(plan.textures.albedo).toBeUndefined();
  });

  it('reports a tuned Normal/AO Strength with no map as NOT sent', () => {
    const plan = planMaterialTransfer(PARAMS, NO_TEXTURES, ORIGIN);
    expect(plan.notSent.map((d) => d.label)).toEqual(
      expect.arrayContaining(['Normal Strength', 'AO Strength']),
    );
    for (const dropped of plan.notSent) expect(dropped.reason.length).toBeGreaterThan(20);
  });

  it('does NOT list an untouched strength — nothing was dropped', () => {
    const plan = planMaterialTransfer(
      { ...PARAMS, normalStrength: 1, aoStrength: 1 },
      NO_TEXTURES,
      ORIGIN,
    );
    expect(plan.notSent).toEqual([]);
  });

  it('an Advanced-tab map (a real URL) DOES travel, and takes its strength with it', () => {
    const plan = planMaterialTransfer(
      PARAMS,
      { ...NO_TEXTURES, normal: 'https://cdn.scenario.com/n.png', ao: '/api/visual-gen/icon/ao.png' },
      ORIGIN,
    );
    expect(plan.sent).toEqual(expect.arrayContaining(['Normal map', 'AO map', 'Normal Strength', 'AO Strength']));
    expect(plan.notSent).toEqual([]);
    expect(plan.textures.normal).toBe('https://cdn.scenario.com/n.png');
    // An app-relative route is absolutised so Blender can fetch it.
    expect(plan.textures.ao).toBe(`${ORIGIN}/api/visual-gen/icon/ao.png`);
  });

  it('the plan and the script agree — everything named as sent is in the text', () => {
    const textures = {
      albedo: 'https://cdn.example/a.png',
      normal: 'https://cdn.example/n.png',
      metallic: null,
      roughness: null,
      ao: 'https://cdn.example/o.png',
    };
    const plan = planMaterialTransfer(PARAMS, textures, ORIGIN);
    const code = createMaterialScript({
      name: 'Agreed',
      baseColor: [0.75, 0.75, 0.75],
      metallic: PARAMS.metallic,
      roughness: PARAMS.roughness,
      normalStrength: PARAMS.normalStrength,
      aoStrength: PARAMS.aoStrength,
      textures: plan.textures,
    });
    if (plan.sent.includes('Normal Strength')) {
      expect(code).toContain(`normal_map.inputs["Strength"].default_value = ${PARAMS.normalStrength}`);
    }
    if (plan.sent.includes('AO Strength')) {
      expect(code).toContain(`_multiply_node(nodes, ${PARAMS.aoStrength})`);
    }
    for (const url of Object.values(plan.textures)) expect(code).toContain(url);
    // And nothing that was reported as sent is missing from the script.
    expect(plan.notSent).toEqual([]);
  });
});

describe('resolveTextureSource', () => {
  it('classifies each slot form', () => {
    expect(resolveTextureSource(null, ORIGIN)).toBeNull();
    expect(resolveTextureSource('blob:x', ORIGIN)).toHaveProperty('reason');
    expect(resolveTextureSource('data:image/png;base64,AA', ORIGIN)).toHaveProperty('reason');
    expect(resolveTextureSource('https://x/y.png', ORIGIN)).toEqual({ source: 'https://x/y.png' });
    expect(resolveTextureSource('/api/z.png', ORIGIN)).toEqual({ source: `${ORIGIN}/api/z.png` });
    expect(resolveTextureSource('C:\\tex\\a.png', ORIGIN)).toEqual({ source: 'C:\\tex\\a.png' });
  });
});
