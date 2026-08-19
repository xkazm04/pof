import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import {
  projectCritique,
  jobOutcome,
  meshPreview,
} from '@/components/modules/visual-gen/asset-forge/forgeJobStatus';
import type { MeshMetrics } from '@/lib/visual-gen/mesh-critique';

// The lab's 3D viewer is WebGL-only (three/r3f behind next/dynamic). We assert the
// forge WIRES it with the right served URL; rendering three in jsdom is not the point.
vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: ({ url }: { url: string }) => <div data-testid="glb-viewer-stub">{url}</div>,
}));

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
});

beforeEach(() => {
  useForgeStore.setState({ jobs: [], activeProviderId: 'triposr', promptHistory: [], activePolls: [] });
});

const METRICS: MeshMetrics = {
  verts: 4, faces: 8, watertight: true, windingConsistent: true, components: 1,
  euler: 2, bbox: [1, 1, 1], volume: 0.5, area: 3, degenerateFaces: 0,
  componentFaces: [8], componentFacesOmitted: 0,
};

describe('projectCritique — the wire shape the client consumes', () => {
  it('projects an errored critique explicitly instead of collapsing it to {}', () => {
    const p = projectCritique({ ok: false, error: 'venv python not found' });
    expect(p).toEqual({ ok: false, error: 'venv python not found' });
  });

  it('reports a missing verdict rather than shipping an all-undefined scorecard', () => {
    // `ok: true` with no verdict is the shape that used to JSON-serialise to `{}`.
    expect(projectCritique({ ok: true })).toEqual({
      ok: false,
      error: 'critique produced no verdict',
    });
  });

  /** FORCED FAILURE (red before this direction): the ≤4096-number histogram
   *  was shipped on every 5 s poll and read by nothing. */
  it('drops metrics.componentFaces from the poll payload but keeps what the UI reads', () => {
    const p = projectCritique({ ok: true, verdict: 'pass', score: 100, reasons: [], metrics: METRICS });
    expect(p?.ok).toBe(true);
    if (!p || !p.ok) throw new Error('unreachable');
    expect(p.metrics).toBeDefined();
    expect('componentFaces' in (p.metrics as object)).toBe(false);
    expect(p.metrics?.faces).toBe(8);
    expect(p.metrics?.components).toBe(1);
    expect(p.metrics?.watertight).toBe(true);
  });

  it('passes undefined through', () => {
    expect(projectCritique(undefined)).toBeUndefined();
  });
});

describe('jobOutcome — the verdict axis is not the transport status', () => {
  it('separates a rejected delivery from a clean completion', () => {
    expect(jobOutcome({ status: 'completed', accepted: false })).toBe('rejected');
    expect(jobOutcome({ status: 'completed', accepted: true })).toBe('complete');
    // No verdict axis at all (local stores) — status is the only truth there.
    expect(jobOutcome({ status: 'completed' })).toBe('complete');
    expect(jobOutcome({ status: 'failed' })).toBe('failed');
    expect(jobOutcome({ status: 'generating' })).toBe('generating');
  });
});

describe('meshPreview — render what the asset route can serve, state the gap', () => {
  it('serves a mesh written under generated/triposr', () => {
    expect(meshPreview('C:/x/pof/generated/triposr/1751.glb')).toEqual({
      kind: 'servable',
      url: '/api/visual-gen/asset/1751.glb',
    });
  });

  // The asset route was widened to every provider dir + mesh-finish, so a cloud mesh
  // is now genuinely servable — it just has to NAME its dir, since basenames repeat.
  it('serves a Tripo cloud mesh, naming its dir in the URL', () => {
    expect(meshPreview('C:/x/pof/generated/tripo3d/1751.glb')).toEqual({
      kind: 'servable',
      url: '/api/visual-gen/asset/1751.glb?dir=tripo3d',
    });
  });

  it('names the gap for a mesh in a dir the asset route still does not serve', () => {
    const p = meshPreview('C:/x/pof/generated/jinx-leo/1751.glb');
    expect(p?.kind).toBe('gap');
    if (p?.kind !== 'gap') throw new Error('unreachable');
    expect(p.reason).toContain('generated/triposr');
    expect(p.reason).toContain('generated/jinx-leo/1751.glb');
  });

  it('returns nothing when there is no mesh at all', () => {
    expect(meshPreview(undefined)).toBeNull();
  });
});

