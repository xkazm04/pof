/**
 * The Chaos Cloth control exists, discloses its prerequisites, and never dresses a
 * not-run as a result.
 *
 * Forced-failure suite for `chaos-cloth-has-no-surface`: at HEAD~1 there was no panel at
 * all (the capability was reachable only by editing code), so every assertion here is red.
 * The fetch is injected — no route, no editor, no live UE run in this session.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChaosClothPanel } from '@/components/modules/visual-gen/asset-forge/ChaosClothPanel';
import { CHAOS_CLOTH_NOT_RUN, CHAOS_CLOTH_PLUGINS } from '@/lib/visual-gen/chaos-cloth';

function installFetch(payload: unknown, ok = true) {
  const mock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(ok ? { success: true, data: payload } : { success: false, error: payload }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function fill() {
  fireEvent.change(screen.getByTestId('cloth-skeletal-mesh'), { target: { value: '/Game/SKM_Manny' } });
  fireEvent.change(screen.getByTestId('cloth-physics-asset'), { target: { value: '/Game/PHYS_Manny' } });
  fireEvent.change(screen.getByTestId('cloth-garment'), { target: { value: '/Game/Cape' } });
}

const RESULT = {
  ok: true, clothAssetPath: '/Game/Generated/Cloth/CA_Cloth', nodesAdded: 4,
  connected: true, regenerated: true, bound: true, notRun: false, logs: [],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { installFetch(RESULT); });

describe('ChaosClothPanel', () => {
  it('discloses the plugin prerequisites BEFORE any click', () => {
    render(<ChaosClothPanel />);
    const prereqs = screen.getByTestId('chaos-cloth-prereqs');
    for (const p of CHAOS_CLOTH_PLUGINS) expect(prereqs.textContent).toContain(p);
    expect(prereqs.textContent).toContain('editor lease');
  });

  it('posts the character + garment choice and renders the real result', async () => {
    const mock = installFetch(RESULT);
    render(<ChaosClothPanel />);
    fill();
    fireEvent.click(screen.getByTestId('chaos-cloth-submit'));
    await waitFor(() => expect(screen.getByTestId('chaos-cloth-result')).toBeTruthy());
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
    expect(mock.mock.calls[0][0]).toBe('/api/visual-gen/chaos-cloth');
    expect(body.targetSkeletalMesh).toBe('/Game/SKM_Manny');
    expect(body.garmentMeshPath).toBe('/Game/Cape');
    expect(screen.getByTestId('chaos-cloth-asset-path').textContent).toContain('CA_Cloth');
    expect(screen.getByTestId('chaos-cloth-verdict').querySelector('[data-status="ok"]')).toBeTruthy();
  });

  it('sends a .glb garment as garmentGlbPath when that source is chosen', async () => {
    const mock = installFetch(RESULT);
    render(<ChaosClothPanel />);
    fill();
    fireEvent.click(screen.getByTestId('cloth-source-glb'));
    fireEvent.click(screen.getByTestId('chaos-cloth-submit'));
    await waitFor(() => expect(mock).toHaveBeenCalled());
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.garmentGlbPath).toBe('/Game/Cape');
    expect(body.garmentMeshPath).toBeUndefined();
  });

  it('renders a not-run as its own WARN state, never as a result or a red failure', async () => {
    installFetch(`${CHAOS_CLOTH_NOT_RUN}: POF_UE_UPROJECT not set`, false);
    render(<ChaosClothPanel />);
    fill();
    fireEvent.click(screen.getByTestId('chaos-cloth-submit'));
    await waitFor(() => expect(screen.getByTestId('chaos-cloth-notrun')).toBeTruthy());
    expect(screen.queryByTestId('chaos-cloth-result')).toBeNull();
    const notRun = screen.getByTestId('chaos-cloth-notrun');
    expect(notRun.querySelector('[data-status="warn"]')).toBeTruthy();
    expect(notRun.textContent).toContain('POF_UE_UPROJECT');
    expect(notRun.textContent).toContain('not that the garment failed');
  });

  it('renders an unbound transfer as a FAILURE with its reason, not a green card', async () => {
    installFetch({ ...RESULT, ok: false, bound: false, error: 'skin-weight transfer did not bind — the garment is likely not fitted' });
    render(<ChaosClothPanel />);
    fill();
    fireEvent.click(screen.getByTestId('chaos-cloth-submit'));
    await waitFor(() => expect(screen.getByTestId('chaos-cloth-result')).toBeTruthy());
    const verdict = screen.getByTestId('chaos-cloth-verdict');
    expect(verdict.querySelector('[data-status="bad"]')).toBeTruthy();
    expect(verdict.querySelector('[data-status="ok"]')).toBeNull();
    expect(screen.getByTestId('chaos-cloth-reason').textContent).toContain('did not bind');
  });
});
