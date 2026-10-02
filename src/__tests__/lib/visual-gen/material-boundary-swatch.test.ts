/* eslint-disable no-restricted-syntax -- the hex literals below are PBR base
   COLOURS under test (material data), not UI theme colours. */
/**
 * The Material Lab sends one material across three edges — the three.js
 * preview, Blender and a UE MaterialInstance script. Each used to hold its own
 * theory of what the lab's numbers mean: the preview decoded the hex base colour
 * sRGB -> linear (three's colour management), Blender and UE wrote the raw sRGB
 * code value into linear slots, so the default grey #808080 previewed at 0.2159
 * and landed at 0.5020 (2.33x brighter).
 *
 * The swatch straddles the transfer curve's fixed points on purpose: #000 and
 * #fff agree under ANY curve, so a test that checks only those passes the bug.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Color } from 'three';
import {
  MATERIAL_CHANNELS,
  colourSpaceOf,
  hexToLinearRgb,
  resolveChannelSource,
} from '@/lib/visual-gen/material-boundary';
import { buildUE5MaterialInstance } from '@/lib/visual-gen/ue5-material-instance';
import { createMaterialScript } from '@/lib/blender-mcp/scripts/create-material';
import { planMaterialTransfer } from '@/components/modules/visual-gen/material-lab/materialTransfer';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

const SRC = path.resolve(__dirname, '../../..');

/** Pull the three numbers out of a `(r, g, b, 1.0)` Python tuple. */
function tuple(text: string, prefix: string): [number, number, number] {
  const at = text.indexOf(prefix);
  expect(at, `missing ${prefix}`).toBeGreaterThanOrEqual(0);
  const inner = text.slice(at + prefix.length).match(/^\(([^)]*)\)/);
  const [r, g, b] = (inner?.[1] ?? '').split(',').map((s) => Number(s.trim()));
  return [r, g, b];
}

describe('hexToLinearRgb — the one sRGB decode (IEC 61966-2-1)', () => {
  it('decodes mid-greys and keeps the fixed points', () => {
    const close = (got: number[], want: number[]) =>
      got.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(1e-6));
    close(hexToLinearRgb('#808080'), [0.215861, 0.215861, 0.215861]);
    close(hexToLinearRgb('#bcbcbc'), [0.502886, 0.502886, 0.502886]);
    expect(hexToLinearRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinearRgb('#ffffff')).toEqual([1, 1, 1]);
  });
});

describe('sendToBlender writes the decoded base colour into the scene-linear socket', () => {
  let posted: string[] = [];
  beforeEach(() => {
    posted = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      posted.push(String((JSON.parse(String(init?.body ?? '{}')) as { code?: string }).code ?? ''));
      return { json: async () => ({ success: true, data: {} }) } as Response;
    });
    useMaterialStore.setState({
      params: { baseColor: '#808080', metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1 },
      albedoTexture: null,
      normalTexture: null,
      metallicTexture: null,
      roughnessTexture: null,
      aoTexture: null,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('#808080 reaches Blender as linear 0.215861', async () => {
    const result = await useMaterialStore.getState().sendToBlender('T');
    expect(result.ok).toBe(true);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain(
      'bsdf.inputs["Base Color"].default_value = (0.215861, 0.215861, 0.215861, 1.0)',
    );
  });
});

describe('surface-conformance swatch: preview, Blender and UE agree', () => {
  const SWATCH = ['#000000', '#404040', '#808080', '#bcbcbc', '#cc3333', '#ffd700', '#ffffff'];

  it('7 of 7 hexes agree per channel within 1e-6 across all three projections', () => {
    const agreeing = SWATCH.filter((hex) => {
      const preview = new Color(hex); // three's colour-managed working (linear) value
      const blender = tuple(
        createMaterialScript({
          name: 'S', baseColor: hexToLinearRgb(hex), metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1,
        }),
        'bsdf.inputs["Base Color"].default_value = ',
      );
      const ue = tuple(
        buildUE5MaterialInstance({
          name: 'S', params: { baseColor: hex, metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1 },
        }).script,
        '"BaseColorTint": ',
      );
      const want = [preview.r, preview.g, preview.b];
      return want.every((v, i) => Math.abs(blender[i] - v) <= 1e-6 && Math.abs(ue[i] - v) <= 1e-6);
    });
    expect(agreeing).toEqual(SWATCH);
  });
});

describe('per-role table: colour space is declared once, per channel', () => {
  it('lists the five channels once and projects each role into Blender', () => {
    const ids = MATERIAL_CHANNELS.map((c) => c.channel);
    expect(ids).toEqual(['albedo', 'normal', 'metallic', 'roughness', 'ao']);
    expect(new Set(ids).size).toBe(5);
    expect(colourSpaceOf('albedo')).toBe('srgb');
    for (const c of ['normal', 'metallic', 'roughness', 'ao'] as const) expect(colourSpaceOf(c)).toBe('linear');

    const code = createMaterialScript({
      name: 'All', baseColor: [0, 0, 0], metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1,
      textures: { albedo: '/t/a.png', normal: '/t/n.png', metallic: '/t/m.png', roughness: '/t/r.png', ao: '/t/ao.png' },
    });
    expect(code.split('"sRGB"').length - 1).toBe(1);
    expect(code.split('"Non-Color"').length - 1).toBe(4);
    // ...each read from the table, not restated as a literal in the projection.
    const blenderSrc = fs.readFileSync(path.join(SRC, 'lib/blender-mcp/scripts/create-material.ts'), 'utf8');
    expect(blenderSrc).not.toContain('"Non-Color"');
    expect(blenderSrc).not.toContain('"sRGB"');
    const previewSrc = fs.readFileSync(
      path.join(SRC, 'components/modules/visual-gen/material-lab/MaterialPreview.tsx'), 'utf8',
    );
    expect(previewSrc).not.toMatch(/useDisposableTexture\([^)]*THREE\.(SRGB|No)ColorSpace/);
  });
});

describe('resolveChannelSource — the only texture resolver', () => {
  it('routes app URLs to Blender and /Game/ paths to UE, and refuses the crossings', () => {
    expect(resolveChannelSource('/api/visual-gen/image/a.png', 'blender', 'http://h')).toEqual({
      source: 'http://h/api/visual-gen/image/a.png',
    });
    const toUe = resolveChannelSource('/api/visual-gen/image/a.png', 'ue5', 'http://h');
    expect(toUe && 'reason' in toUe ? toUe.reason : '').toMatch(/not a UE asset path/);
    expect(resolveChannelSource('/Game/T/T_A', 'ue5')).toEqual({ assetPath: '/Game/T/T_A' });
    const toBlender = resolveChannelSource('/Game/T/T_A', 'blender', 'http://h');
    expect(toBlender && 'reason' in toBlender ? toBlender.reason : '').toMatch(/UE asset path/);
  });
});

describe('[guard] planMaterialTransfer labels and reasons are unchanged', () => {
  it('sends the resolvable albedo and names the blob normal map', () => {
    const plan = planMaterialTransfer(
      { baseColor: '#808080', metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1 },
      { albedo: 'https://cdn/a.png', normal: 'blob:x', metallic: null, roughness: null, ao: null },
      'http://h',
    );
    expect(plan.sent).toEqual(['Base colour', 'Metallic', 'Roughness', 'Albedo map']);
    expect(plan.notSent).toEqual([
      {
        label: 'Normal map',
        reason:
          'uploaded into this browser tab only (blob: URL) — Blender cannot open it. Generate the map in the Advanced tab, or point the slot at a file on disk.',
      },
    ]);
  });
});
