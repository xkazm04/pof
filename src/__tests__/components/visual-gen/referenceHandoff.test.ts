/**
 * 2D result -> image-to-3D reference, one click (asset-forge/B).
 *
 * The handoff is FREE: it re-reads our own served file (one GET of
 * /api/visual-gen/image/:name), stages it in the forge store and moves the forge to its
 * Generate tab through the navigation store's per-module door. Nothing paid runs until
 * the existing Generate button is clicked. Every network call here is stubbed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  imageUrlToDataUrl,
  stageImage2DForMesh,
  initialForgeMode,
} from '@/components/modules/visual-gen/asset-forge/referenceHandoff';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { useNavigationStore } from '@/stores/navigationStore';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DATA_URL = `data:image/png;base64,${btoa(String.fromCharCode(...PNG_BYTES))}`;
const IMAGE_URL = '/api/visual-gen/image/potion.png';
// Built, never written whole: a ratchet forbids the literal anywhere in production src/.
const OLD_TAB_EVENT = ['pof', 'navigate', 'tab'].join('-');

function imageResponse(): Response {
  return new Response(PNG_BYTES, { status: 200, headers: { 'Content-Type': 'image/png' } });
}
function notFound(): Response {
  return new Response(JSON.stringify({ success: false, error: 'image not found' }), {
    status: 404, headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch that records every URL it was asked for. */
function recordingFetch(answer: () => Response) {
  const urls: string[] = [];
  const fn = vi.fn(async (url: string | URL | Request) => { urls.push(String(url)); return answer(); });
  return { fn: fn as unknown as typeof fetch, urls };
}

beforeEach(() => {
  useForgeStore.setState({ jobs: [], promptHistory: [], activePolls: [], reference: null });
  useNavigationStore.setState({ moduleTabs: {} });
});
afterEach(() => {
  useForgeStore.getState().stopAllPolling();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('imageUrlToDataUrl — re-read our own served 2D bytes', () => {
  it('a 200 image/png answer becomes a data:image/png;base64 URL', async () => {
    const { fn } = recordingFetch(imageResponse);
    const res = await imageUrlToDataUrl(IMAGE_URL, fn);
    expect(res).toEqual({ ok: true, data: PNG_DATA_URL });
  });

  it("a 404 envelope is an err carrying the route's own reason, and no data URL", async () => {
    const { fn } = recordingFetch(notFound);
    const res = await imageUrlToDataUrl(IMAGE_URL, fn);
    expect(res).toEqual({ ok: false, error: 'image not found' });
  });
});

describe('stageImage2DForMesh — stage, then navigate through the store door', () => {
  it('stages the exact image + prompt and opens asset-forge/generate, with no window broadcast', async () => {
    const { fn } = recordingFetch(imageResponse);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const res = await stageImage2DForMesh({ url: IMAGE_URL, name: 'potion.png' }, 'bronze potion', { fetchFn: fn });

    expect(res.ok).toBe(true);
    expect(useForgeStore.getState().reference).toEqual({
      dataUrl: PNG_DATA_URL, source: 'image-2d', sourceName: 'potion.png', subject: 'bronze potion',
    });
    expect(useNavigationStore.getState().moduleTabs['asset-forge']).toBe('generate');
    const tabEvents = dispatchSpy.mock.calls.filter(([e]) => e.type === OLD_TAB_EVENT);
    expect(tabEvents).toHaveLength(0);
  });

  it('a failed fetch returns err: nothing staged, no navigation', async () => {
    const { fn } = recordingFetch(notFound);
    const navigate = vi.fn();
    const before = useForgeStore.getState().reference;

    const res = await stageImage2DForMesh({ url: IMAGE_URL, name: 'potion.png' }, 'bronze potion', { fetchFn: fn, navigate });

    expect(res).toEqual({ ok: false, error: 'image not found' });
    expect(navigate).not.toHaveBeenCalled();
    expect(useForgeStore.getState().reference).toBe(before);
    expect(useNavigationStore.getState().moduleTabs['asset-forge']).toBeUndefined();
  });

  it('[paid-guard] staging makes 0 calls to /api/visual-gen/generate — only the image GET', async () => {
    const injected = recordingFetch(imageResponse);
    const global = recordingFetch(imageResponse);
    vi.stubGlobal('fetch', global.fn);

    await stageImage2DForMesh({ url: IMAGE_URL, name: 'potion.png' }, 'bronze potion', { fetchFn: injected.fn });

    const all = [...injected.urls, ...global.urls];
    expect(all).toEqual([IMAGE_URL]);
    expect(all.some((u) => u.includes('/api/visual-gen/generate'))).toBe(false);
    expect(useForgeStore.getState().jobs).toEqual([]);
  });
});

describe('initialForgeMode', () => {
  it("is 'image-to-3d' with a staged reference and 'text-to-3d' without one", () => {
    expect(initialForgeMode({ dataUrl: PNG_DATA_URL, source: 'image-2d', sourceName: 'potion.png' })).toBe('image-to-3d');
    expect(initialForgeMode(null)).toBe('text-to-3d');
  });
});

describe('submitLocalJob / retryJob keep the 2D origin', () => {
  function stubGenerate(answer: 'accept' | 'refuse') {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/visual-gen/generate' && init?.method === 'POST') {
        bodies.push(String(init.body));
        return answer === 'accept'
          ? new Response(JSON.stringify({ success: true, data: { jobId: 'runner-1' } }), { status: 202 })
          : new Response(JSON.stringify({ success: false, error: 'input gate refused' }), { status: 422 });
      }
      return new Response(JSON.stringify({ success: true, data: { status: 'running' } }), { status: 200 });
    }));
    return bodies;
  }

  it('posts the staged dataUrl, records sourceImage on the job, and a retry keeps both', async () => {
    const bodies = stubGenerate('refuse');
    await useForgeStore.getState().submitLocalJob(
      'tripo3d', 'image-to-3d', PNG_DATA_URL, 'bronze potion', undefined, { sourceImage: 'potion.png' },
    );
    expect(JSON.parse(bodies[0]).imageDataUrl).toBe(PNG_DATA_URL);
    const failed = useForgeStore.getState().jobs[0];
    expect(failed.status).toBe('failed');
    expect(failed.sourceImage).toBe('potion.png');

    useForgeStore.getState().retryJob(failed.id);
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    expect(JSON.parse(bodies[1]).imageDataUrl).toBe(PNG_DATA_URL);
    const twin = useForgeStore.getState().jobs[0];
    expect(twin.id).not.toBe(failed.id);
    expect(twin.sourceImage).toBe('potion.png');
    // The origin is client-side provenance: the request body never carries it.
    expect(bodies.every((b) => !b.includes('sourceImage'))).toBe(true);
  });
});
