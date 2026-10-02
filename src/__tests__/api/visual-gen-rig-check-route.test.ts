/**
 * POST /api/visual-gen/rig-check — the first API caller of the free Tier-1 rig gate.
 *
 * The route reads ONE GLB, resolved only through the generated-asset allow-list
 * (`safeAssetDir` + `safeAssetName`): a caller never names a filesystem path. It runs no
 * Blender, no model and no paid call — `gateRig` decodes the glTF JSON chunk and two
 * accessors. The cwd seam points `generated/<dir>/` at a temp copy of the committed
 * fixture, so the 200 case is a real read of real SkinTokens output.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/visual-gen/rig-check/route';
import { RIG_PRESETS } from '@/lib/visual-gen/rig-presets';

const FIXTURE = join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig', 'skintokens_cube_rigged.glb');
let root = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pof-rig-check-'));
  mkdirSync(join(root, 'generated', 'meshes'), { recursive: true });
  copyFileSync(FIXTURE, join(root, 'generated', 'meshes', 'skintokens_cube_rigged.glb'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());

async function post(body: unknown) {
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  const req = new Request('http://localhost/api/visual-gen/rig-check', { method: 'POST', body: JSON.stringify(body) });
  const res = await POST(req as never);
  vi.restoreAllMocks();
  return { status: res.status, json: (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string } };
}

describe('POST /api/visual-gen/rig-check', () => {
  it('case 5: refuses a traversal name, an unlisted dir, a missing file and an unknown morphology', async () => {
    expect((await post({ name: '../x.glb', dir: 'tripo3d' })).status).toBe(400);
    expect((await post({ name: 'a.glb', dir: 'nope' })).status).toBe(400);

    const missing = await post({ name: 'missing.glb', dir: 'tripo3d' });
    expect(missing.status).toBe(404);
    expect(missing.json.error).toContain('missing.glb');

    const dragon = await post({ name: 'skintokens_cube_rigged.glb', dir: 'meshes', morphology: 'dragon' });
    expect(dragon.status).toBe(400);
    for (const m of ['biped', 'quadruped', 'hexapod', 'octopod', 'avian', 'serpentine', 'aquatic']) {
      expect(dragon.json.error).toContain(m);
    }
  });

  it('case 6: checks a real rig from an allow-listed dir — one row per preset, positional names warned', async () => {
    const { status, json } = await post({ name: 'skintokens_cube_rigged.glb', dir: 'meshes' });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as {
      name: string; dir: string; morphology: string; state: string;
      rows: { presetId: string }[]; verdict: { warnings: string[] };
    };
    expect(data).toMatchObject({ name: 'skintokens_cube_rigged.glb', dir: 'meshes', morphology: 'biped', state: 'rigged' });
    expect(data.rows.map((r) => r.presetId)).toEqual(RIG_PRESETS.map((p) => p.id));
    expect(data.verdict.warnings.some((w) => /positional names/.test(w))).toBe(true);
  });
});
