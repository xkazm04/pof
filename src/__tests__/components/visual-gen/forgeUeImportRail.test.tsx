/**
 * The UE import rides the forge poll rail. A Send boots the editor and runs for minutes;
 * before this, the poll lived in UeImportPanel's own timer, so a forge tab switch (which
 * unmounts the panel) threw the verdict away — including the collision count read back
 * from body_setup — and one failed status fetch ended the import. Now the import lives in
 * the store, is listed in `activePolls`, forgives transport misses like a generation does,
 * and the operator's stop says the editor may still be importing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { UeImportPanel } from '@/components/modules/visual-gen/asset-forge/UeImportPanel';
import { useForgeStore, UE_IMPORT_IDLE } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

const POLL_MS = 5_000; // UI_TIMEOUTS.experimentPoll

const REQUEST = {
  glbPath: 'C:/p/generated/mesh-finish/chair_lowpoly.glb',
  use: 'blocking' as const,
  assetName: 'SM_Chair',
  destPath: '/Game/Generated/SM_Chair',
};

const DONE = {
  status: 'done',
  glbPath: REQUEST.glbPath,
  use: 'blocking',
  assetPath: '/Game/Generated/SM_Chair/SM_Chair.SM_Chair',
  collision: { kind: 'convex', hullCount: 6, maxHullVerts: 16, reason: '4 shells — convex decomposition' },
  planBasis: 'measured',
  shells: 4,
  collisionElements: 7,
};

type Reply = { ok: boolean; data?: unknown; error?: string };
let statusReplies: Reply[] = [];
let calls: { url: string; method: string }[] = [];

function installFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url === '/api/visual-gen/ue-import') {
      return { ok: true, json: async () => ({ success: true, data: { jobId: 'ue-1' } }) };
    }
    if (url.startsWith('/api/visual-gen/ue-import/status')) {
      const r = statusReplies.length > 1 ? statusReplies.shift()! : statusReplies[0];
      return r.ok
        ? { ok: true, json: async () => ({ success: true, data: r.data }) }
        : { ok: false, json: async () => ({ success: false, error: r.error }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch);
}

const statusCalls = () => calls.filter((c) => c.url.startsWith('/api/visual-gen/ue-import/status'));

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  statusReplies = [{ ok: true, data: { ...DONE, status: 'running', assetPath: undefined, collisionElements: null } }];
  installFetch();
  useForgeStore.setState({ jobs: [], activePolls: [], ueImport: UE_IMPORT_IDLE });
});
afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  useForgeStore.setState({ ueImport: UE_IMPORT_IDLE });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UE import on the forge poll rail', () => {
  it('survives the panel unmounting (a forge tab switch) and keeps the collision count read back', async () => {
    await useForgeStore.getState().startUeImport(REQUEST);
    const trackId = useForgeStore.getState().ueImport.trackId;
    expect(trackId).toBe('ue-import:ue-1');
    expect(useForgeStore.getState().activePolls).toContain('ue-import:ue-1');

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(useForgeStore.getState().ueImport.status).toBe('running');

    // The operator switches the forge to the 2D Image tab: the panel unmounts.
    const first = render(<UeImportPanel />);
    first.unmount();

    statusReplies = [{ ok: true, data: DONE }];
    await vi.advanceTimersByTimeAsync(POLL_MS);

    const s = useForgeStore.getState();
    expect(s.ueImport.status).toBe('done');
    expect(s.ueImport.result?.collisionElements).toBe(7);
    expect(s.ueImport.error).toBeNull();
    expect(s.activePolls).toEqual([]);

    // And back on the Generate tab, the verdict is still there.
    render(<UeImportPanel />);
    expect(screen.getByTestId('ue-import-verdict').textContent).toMatch(/IMPORTED/);
    expect(screen.getByTestId('ue-import-result').textContent).toMatch(/7 ELEM/);
  });

  it('one failed status fetch does not end the import', async () => {
    statusReplies = [{ ok: false, error: 'fetch failed' }, { ok: true, data: DONE }];
    await useForgeStore.getState().startUeImport(REQUEST);

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });

    const { ueImport } = useForgeStore.getState();
    expect(statusCalls()).toHaveLength(2);
    expect(ueImport.status).toBe('done');
    expect(ueImport.error).toBeNull();
    expect(ueImport.result?.collisionElements).toBe(7);
  });

  it('stopPolling on the import untracks it and says the editor may still be importing', async () => {
    await useForgeStore.getState().startUeImport(REQUEST);
    await vi.advanceTimersByTimeAsync(POLL_MS);

    useForgeStore.getState().stopPolling('ue-import:ue-1');

    const s = useForgeStore.getState();
    expect(s.activePolls).toEqual([]);
    expect(s.ueImport.trackId).toBeNull();
    expect(s.ueImport.error).toBe('Tracking stopped by operator — the editor import may still be running.');

    const atStop = statusCalls().length;
    await vi.advanceTimersByTimeAsync(POLL_MS * 5);
    expect(statusCalls()).toHaveLength(atStop);
  });
});
