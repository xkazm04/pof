/**
 * An MCP-backed job renders through the SAME verdict vocabulary as a runner job.
 *
 * Forced-failure suite for `mcp-jobs-verdict-axis`. At HEAD~1 `submitMcpJob` read only
 * `{ status, progress, resultUrl }` and a finished Blender generation rendered a green
 * "Complete" — the exact card a gate-passed runner mesh gets. This drives the real store
 * action over a mocked bridge and asserts the queue says "Delivered ungated" with the
 * reason nothing measured it, through the one shared `jobOutcome` path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { mcpGateProjection } from '@/lib/blender-mcp/mcp-gate';

vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: ({ url }: { url: string }) => <div data-testid="glb-viewer-stub">{url}</div>,
}));

/** The bridge, answering exactly what the real routes now answer. */
function installBridge() {
  const json = (data: unknown) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  const mock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/generate/status')) {
      // The route spreads the projection over the transport shape — mirrored here.
      return json({ jobId: 'mcp-1', status: 'completed', progress: 100, resultUrl: 'https://cdn/x.glb', ...mcpGateProjection('completed') });
    }
    if (url.includes('/generate/import')) return json({ objectName: 'GeneratedMesh' });
    return json({ jobId: 'mcp-1', status: 'processing' });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  useForgeStore.setState({ jobs: [], activeProviderId: 'rodin', promptHistory: [], activePolls: [] });
  installBridge();
});

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('submitMcpJob — the Blender path carries a verdict now', () => {
  it('lands a finished MCP job as delivered-ungated, not as a green Complete', async () => {
    vi.useFakeTimers();
    await useForgeStore.getState().submitMcpJob('rodin', 'a mossy rock', 'text-to-3d');
    // One poll tick drives completed → importing → completed.
    await vi.advanceTimersByTimeAsync(6_000);
    vi.useRealTimers();

    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('completed');
    expect(job.ungated).toBe(true);
    expect(job.accepted).toBe(false);
    expect(job.gateReason).toContain('delivered ungated');

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-outcome-label').textContent).toContain('Delivered ungated');
    expect(screen.queryByText('Complete')).toBeNull();
    // The reason names the located gap, so "ungraded" is actionable rather than a shrug.
    expect(screen.getByTestId('job-ungated-reason').textContent).toContain('no mesh file reaches this server');
    // and it is NOT dressed as a gate rejection — nothing measured this mesh.
    expect(screen.queryByTestId('job-gate-reason')).toBeNull();
  });

  it('shares one code path with the runner job beside it', async () => {
    vi.useFakeTimers();
    await useForgeStore.getState().submitMcpJob('rodin', 'a mossy rock', 'text-to-3d');
    await vi.advanceTimersByTimeAsync(6_000);
    vi.useRealTimers();

    // A runner job that was ALSO delivered ungated (critic could not run locally).
    const runnerId = useForgeStore.getState().addJob({ mode: 'image-to-3d', prompt: '', providerId: 'triposr' });
    useForgeStore.getState().updateJob(runnerId, {
      status: 'completed', completedAt: Date.now(),
      accepted: false, ungated: true,
      gateReason: 'critique unavailable: venv python not found — mesh delivered ungated',
    });

    render(<GenerationQueue />);
    // Same label, same test hook, same card shape — two providers, one vocabulary.
    const labels = screen.getAllByTestId('job-outcome-label').map((n) => n.textContent);
    expect(labels).toEqual(['Delivered ungated', 'Delivered ungated']);
    expect(screen.getAllByTestId('job-ungated-reason')).toHaveLength(2);
  });
});
