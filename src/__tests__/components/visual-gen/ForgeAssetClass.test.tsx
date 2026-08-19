/**
 * The asset-class picker, and the three delivery states of a finished job.
 *
 * Forced-failure suite for `forge-asset-class-picker`. Before this direction:
 *  - the panel had no picker at all and `submitLocalJob`'s POST body carried no
 *    `assetClass`, so every mesh the app generated was graded class-blind while
 *    `resolveAssetClass` sat in the route computing a sentence nothing displayed;
 *  - the 202's `gradedAs` was discarded client-side, so the class-blind default was
 *    invisible — the operator had to ASSUME which budget a verdict used;
 *  - `jobOutcome` knew two delivered states, so a mesh nothing measured (`ungated`)
 *    rendered identically to one a gate ran on and passed.
 *
 * The mocked 202 builds its `gradedAs` with the ROUTE'S OWN `resolveAssetClass`, from
 * whatever class the panel actually sent — so this is a real round trip of the contract,
 * not a hand-written sentence agreeing with itself.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerationPanel } from '@/components/modules/visual-gen/asset-forge/GenerationPanel';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { jobOutcome } from '@/components/modules/visual-gen/asset-forge/forgeJobStatus';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { resolveAssetClass } from '@/lib/visual-gen/polycount-presets';

// The lab's 3D viewer is WebGL-only; the queue assertions here are about words.
vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: ({ url }: { url: string }) => <div data-testid="glb-viewer-stub">{url}</div>,
}));

/** Bodies the panel POSTed, so the request itself can be asserted. */
let posted: Array<Record<string, unknown>> = [];

/**
 * Stand in for POST /api/visual-gen/generate: answers 202-style with the route's real
 * `gradedAs` for the class it was sent. The status poll is never allowed to run (the
 * poller is stopped in afterEach), so this only ever serves the submit.
 */
function installGenerateMock() {
  posted = [];
  const mock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    posted.push(body);
    const gradedAs = resolveAssetClass(body.assetClass as string | undefined).gradedAs;
    return Promise.resolve({
      ok: true,
      status: 202,
      json: () => Promise.resolve({ success: true, data: { jobId: 'job-1', gradedAs } }),
      text: () => Promise.resolve(''),
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  useForgeStore.setState({
    jobs: [], activeProviderId: 'tripo3d', promptHistory: [],
    activeStyleDna: null, applyStyleDna: true, activePolls: [],
  });
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
  installGenerateMock();
});

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.restoreAllMocks();
});

/** Type a subject and press Generate. */
function submit() {
  fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });
  fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));
}

describe('GenerationPanel — the asset class reaches the route', () => {
  it('puts the picked class in the POST body and shows the budget the server graded by', async () => {
    render(<GenerationPanel />);
    fireEvent.change(screen.getByTestId('forge-asset-class'), { target: { value: 'weapon' } });
    submit();

    await waitFor(() => expect(posted.length).toBe(1));
    expect(posted[0].assetClass).toBe('weapon');

    // Verbatim from the response — the picker does not narrate what it thinks happened.
    await waitFor(() => expect(screen.getByTestId('forge-graded-as')).toBeTruthy());
    const line = screen.getByTestId('forge-graded-as').textContent ?? '';
    expect(line).toContain('Weapon / held item');
    expect(line).toContain('15000');
    expect(line).not.toContain('class-blind');
  });

  it('sends no class when the blank option is left alone, and SAYS it graded class-blind', async () => {
    render(<GenerationPanel />);
    submit();

    await waitFor(() => expect(posted.length).toBe(1));
    // Legitimately absent — never silently promoted to a "typical" class.
    expect(posted[0].assetClass).toBeUndefined();

    await waitFor(() => expect(screen.getByTestId('forge-graded-as')).toBeTruthy());
    const line = screen.getByTestId('forge-graded-as').textContent ?? '';
    expect(line).toContain('no assetClass supplied');
    expect(line).toContain('class-blind');
    // and it names the classes that WOULD have worked
    expect(line).toContain('character');
  });

  it('offers every real preset and defaults to the blank (class-blind) option', () => {
    render(<GenerationPanel />);
    const select = screen.getByTestId('forge-asset-class') as HTMLSelectElement;
    expect(select.value).toBe('');
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', 'character', 'weapon', 'prop', 'environment', 'modular-part']);
  });

  it('says the class is not sent on the Blender MCP path rather than implying it applies', () => {
    useForgeStore.setState({ activeProviderId: 'rodin' });
    render(<GenerationPanel />);
    expect(screen.getByTestId('forge-asset-class-mcp-note').textContent).toContain('not');
  });

  it('carries the class into a retry so the re-roll is graded against the same budget', async () => {
    render(<GenerationPanel />);
    fireEvent.change(screen.getByTestId('forge-asset-class'), { target: { value: 'prop' } });
    submit();
    await waitFor(() => expect(posted.length).toBe(1));

    const id = useForgeStore.getState().jobs[0].id;
    expect(useForgeStore.getState().jobs[0].assetClass).toBe('prop');
    useForgeStore.getState().updateJob(id, { status: 'failed', error: 'boom', completedAt: Date.now() });
    useForgeStore.getState().retryJob(id);

    await waitFor(() => expect(posted.length).toBe(2));
    expect(posted[1].assetClass).toBe('prop');
  });
});

