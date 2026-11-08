/**
 * A rig verdict stayed on screen (and on the preset cards, via onChecked) after the
 * GLB or morphology it was computed for had been changed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { RigCheckPanel } from '@/components/modules/visual-gen/auto-rig/AutoRigView/RigCheckPanel';

const asset = (name: string) => ({
  name, sizeBytes: 1, mtimeMs: 1, previewUrl: null, url: `/x/${name}`, provider: 'tripo3d', providerLabel: 'Tripo3D',
});
const CHECK = {
  name: 'a.glb', dir: 'tripo3d', morphology: 'biped', state: 'rigged', naming: 'semantic', jointCount: 22,
  vertexCount: 1, morphTargetCount: 0, message: 'rig read', verdict: null, rows: [], recommended: null,
  recommendationReason: 'none',
};

function reply(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function checked(onChecked: (r: unknown) => void, pendingCheck = false) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!String(url).includes('rig-check')) return reply({ assets: [asset('a.glb'), asset('b.glb')] });
    return pendingCheck ? new Promise(() => {}) : reply(CHECK);
  }));
  render(<RigCheckPanel onSelectPreset={() => {}} onChecked={onChecked} />);
  await waitFor(() => expect((screen.getByTestId('rig-check-submit') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId('rig-check-submit'));
}

describe('RigCheckPanel verdict lifetime', () => {
  it('drops the verdict when the GLB changes', async () => {
    const onChecked = vi.fn();
    await checked(onChecked);
    await screen.findByTestId('rig-check-result');
    fireEvent.change(screen.getByTestId('rig-check-asset'), { target: { value: 'tripo3d::b.glb' } });
    expect(screen.queryByTestId('rig-check-result')).toBeNull();
    expect(onChecked).toHaveBeenLastCalledWith(null);
  });

  it('drops the verdict when the morphology changes', async () => {
    const onChecked = vi.fn();
    await checked(onChecked);
    await screen.findByTestId('rig-check-result');
    const select = screen.getByTestId('rig-check-morphology') as HTMLSelectElement;
    const other = [...select.options].map((o) => o.value).find((v) => v !== select.value) as string;
    fireEvent.change(select, { target: { value: other } });
    expect(screen.queryByTestId('rig-check-result')).toBeNull();
    expect(onChecked).toHaveBeenLastCalledWith(null);
  });

  it('locks both pickers while a check is running', async () => {
    await checked(() => {}, true);
    await waitFor(() => expect((screen.getByTestId('rig-check-asset') as HTMLSelectElement).disabled).toBe(true));
    expect((screen.getByTestId('rig-check-morphology') as HTMLSelectElement).disabled).toBe(true);
  });
});
