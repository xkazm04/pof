import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Every string this route accepts is interpolated into a single-quoted editor-Python literal
 * (`buildClothGraphPython`). A quote in one of them ends the literal and the rest runs as code
 * inside the editor, so the route refuses it before an editor boots.
 */
const attach = vi.fn();
vi.mock('@/lib/visual-gen/chaos-cloth', () => ({
  attachClothToCharacter: (...a: unknown[]) => attach(...a),
  CHAOS_CLOTH_NOT_RUN: 'not run',
}));

const { POST } = await import('@/app/api/visual-gen/chaos-cloth/route');

const OK = { targetSkeletalMesh: '/Game/A/SKM', physicsAsset: '/Game/A/PHYS', garmentMeshPath: '/Game/A/Cape' };
const INJECT = "x'); import os; os.system('calc'); ('";

const post = (body: unknown, raw = false) =>
  POST(new NextRequest('http://localhost:3001/api/visual-gen/chaos-cloth', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
  }));

beforeEach(() => {
  attach.mockReset();
  attach.mockResolvedValue({ ok: true });
});

describe('POST /api/visual-gen/chaos-cloth refuses what would become editor Python', () => {
  for (const field of ['targetSkeletalMesh', 'physicsAsset', 'garmentMeshPath', 'destPath', 'clothAssetName', 'dataflowName', 'garmentMeshName', 'transferMethod']) {
    it(`refuses a quote in ${field}`, async () => {
      const res = await post({ ...OK, [field]: INJECT });
      expect(res.status).toBe(400);
      expect(attach).not.toHaveBeenCalled();
    });
  }

  it('refuses a quote or newline in garmentGlbPath but takes a Windows path with spaces', async () => {
    const base = { targetSkeletalMesh: OK.targetSkeletalMesh, physicsAsset: OK.physicsAsset };
    expect((await post({ ...base, garmentGlbPath: `C:/a/${INJECT}.glb` })).status).toBe(400);
    expect((await post({ ...base, garmentGlbPath: 'C:/a\nimport os.glb' })).status).toBe(400);
    expect(attach).not.toHaveBeenCalled();
    expect((await post({ ...base, garmentGlbPath: 'C:\\Users\\me\\Unreal Projects\\cape.glb' })).status).toBe(200);
  });

  it('still accepts ordinary paths, names and a transfer method', async () => {
    const res = await post({ ...OK, destPath: '/Game/Generated/Cloth', clothAssetName: 'CA_Cape-1', transferMethod: 'ClosestPointOnSurface' });
    expect(res.status).toBe(200);
    expect(attach).toHaveBeenCalledOnce();
  });

  it('answers 400 for a body that is not a JSON object', async () => {
    expect((await post('{nope', true)).status).toBe(400);
    expect((await post('null', true)).status).toBe(400);
  });
});
