/**
 * The Chaos Cloth capability has a SURFACE.
 *
 * Forced-failure suite for `chaos-cloth-has-no-surface`. At HEAD~1 `attachClothToCharacter`
 * was a proven headless UE 5.8 capability with no API route and no UI caller — reachable
 * only by editing code, i.e. script-only. Every assertion below is red without
 * `src/app/api/visual-gen/chaos-cloth/route.ts`: the module does not exist.
 *
 * The UE runner is INJECTED (the module is mocked), so this proves the route → lib →
 * result path without booting an editor. NO LIVE UE RUN happened in this session.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const runExperiment = vi.fn();
vi.mock('@/lib/ue-experiment/runner', () => ({ runExperiment: (...a: unknown[]) => runExperiment(...a) }));

import { CHAOS_CLOTH_NOT_RUN } from '@/lib/visual-gen/chaos-cloth';

const { POST } = await import('@/app/api/visual-gen/chaos-cloth/route');

const BODY = {
  targetSkeletalMesh: '/Game/Characters/Manny/SKM_Manny',
  physicsAsset: '/Game/Characters/Manny/PHYS_Manny',
  garmentMeshPath: '/Game/Generated/Cloth/Cape',
};

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3001/api/visual-gen/chaos-cloth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function result(markers: Record<string, string>, over: Partial<ExperimentResult> = {}): ExperimentResult {
  return {
    ok: true, logs: ['LogPython: ok'], markers, durationMs: 1200,
    binary: 'UnrealEditor-Cmd.exe', args: [], ...over,
  };
}

async function post(body: unknown) {
  const res = await POST(req(body));
  return { res, body: (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string } };
}

beforeEach(() => runExperiment.mockReset());

describe('POST /api/visual-gen/chaos-cloth — the capability is reachable', () => {
  it('runs the cloth attach and returns the real ClothResult in the envelope', async () => {
    runExperiment.mockResolvedValue(result({
      POF_CLOTH_GARMENT: '/Game/Generated/Cloth/Cape',
      POF_CLOTH_DATAFLOW: '/Game/Generated/Cloth/DF_Cloth',
      POF_CLOTH_NODES: '4',
      POF_CLOTH_CONNECTED: 'True',
      POF_CLOTH_ASSET: '/Game/Generated/Cloth/CA_Cloth',
      POF_CLOTH_REGEN: 'True',
      POF_CLOTH_EVAL: 'True',
    }));
    const { res, body } = await post(BODY);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.ok).toBe(true);
    expect(body.data?.clothAssetPath).toBe('/Game/Generated/Cloth/CA_Cloth');
    expect(body.data?.bound).toBe(true);
    expect(body.data?.notRun).toBe(false);
    // The route drives the real lib, which declares the cloth plugins per-run.
    const spec = runExperiment.mock.calls[0][0] as { enablePlugins?: string[]; python: string };
    expect(spec.enablePlugins).toContain('ChaosClothAsset');
    expect(spec.python).toContain('FChaosClothAssetTerminalNode');
  });

  it('reports an unbound transfer as a failure with its reason — never a pass', async () => {
    runExperiment.mockResolvedValue(result({
      POF_CLOTH_GARMENT: '/Game/G', POF_CLOTH_NODES: '4', POF_CLOTH_CONNECTED: 'True',
      POF_CLOTH_ASSET: '/Game/CA', POF_CLOTH_REGEN: 'True', POF_CLOTH_EVAL: 'False',
    }));
    const { body } = await post(BODY);
    expect(body.data?.ok).toBe(false);
    expect(String(body.data?.error)).toContain('did not bind');
    expect(body.data?.notRun).toBe(false);
  });

  it('says "not run" when a live editor holds the machine — never a silent 200', async () => {
    runExperiment.mockResolvedValue(result({}, {
      ok: false, refused: true, logs: [],
      error: 'Refused: an Unreal editor is already running — UnrealEditor.exe (PID 42).',
    }));
    const { res, body } = await post(BODY);
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain(CHAOS_CLOTH_NOT_RUN);
    expect(body.error).toContain('PID 42');
  });

  it('says "not run" when the drain lease holds the editor', async () => {
    runExperiment.mockResolvedValue(result({}, {
      ok: false, refused: true, logs: [],
      error: 'Refused: the UE gate drain currently holds the editor lease (global).',
    }));
    const { res, body } = await post(BODY);
    expect(res.status).toBe(503);
    expect(body.error).toContain('editor lease');
  });

  it('says "not run" when there is no runner at all (no uproject / no binary)', async () => {
    runExperiment.mockResolvedValue(result({}, {
      ok: false, logs: [], error: 'POF_UE_UPROJECT not set (path to the PoF .uproject)',
    }));
    const { res, body } = await post(BODY);
    expect(res.status).toBe(503);
    expect(body.error).toContain(CHAOS_CLOTH_NOT_RUN);
    expect(body.error).toContain('POF_UE_UPROJECT');
  });

  it('refuses a body with no character target before spending an editor boot', async () => {
    const { res, body } = await post({ garmentMeshPath: '/Game/G' });
    expect(res.status).toBe(400);
    expect(body.error).toContain('targetSkeletalMesh');
    expect(runExperiment).not.toHaveBeenCalled();
  });

  it('refuses a body with no garment source, by name', async () => {
    const { res, body } = await post({ targetSkeletalMesh: '/Game/S', physicsAsset: '/Game/P' });
    expect(res.status).toBe(400);
    expect(body.error).toContain('garment');
    expect(runExperiment).not.toHaveBeenCalled();
  });
});
