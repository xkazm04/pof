/**
 * The Auto-Rig tab's "Check a produced rig" panel: pick a generated GLB, check it once,
 * compare every target skeleton side by side, and use one.
 *
 * Before it, the target skeleton was chosen from static cards only — no produced rig was
 * ever consulted from the UI. The fetch is injected: no route, no GLB, no Blender here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { RigCheckPanel } from '@/components/modules/visual-gen/auto-rig/AutoRigView/RigCheckPanel';

const ASSETS = {
  assets: [
    {
      name: 'hero_rigged.glb', sizeBytes: 1024, mtimeMs: 2, previewUrl: null,
      url: '/api/visual-gen/asset/hero_rigged.glb?dir=tripo3d', provider: 'tripo3d', providerLabel: 'Tripo3D (cloud)',
    },
  ],
};

const CHECK = {
  name: 'hero_rigged.glb', dir: 'tripo3d', morphology: 'biped',
  state: 'rigged', naming: 'semantic', jointCount: 22, vertexCount: 5000, morphTargetCount: 0,
  message: 'rig read: 22 joints, semantic names',
  verdict: { pass: true, score: 90, failures: [], warnings: ['1 orphan joint(s): declared but deforming no vertex'] },
  rows: [
    {
      presetId: 'ue5-mannequin', presetName: 'UE5 Mannequin', kind: 'remap', status: 'partial',
      bound: 6, required: 10, unboundChains: ['LeftArm', 'RightArm'], reason: 'binds only 6/10',
    },
    {
      presetId: 'metahuman', presetName: 'MetaHuman', kind: 'conform', status: 'not-applicable',
      bound: 0, required: 10, unboundChains: [], reason: 'metahuman is a conform target',
    },
    {
      presetId: 'minimal-humanoid', presetName: 'Minimal Humanoid', kind: 'remap', status: 'bound',
      bound: 10, required: 10, unboundChains: [], reason: 'binds 10/10',
    },
  ],
  recommended: 'minimal-humanoid',
  recommendationReason: 'minimal-humanoid binds all 10 required chain endpoints',
};

function installFetch() {
  const mock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: String(url).includes('rig-check') ? CHECK : ASSETS }),
  }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('RigCheckPanel', () => {
  it('case 7: checks the picked GLB, compares every target, and "Use this target" selects it', async () => {
    const mock = installFetch();
    const onSelectPreset = vi.fn();
    const onChecked = vi.fn();
    render(<RigCheckPanel onSelectPreset={onSelectPreset} onChecked={onChecked} />);

    await waitFor(() => expect(screen.getByRole('option', { name: /hero_rigged\.glb/ })).toBeTruthy());
    fireEvent.click(screen.getByTestId('rig-check-submit'));
    await waitFor(() => expect(screen.getByTestId('rig-check-row-minimal-humanoid')).toBeTruthy());

    const call = mock.mock.calls.find((c) => String(c[0]).includes('/api/visual-gen/rig-check'))!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body).toEqual({ name: 'hero_rigged.glb', dir: 'tripo3d', morphology: 'biped' });

    for (const r of CHECK.rows) {
      const el = screen.getByTestId(`rig-check-row-${r.presetId}`);
      expect(el.textContent).toContain(r.presetName);
    }
    expect(screen.getByTestId('rig-check-row-ue5-mannequin').textContent).toContain('6/10');
    expect(screen.getByTestId('rig-check-row-minimal-humanoid').textContent).toContain('10/10');
    // A partial row names the limbs that will not retarget.
    expect(screen.getByTestId('rig-check-row-ue5-mannequin').textContent).toContain('LeftArm');
    expect(screen.getByTestId('rig-check-row-ue5-mannequin').textContent).toContain('RightArm');
    expect(screen.getByTestId('rig-check-row-minimal-humanoid').textContent).toMatch(/recommended/i);

    fireEvent.click(screen.getByTestId('rig-check-use-minimal-humanoid'));
    expect(onSelectPreset).toHaveBeenCalledWith('minimal-humanoid');
    expect(onChecked).toHaveBeenLastCalledWith(expect.objectContaining({ recommended: 'minimal-humanoid' }));
  });
});
