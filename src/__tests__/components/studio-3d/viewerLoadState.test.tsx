/**
 * Direction: studio-viewer-load-state-lies.
 *
 * The viewer used to go blank instantly on a model switch — `useMemo` returned an empty
 * THREE.Group — while the inspector kept showing the PREVIOUS model's triangle count
 * under the NEW model's name, and a failed load left only a `console.error`.
 *
 * These assert the three states are distinguishable and that they can never disagree
 * with the gallery's `aria-pressed` selection.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { ViewportStatus } from '@/components/modules/visual-gen/asset-viewer/ViewportStatus';
import { describeLoadError } from '@/components/modules/visual-gen/asset-viewer/loadStatus';
import { StudioInspector } from '@/components/studio-3d/StudioInspector';
import { AssetGallery } from '@/components/studio-3d/AssetGallery';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';

const A_STATS = {
  triangles: 83728, vertices: 41864, meshes: 1, drawCalls: 1,
  materials: [], textures: [], animations: [],
  boundingBox: { width: 1.069, height: 0.569, depth: 0.599 },
} as unknown as AssetStats;

const URL_A = '/api/visual-gen/asset/chair.glb';
const URL_B = '/api/visual-gen/asset/jinx.glb?dir=tripo3d';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useViewerStore.getState().reset();
});

function ViewportFromStore() {
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const modelName = useViewerStore((s) => s.modelName);
  const modelUrl = useViewerStore((s) => s.modelUrl);
  return <ViewportStatus loadState={loadState} loadError={loadError} modelName={modelName} modelUrl={modelUrl} />;
}

describe('viewer load state — the store', () => {
  it('clears the previous model stats the instant a new model is picked', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_A, 'chair.glb');
    s.reportLoaded(URL_A, A_STATS);
    expect(useViewerStore.getState().stats?.triangles).toBe(83728);
    expect(useViewerStore.getState().loadState).toBe('loaded');

    // The lie: B's name with A's numbers still under it.
    useViewerStore.getState().setModel(URL_B, 'jinx.glb');
    expect(useViewerStore.getState().modelName).toBe('jinx.glb');
    expect(useViewerStore.getState().stats).toBeNull();
    expect(useViewerStore.getState().loadState).toBe('loading');
  });

  it('never sits in `idle` while a model URL is set', () => {
    useViewerStore.getState().setModel(URL_A, 'chair.glb');
    expect(useViewerStore.getState().loadState).not.toBe('idle');
    useViewerStore.getState().setModel(null, null);
    expect(useViewerStore.getState().loadState).toBe('idle');
    expect(useViewerStore.getState().stats).toBeNull();
  });

  it('drops a load that resolves after its model was superseded', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_A, 'chair.glb');
    s.setModel(URL_B, 'jinx.glb');
    // A's 42 MB fetch finally lands, seconds late.
    s.reportLoaded(URL_A, A_STATS);
    expect(useViewerStore.getState().stats).toBeNull();
    expect(useViewerStore.getState().loadState).toBe('loading');
  });

  it('records a failure as recoverable state, not a console line', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_A, 'chair.glb');
    s.reportLoadError(URL_A, 'HTTP 404');
    expect(useViewerStore.getState().loadState).toBe('error');
    expect(useViewerStore.getState().loadError).toContain('404');
    expect(useViewerStore.getState().stats).toBeNull();

    // Picking another asset recovers — the error does not stick to the studio.
    s.setModel(URL_B, 'jinx.glb');
    expect(useViewerStore.getState().loadState).toBe('loading');
    expect(useViewerStore.getState().loadError).toBeNull();
  });

  it('drops a failure reported for a superseded model', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_A, 'chair.glb');
    s.setModel(URL_B, 'jinx.glb');
    s.reportLoadError(URL_A, 'HTTP 404');
    expect(useViewerStore.getState().loadState).toBe('loading');
    expect(useViewerStore.getState().loadError).toBeNull();
  });
});

describe('describeLoadError', () => {
  it('reports the HTTP status a served .glb failed with', () => {
    expect(describeLoadError({ message: 'fetch for "/x.glb" responded with 404: Not Found' }))
      .toContain('404');
  });

  it('never yields an empty reason', () => {
    expect(describeLoadError(undefined).length).toBeGreaterThan(0);
    expect(describeLoadError({}).length).toBeGreaterThan(0);
  });
});

describe('ViewportStatus', () => {
  it('shows an in-flight state naming the model', () => {
    render(<ViewportStatus loadState="loading" loadError={null} modelName="jinx.glb" modelUrl={URL_B} />);
    const el = screen.getByTestId('viewport-status');
    expect(el.getAttribute('data-state')).toBe('loading');
    expect(el.textContent).toContain('jinx.glb');
  });

  it('shows the failure with the served URL', () => {
    render(<ViewportStatus loadState="error" loadError="HTTP 404" modelName="jinx.glb" modelUrl={URL_B} />);
    const el = screen.getByTestId('viewport-status');
    expect(el.getAttribute('data-state')).toBe('error');
    expect(el.textContent).toMatch(/could not load/i);
    expect(el.textContent).toContain(URL_B);
    expect(el.textContent).toContain('HTTP 404');
  });

  it('renders nothing once the mesh is on screen', () => {
    const { container } = render(
      <ViewportStatus loadState="loaded" loadError={null} modelName="jinx.glb" modelUrl={URL_B} />,
    );
    expect(container.querySelector('[data-testid="viewport-status"]')).toBeNull();
  });
});

describe('StudioInspector load state', () => {
  it('reports the load in flight instead of the previous model numbers', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_A, 'chair.glb');
    s.reportLoaded(URL_A, A_STATS);
    s.setModel(URL_B, 'jinx.glb');

    render(<StudioInspector modelName="jinx.glb" />);
    expect(screen.queryByText('83.7k')).toBeNull();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('reports a load failure with the served URL', () => {
    const s = useViewerStore.getState();
    s.setModel(URL_B, 'jinx.glb');
    s.reportLoadError(URL_B, 'HTTP 404');

    render(<StudioInspector modelName="jinx.glb" />);
    expect(screen.getByText(/could not load/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(URL_B.replace(/[?]/g, '\\?')))).toBeTruthy();
  });
});

describe('gallery selection and the viewport agree', () => {
  const asset = { name: 'chair.glb', sizeBytes: 1000, mtimeMs: 1, url: URL_A, previewUrl: null };
  const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;

  it('is pressed + loading, then pressed + error — never pressed + blank', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ assets: [asset] })));
    useViewerStore.getState().setModel(URL_A, 'chair.glb');

    function Harness() {
      const modelUrl = useViewerStore((s) => s.modelUrl);
      return (
        <>
          <AssetGallery activeUrl={modelUrl} onPick={() => {}} />
          <ViewportFromStore />
        </>
      );
    }
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('chair.glb')).toBeTruthy());

    const btn = screen.getByRole('button', { name: /chair\.glb/ });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('viewport-status').getAttribute('data-state')).toBe('loading');

    useViewerStore.getState().reportLoadError(URL_A, 'HTTP 500');
    await waitFor(() =>
      expect(screen.getByTestId('viewport-status').getAttribute('data-state')).toBe('error'),
    );
    expect(screen.getByRole('button', { name: /chair\.glb/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
