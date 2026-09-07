/**
 * `UeImportPanel` — the human-reachable end of the import chain.
 *
 * What is pinned here is the honesty of the card, not the styling: `use` must never be
 * pre-selected, and the collision the panel REQUESTED must never be rendered as the
 * collision it OBSERVED.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { UeImportPanel } from '@/components/modules/visual-gen/asset-forge/UeImportPanel';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

/** Queue a POST (job start) then a status poll returning `status`. */
function queue(status: Record<string, unknown>) {
  fetchMock
    .mockResolvedValueOnce(ok({ jobId: 'j1' }))
    .mockResolvedValue(ok(status));
}

describe('UeImportPanel', () => {
  it('pre-selects NO use — collision has no safe default', () => {
    render(<UeImportPanel />);
    for (const id of ['blocking', 'decorative', 'character']) {
      expect(screen.getByTestId(`ue-import-use-${id}`).getAttribute('aria-pressed')).toBe('false');
    }
    expect(screen.getByTestId('ue-import-use-hint').textContent).toMatch(/pick one/i);
  });

  it('keeps submit disabled until a path AND a use are given', () => {
    render(<UeImportPanel />);
    const submit = screen.getByTestId('ue-import-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    expect(submit.disabled).toBe(true); // path alone is not enough

    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    expect(submit.disabled).toBe(false);
  });

  it('renders the observed element count separately from the requested plan', async () => {
    queue({
      status: 'done',
      glbPath: 'a.glb',
      use: 'blocking',
      assetPath: '/Game/Generated/Chair.Chair',
      collision: { kind: 'convex', hullCount: 6, maxHullVerts: 16, reason: '4 shells — convex decomposition' },
      planBasis: 'measured',
      shells: 4,
      collisionElements: 7,
    });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    fireEvent.click(screen.getByTestId('ue-import-submit'));

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(screen.getByTestId('ue-import-verdict').textContent).toMatch(/IMPORTED/);
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/convex/);
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/MEASURED/i);
    // The observation is its own line, with its own number.
    expect(card.textContent).toMatch(/7 ELEM/);
  }, 15_000);

  it('a requested collision that was never counted reads NOT COUNTED, not silence', async () => {
    queue({
      status: 'error',
      glbPath: 'a.glb',
      use: 'blocking',
      collision: { kind: 'simple', shape: 'BOX', reason: 'single-shell mesh' },
      planBasis: 'measured',
      shells: 1,
      collisionElements: null,
      error: 'the mesh reported no body_setup count',
    });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    fireEvent.click(screen.getByTestId('ue-import-submit'));

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(card.textContent).toMatch(/NOT COUNTED/);
    expect(screen.getByTestId('ue-import-verdict').textContent).toMatch(/FAILED/);
  }, 15_000);

  it('a decorative import shows "none requested", not a red NOT COUNTED', async () => {
    queue({
      status: 'done',
      glbPath: 'sign.glb',
      use: 'decorative',
      assetPath: '/Game/Generated/Sign.Sign',
      collision: { kind: 'none', reason: 'decorative asset — no collision at all' },
      planBasis: 'not-needed',
      shells: null,
      collisionElements: null,
    });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'sign.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-decorative'));
    fireEvent.click(screen.getByTestId('ue-import-submit'));

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(card.textContent).toMatch(/none requested/);
    expect(card.textContent).not.toMatch(/NOT COUNTED/);
  }, 15_000);

  it('surfaces an assumed plan as such when the critic could not run', async () => {
    queue({
      status: 'done',
      glbPath: 'a.glb',
      use: 'blocking',
      assetPath: '/Game/x.x',
      collision: { kind: 'simple', shape: 'BOX', reason: 'single-shell — ASSUMED: the geometry critic did not run' },
      planBasis: 'assumed',
      shells: null,
      collisionElements: 1,
      critiqueUnavailable: true,
      critiqueError: 'trimesh not installed',
    });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    fireEvent.click(screen.getByTestId('ue-import-submit'));

    await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/ASSUMED/i);
    expect(screen.getByTestId('ue-import-critique-unavailable').textContent).toMatch(/trimesh not installed/);
  }, 15_000);

  it('reports a start failure instead of leaving the button spinning', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, error: 'no file at a.glb' }) });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    fireEvent.click(screen.getByTestId('ue-import-submit'));

    await waitFor(() => expect(screen.getByTestId('ue-import-error').textContent).toMatch(/no file at/));
    expect((screen.getByTestId('ue-import-submit') as HTMLButtonElement).disabled).toBe(false);
  });
});
