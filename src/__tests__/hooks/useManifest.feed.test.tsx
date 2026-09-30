/**
 * `useManifest` is a thin view over ONE manifest feed per tab: keyed to the
 * connected editor (port + project), one in-flight request per kind, one 30s
 * checksum interval refcounted by VISIBLE holders (hidden LRU panes release it
 * through `useSuspendableEffect`), and a checksum check that actually fires.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, cleanup } from '@testing-library/react';
import { useManifest } from '@/hooks/useManifest';
import { SuspendContext } from '@/hooks/useSuspend';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { GET } from '@/app/api/pof-bridge/manifest/route';
import type { AssetManifest, PofBridgeStatus } from '@/types/pof-bridge';

// ── Fixtures ────────────────────────────────────────────────────────────────

function manifestFor(projectName: string, checksum: string): AssetManifest {
  return {
    version: 1,
    generatedAt: '2026-09-30T00:00:00Z',
    projectName,
    engineVersion: '5.5.0',
    assetCount: 0,
    checksumSha256: checksum,
    blueprints: [],
    materials: [],
    animAssets: [],
    dataTables: [],
    otherAssets: [],
  };
}

function pluginFor(projectName: string, port = 30040): PofBridgeStatus {
  return {
    pluginVersion: '1.0.0',
    engineVersion: '5.5.0',
    projectName,
    projectRoot: `C:/Projects/${projectName}`,
    editorState: 'idle',
    pieRunning: false,
    liveCodingEnabled: false,
    manifestReady: true,
    manifestAssetCount: 0,
    manifestLastUpdated: '2026-09-30T00:00:00Z',
    uptimeSeconds: 1,
    port,
  };
}

// ── Fetch double: routes by URL, counts by kind ─────────────────────────────

interface Plugin {
  project: string;
  checksum: string;
  /** When set, full-manifest answers wait for this gate. */
  fullGate: Promise<void> | null;
}

let plugin: Plugin;
let urls: string[];

const isChecksum = (u: string) => u.includes('checksum-only=true');
const fullCount = () => urls.filter((u) => !isChecksum(u)).length;
const checksumCount = () => urls.filter(isChecksum).length;

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  urls = [];
  plugin = { project: 'Did', checksum: 'c1', fullGate: null };
  // Browser calls go through the REAL route handler; its upstream call lands on
  // this same double acting as the plugin, which answers the documented
  // contract (`{ checksum }` for checksum-only, plugin design doc section 8).
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/pof-bridge/manifest')) {
      urls.push(url);
      return GET({ url: `http://localhost:3000${url}` } as Request);
    }
    if (url.includes('checksum-only=true')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ checksum: plugin.checksum }) };
    }
    const snapshot = { project: plugin.project, checksum: plugin.checksum };
    if (plugin.fullGate) await plugin.fullGate;
    const body = JSON.stringify(manifestFor(snapshot.project, snapshot.checksum));
    return { ok: true, status: 200, text: async () => body };
  }) as unknown as typeof fetch;

  usePofBridgeStore.setState({
    pofPort: 30040,
    connectionStatus: 'connected',
    pluginInfo: pluginFor('Did'),
    manifest: null,
    manifestChecksum: null,
    lastManifestUpdate: null,
  });
});

afterEach(async () => {
  cleanup();
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

/** Let effects, a possible animation frame, and resolved fetches land. */
async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
}

function Probe({ onValue }: { onValue?: (m: AssetManifest | null) => void }) {
  const { manifest } = useManifest();
  onValue?.(manifest);
  return null;
}

function Holders({ suspended }: { suspended: boolean[] }) {
  return (
    <>
      {suspended.map((s, i) => (
        <SuspendContext.Provider key={i} value={s}>
          <Probe />
        </SuspendContext.Provider>
      ))}
    </>
  );
}

// ── Cases ───────────────────────────────────────────────────────────────────

describe('useManifest — one keyed manifest feed per tab', () => {
  it('refetches the full manifest when the 30s poll reports a new checksum', async () => {
    usePofBridgeStore.setState({ manifest: manifestFor('Did', 'old'), manifestChecksum: 'old' });
    plugin.checksum = 'old';
    renderHook(() => useManifest());
    await settle();
    expect(fullCount()).toBe(0);

    plugin.checksum = 'new';
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(fullCount()).toBe(1);
    expect(usePofBridgeStore.getState().manifestChecksum).toBe('new');
  });

  it('4 mounts on an empty store share one full fetch and one checksum interval', async () => {
    for (let i = 0; i < 4; i += 1) renderHook(() => useManifest());
    await settle();

    expect(fullCount()).toBe(1);
    expect(checksumCount()).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(checksumCount()).toBe(1);
    expect(fullCount()).toBe(1);
  });

  it('hidden holders (SuspendContext true) poll nothing; one becoming visible checks at once and resumes the interval', async () => {
    usePofBridgeStore.setState({ manifest: manifestFor('Did', 'c1'), manifestChecksum: 'c1' });
    const view = render(<Holders suspended={[true, true, true, true]} />);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(urls).toHaveLength(0);

    view.rerender(<Holders suspended={[false, true, true, true]} />);
    await settle();
    expect(checksumCount()).toBe(1);
    expect(fullCount()).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(checksumCount()).toBe(2);
  });

  it('the interval dies with its last holder', async () => {
    const hooks = Array.from({ length: 4 }, () => renderHook(() => useManifest()));
    await settle();
    urls = [];

    for (const h of hooks) h.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(urls).toHaveLength(0);
  });

  it('every manifest URL carries the configured pofPort', async () => {
    usePofBridgeStore.setState({ pofPort: 30041, pluginInfo: pluginFor('Did', 30041) });
    renderHook(() => useManifest());
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(fullCount()).toBeGreaterThanOrEqual(1);
    expect(checksumCount()).toBeGreaterThanOrEqual(1);
    for (const url of urls) expect(url).toContain('port=30041');
  });

  it('a reconnect to another editor never serves the previous editor\'s manifest', async () => {
    usePofBridgeStore.setState({
      pluginInfo: pluginFor('A'),
      manifest: manifestFor('A', 'a1'),
      manifestChecksum: 'a1',
    });
    plugin.project = 'A';
    plugin.checksum = 'a1';
    const seen: Array<string | null> = [];
    render(<Probe onValue={(m) => seen.push(m?.projectName ?? null)} />);
    await settle();
    expect(seen[seen.length - 1]).toBe('A');

    let open!: () => void;
    plugin.fullGate = new Promise<void>((resolve) => { open = resolve; });
    plugin.project = 'B';
    plugin.checksum = 'b1';
    const switchedAt = seen.length;
    await act(async () => { usePofBridgeStore.setState({ pluginInfo: pluginFor('B') }); });
    await settle();
    expect(seen[seen.length - 1]).toBeNull();

    await act(async () => { open(); await vi.advanceTimersByTimeAsync(20); });
    expect(seen[seen.length - 1]).toBe('B');
    expect(seen.slice(switchedAt)).not.toContain('A');
  });

  it('[guard] disconnected: no fetches, the cached manifest of the last editor is still returned', async () => {
    const cached = manifestFor('Did', 'c1');
    usePofBridgeStore.setState({
      connectionStatus: 'disconnected',
      pluginInfo: null,
      manifest: cached,
      manifestChecksum: 'c1',
    });
    const { result } = renderHook(() => useManifest());
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });

    expect(urls).toHaveLength(0);
    expect(result.current.manifest).toBe(cached);
  });
});