describe('GenerationQueue — the card shows what the server measured', () => {
  /** FORCED FAILURE (red before this direction): `done` + `accepted: false`
   *  rendered as a green "Complete". */
  it('renders a done-but-unaccepted job as REJECTED with the gate reason', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A sword', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, {
      status: 'completed',
      accepted: false,
      gateReason: 'no attempt cleared the gate in 3 generations (best score 41)',
      attempts: 3,
      completedAt: Date.now(),
    });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-outcome-label').textContent).toContain('Rejected');
    expect(screen.queryByText('Complete')).toBeNull();
    expect(screen.getByTestId('job-gate-reason').textContent).toContain('best score 41');
    expect(screen.getByTestId('job-attempts').textContent).toContain('3 generations spent');
  });

  it('still reads as Complete when the gate accepted the mesh', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A shield', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, { status: 'completed', accepted: true, completedAt: Date.now() });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-outcome-label').textContent).toBe('Complete');
    expect(screen.queryByTestId('job-gate-reason')).toBeNull();
  });

  it('surfaces a container mismatch the runner detected', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A helm', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, {
      status: 'completed', accepted: true, completedAt: Date.now(),
      formatMismatch: 'wrote FBX bytes to a .glb path',
    });

    render(<GenerationQueue />);
    expect(screen.getByTestId('job-format-mismatch').textContent).toContain('wrote FBX bytes');
  });

  it('renders the shared 3D viewer for a servable mesh', () => {
    const id = useForgeStore.getState().addJob({ mode: 'image-to-3d', prompt: '', providerId: 'triposr' });
    useForgeStore.getState().updateJob(id, {
      status: 'completed', accepted: true, completedAt: Date.now(),
      meshPath: 'C:/x/pof/generated/triposr/9001.glb',
    });

    render(<GenerationQueue />);
    expect(screen.getByTestId('glb-viewer-stub').textContent).toBe('/api/visual-gen/asset/9001.glb');
  });

  it('renders the viewer for a Tripo CLOUD mesh too, now the route serves its dir', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A axe', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, {
      status: 'completed', accepted: true, completedAt: Date.now(),
      meshPath: 'C:/x/pof/generated/tripo3d/9002.glb',
    });

    render(<GenerationQueue />);
    expect(screen.getByTestId('glb-viewer-stub').textContent).toBe('/api/visual-gen/asset/9002.glb?dir=tripo3d');
  });

  it('states the serving gap instead of a silent blank for a mesh outside every served dir', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A axe', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, {
      status: 'completed', accepted: true, completedAt: Date.now(),
      meshPath: 'C:/x/pof/generated/jinx-leo/9002.glb',
    });

    render(<GenerationQueue />);
    expect(screen.queryByTestId('glb-viewer-stub')).toBeNull();
    expect(screen.getByTestId('job-preview-gap').textContent).toContain('generated/jinx-leo/9002.glb');
  });

  it('does not crash on a job whose critique failed to run', () => {
    const id = useForgeStore.getState().addJob({ mode: 'image-to-3d', prompt: '', providerId: 'triposr' });
    expect(() => {
      useForgeStore.getState().updateJob(id, {
        status: 'completed', completedAt: Date.now(),
        critique: { ok: false, error: 'no critique markers in output' },
      });
      render(<GenerationQueue />);
    }).not.toThrow();
    expect(screen.getByTestId('critique-not-run').textContent).toContain('no critique markers in output');
  });
});