describe('jobOutcome — ungated is a third delivered state', () => {
  it('separates delivered-ungraded from both a pass and a rejection', () => {
    // The stores set BOTH flags for an ungated delivery; reporting only `accepted`
    // would call a mesh nothing measured "rejected".
    expect(jobOutcome({ status: 'completed', accepted: false, ungated: true })).toBe('ungated');
    expect(jobOutcome({ status: 'completed', accepted: false })).toBe('rejected');
    expect(jobOutcome({ status: 'completed', accepted: true })).toBe('complete');
    expect(jobOutcome({ status: 'completed', accepted: true, ungated: false })).toBe('complete');
  });
});

describe('GenerationQueue — three delivery states, three cards', () => {
  const addDelivered = (patch: Record<string, unknown>) => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A sword', providerId: 'triposr' });
    useForgeStore.getState().updateJob(id, { status: 'completed', completedAt: Date.now(), ...patch });
    return id;
  };

  it('renders an ungated delivery as neither Complete nor Rejected, with what was missing', () => {
    addDelivered({
      accepted: false,
      ungated: true,
      gateReason: 'critique unavailable: POF_TRIPOSR_ROOT is not set — mesh delivered ungated',
    });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-outcome-label').textContent).toContain('Delivered ungated');
    expect(screen.queryByText('Complete')).toBeNull();
    expect(screen.queryByTestId('job-gate-reason')).toBeNull();
    expect(screen.getByTestId('job-ungated-reason').textContent).toContain('POF_TRIPOSR_ROOT');
    expect(screen.getByTestId('job-ungated-reason').textContent).toContain('delivered ungated');
  });

  it('keeps a gate-rejected delivery on its own wording', () => {
    addDelivered({ accepted: false, gateReason: 'Tier-1 gate FAIL (score 20): 500000 faces' });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-outcome-label').textContent).toContain('Rejected');
    expect(screen.queryByTestId('job-ungated-reason')).toBeNull();
    expect(screen.getByTestId('job-gate-reason').textContent).toContain('Tier-1 gate FAIL');
  });

  it('shows the budget a delivered job was graded against, verbatim', () => {
    addDelivered({ accepted: true, gradedAs: resolveAssetClass('character').gradedAs });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-graded-as').textContent).toContain('Character (hero/NPC)');
  });

  it('still previews the mesh of an ungated delivery — it was delivered, just not passed', () => {
    addDelivered({ accepted: false, ungated: true, meshPath: 'C:/x/pof/generated/triposr/7.glb' });

    render(<GenerationQueue />);
    expect(screen.getByTestId('glb-viewer-stub').textContent).toBe('/api/visual-gen/asset/7.glb');
  });
});
