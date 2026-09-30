import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { PackageLedgerPanel } from '@/components/layout-lab/steps/PackageLedgerPanel';
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { minCount } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const VIEW = {
  step: 'UE Packaging',
  stored: { status: 'deferred', tier: 'L2', reason: 'package is empty' },
  verdict: 'pass',
  manifest: {
    files: [{ name: 'generated/a.png', sourceStep: 'Concept 2D Art', origin: 'referenced', path: 'generated/a.png', bytes: 9, sha1: 'abcdef0123456789' }],
    missing: [{ path: 'generated/meshes/g.glb', sourceStep: '3D Mesh', reason: 'referenced file not found on disk' }],
    ueDeclarations: [],
  },
  ledger: {
    state: 'blocked', staged: 1, declarations: 'none',
    blockers: [{ step: '3D Mesh', kind: 'missing-file', count: 1, reason: 'referenced file not found on disk' }],
    unverified: [{ step: 'Concept 2D Art', status: 'pending', source: 'checker', files: 1, reason: 'TEMPLATE: exemplar stub' }],
  },
};
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

describe('PackageLedgerPanel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => (String(url).includes('verify-packaging') ? ok({ verified: 1, results: [] }) : ok(VIEW)));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('Rebuild POSTs the scoped verify-packaging (the one writer), then re-reads the package — in that order', async () => {
    render(<PackageLedgerPanel t={t} catalogId="affixes" entityId="e1" />);
    expect(fetchMock).not.toHaveBeenCalled(); // on demand — never on mount
    fireEvent.click(screen.getByRole('button', { name: /Rebuild package/ }));
    await waitFor(() => expect(screen.getByTestId('package-ledger-verdicts').textContent)
      .toBe('stored deferred · rebuilt pass — Rebuild records it'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(postUrl).toBe('/api/pipeline-artifacts/verify-packaging');
    expect(postInit.method).toBe('POST');
    expect(JSON.parse(String(postInit.body))).toEqual({ catalogId: 'affixes', entityId: 'e1' });
    const [getUrl, getInit] = fetchMock.mock.calls[1] as [string, RequestInit | undefined];
    expect(getUrl).toBe('/api/pipeline-artifacts/package?catalogId=affixes&entityId=e1');
    expect(getInit?.method ?? 'GET').toBe('GET');
  });

  it('names each blocker by its owing step and the layer that condemned it', async () => {
    render(<PackageLedgerPanel t={t} catalogId="affixes" entityId="e1" />);
    fireEvent.click(screen.getByRole('button', { name: /Check package/ }));
    await waitFor(() => expect(screen.getByText('3D Mesh (missing file · disk)')).toBeTruthy());
    expect(screen.getByText('Concept 2D Art (pending · TEMPLATE)')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a failed read reports its reason', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404, json: async () => ({ success: false, error: 'affixes has no stored UE Packaging row' }) }));
    render(<PackageLedgerPanel t={t} catalogId="affixes" entityId="e1" />);
    fireEvent.click(screen.getByRole('button', { name: /Check package/ }));
    await waitFor(() => expect(screen.getByText(/has no stored UE Packaging row/)).toBeTruthy());
  });
});

describe('ArchetypeStep — Package on disk panel', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  const entity = { id: 'e1', name: 'Keen', lifecycle: 'planned' as const, data: {} };
  const manifestSpec = (label: string): StepSpec => ({
    archetype: 'manifest', label,
    view: { kind: 'manifest', field: 'assets' },
    produce: () => ({ data: { assets: ['/Game/A', '/Game/B'] } }),
    accept: minCount('assets', 'two assets', 2),
  });

  it('[guard] a non-packaging manifest step renders no package ledger', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Rig & Clips" spec={manifestSpec('Rig & Clips')} catalogId="affixes" />);
    expect(document.querySelector('[data-testid="package-ledger"]')).toBeNull();
  });

  it('the packaging step renders the package ledger beside its View', () => {
    render(<ArchetypeStep t={t} entity={entity} step="UE Packaging" spec={manifestSpec('UE Packaging')} catalogId="affixes" />);
    expect(document.querySelector('[data-testid="package-ledger"]')).not.toBeNull();
  });
});
