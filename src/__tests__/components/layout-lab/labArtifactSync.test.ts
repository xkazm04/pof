import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { fetchArtifacts, postArtifact } from '@/components/layout-lab/labArtifactClient';
import { useLabPipelineStore, setLabSync } from '@/components/layout-lab/labPipelineStore';

describe('resolveAccept', () => {
  it('resolves an Items step checker, null for unknown', () => {
    expect(typeof resolveAccept('items', 'Concept Brief')).toBe('function');
    expect(resolveAccept('items', 'Nope')).toBeNull();
    expect(resolveAccept('no-such-catalog', 'x')).toBeNull();
  });
});

describe('artifact client', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('postArtifact POSTs the body to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    await postArtifact({ catalogId: 'items', entityId: 'item-1', step: 'Economy', data: { power: 102 }, ueAssets: [], status: 'pass', tier: 'L0' });
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-artifacts', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ catalogId: 'items', step: 'Economy', status: 'pass', tier: 'L0' });
    vi.unstubAllGlobals();
  });

  it('fetchArtifacts returns [] on failure (non-throwing)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchArtifacts('items', 'item-1')).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('produce write-through', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });
  afterEach(() => { setLabSync(null); });

  it('produce fires the registered sync with the artifact', () => {
    const spy = vi.fn();
    setLabSync(spy);
    useLabPipelineStore.getState().produce('e1', 'Step A', { data: { x: 1 }, ueAssets: ['/p'] });
    expect(spy).toHaveBeenCalledWith('e1', 'Step A', expect.objectContaining({ done: true, data: { x: 1 }, ueAssets: ['/p'] }));
  });
});
