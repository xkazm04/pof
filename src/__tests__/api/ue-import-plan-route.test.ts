/**
 * POST /api/visual-gen/ue-import/plan — the preview the import never had.
 *
 * Pinned: it answers the SAME plan the job would make (critic → planUeImport), names the
 * per-import folder the delivery lands in, says whether anything already lives there — the
 * glTF import writes the mesh AND its materials/textures, so ANY file in the folder is a
 * replace — and it never boots the editor. Its refusals are the import route's own.
 *
 * The UE project is a real temp directory (the route reads it with node:fs); the critic and
 * the experiment runner are stubbed so no trimesh or editor is ever reached.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const critic = vi.hoisted(() => vi.fn());
const runExperiment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/visual-gen/mesh-critique', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/mesh-critique')>()),
  critiqueMesh: critic,
}));
vi.mock('@/lib/ue-experiment/runner', async (orig) => ({
  ...(await orig<typeof import('@/lib/ue-experiment/runner')>()),
  runExperiment,
}));

import { POST as plan } from '@/app/api/visual-gen/ue-import/plan/route';
import { POST as importRoute } from '@/app/api/visual-gen/ue-import/route';

const dir = mkdtempSync(join(tmpdir(), 'pof-ueplan-'));
const GLB = join(dir, 'crate.glb');
writeFileSync(GLB, 'glb bytes');
const PROJECT = join(dir, 'U', 'Game');
const UPROJECT = join(PROJECT, 'Game.uproject');
const GENERATED = join(PROJECT, 'Content', 'Generated');
mkdirSync(GENERATED, { recursive: true });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/ue-import/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** A measured critique with three substantial shells. */
const THREE_PARTS = { ok: true, metrics: { components: 3, componentFaces: [900, 600, 300] } };

const savedEnv = process.env.POF_UE_UPROJECT;
beforeEach(() => {
  critic.mockReset().mockResolvedValue(THREE_PARTS);
  runExperiment.mockReset();
  process.env.POF_UE_UPROJECT = UPROJECT;
  rmSync(GENERATED, { recursive: true, force: true });
  mkdirSync(GENERATED, { recursive: true });
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.POF_UE_UPROJECT;
  else process.env.POF_UE_UPROJECT = savedEnv;
});

describe('POST /api/visual-gen/ue-import/plan — the preview', () => {
  it('answers the measured plan and the per-import folder without booting the editor', async () => {
    const res = await plan(post({ glbPath: GLB, use: 'blocking', assetName: 'SM_Crate' }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.collision.kind).toBe('convex');
    expect(data.planBasis).toBe('measured');
    expect(data.shells).toBe(3);
    expect(data.destPath).toBe('/Game/Generated/SM_Crate');
    expect(data.assetPath).toBe('/Game/Generated/SM_Crate/SM_Crate');
    expect(data.replaces).toBe(false);
    expect(critic).toHaveBeenCalledTimes(1);
    expect(critic.mock.calls[0][0]).toBe(GLB);
    expect(runExperiment).not.toHaveBeenCalled();
  });

  it('critiques through the same gate request the job builds — a class reaches the size target', async () => {
    await plan(post({ glbPath: GLB, use: 'character', assetName: 'SM_Hero', assetClass: 'character' }));
    const deps = critic.mock.calls[0][1];
    expect(deps?.size?.targetExtentM).toBeGreaterThan(0);
  });

  it('ANY file in the asset folder is a replace — the mesh or a side material/texture', async () => {
    mkdirSync(join(GENERATED, 'SM_Crate', 'Textures'), { recursive: true });
    writeFileSync(join(GENERATED, 'SM_Crate', 'Textures', 'T_Base.uasset'), 'x');
    const res = await plan(post({ glbPath: GLB, use: 'blocking', assetName: 'SM_Crate' }));
    const { data } = await res.json();
    expect(data.replaces).toBe(true);
    expect(data.replacesReason).toMatch(/T_Base\.uasset/);

    writeFileSync(join(GENERATED, 'SM_Crate', 'SM_Crate.uasset'), 'x');
    expect((await (await plan(post({ glbPath: GLB, use: 'blocking', assetName: 'SM_Crate' }))).json()).data.replaces).toBe(true);
  });

  it("another import's folder, or an empty folder, is not a replace", async () => {
    mkdirSync(join(GENERATED, 'SM_Other'), { recursive: true });
    writeFileSync(join(GENERATED, 'SM_Other', 'M_Shared.uasset'), 'x');
    mkdirSync(join(GENERATED, 'SM_Crate', 'Empty'), { recursive: true });
    const { data } = await (await plan(post({ glbPath: GLB, use: 'blocking', assetName: 'SM_Crate' }))).json();
    expect(data.replaces).toBe(false);
  });

  it('with POF_UE_UPROJECT unset the replace verdict is unknown, and says why', async () => {
    delete process.env.POF_UE_UPROJECT;
    const { data } = await (await plan(post({ glbPath: GLB, use: 'blocking', assetName: 'SM_Crate' }))).json();
    expect(data.replaces).toBeNull();
    expect(data.replacesReason).toMatch(/POF_UE_UPROJECT/);
  });
});

describe('POST /api/visual-gen/ue-import/plan — refusals (the import route\'s own)', () => {
  it('refuses a missing use with the import route\'s own "no default is safe" sentence, before any critic runs', async () => {
    const res = await plan(post({ glbPath: GLB, assetName: 'SM_Crate' }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatch(/no default is safe/);
    const imp = await (await importRoute(post({ glbPath: GLB }))).json();
    expect(error).toBe(imp.error);
    expect(critic).not.toHaveBeenCalled();
  });

  it('refuses a non-.glb and a missing file exactly as the import does', async () => {
    for (const glbPath of ['C:/gen/chair.fbx', join(dir, 'missing.glb')]) {
      const res = await plan(post({ glbPath, use: 'blocking', assetName: 'SM_Crate' }));
      expect(res.status).toBe(400);
      const imp = await (await importRoute(post({ glbPath, use: 'blocking' }))).json();
      expect((await res.json()).error).toBe(imp.error);
    }
    expect(critic).not.toHaveBeenCalled();
  });

  it('refuses a blank or unsafe asset name — a blank name is the shared TripoSRMesh', async () => {
    for (const assetName of [undefined, '  ', 'SM Crate', '../Crate']) {
      const res = await plan(post({ glbPath: GLB, use: 'blocking', assetName }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/assetName/);
    }
    expect(critic).not.toHaveBeenCalled();
  });
});
