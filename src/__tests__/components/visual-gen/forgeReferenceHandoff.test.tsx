/**
 * The forge's two tabs as ONE pipeline (asset-forge/B): a staged reference opens the
 * Generate tab ready to submit, an upload keeps today's exact request, and the 2D result
 * offers "Make 3D from this image". No paid call happens before the Generate click; every
 * network call is stubbed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerationPanel } from '@/components/modules/visual-gen/asset-forge/GenerationPanel';
import { Image2DPanel } from '@/components/modules/visual-gen/asset-forge/Image2DPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

beforeEach(() => {
  useForgeStore.setState({
    jobs: [], activeProviderId: 'triposr', promptHistory: [], activeStyleDna: null, applyStyleDna: true,
    activePolls: [], reference: null,
  });
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
  useNavigationStore.setState({ moduleTabs: {} });
});
afterEach(() => {
  useForgeStore.getState().stopAllPolling();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GenerationPanel with a staged 2D reference', () => {
  it('opens in Image to 3D, names the source image, and is not blocked on an upload', () => {
    useForgeStore.setState({
      reference: { dataUrl: DATA_URL, source: 'image-2d', sourceName: 'potion.png', subject: 'bronze potion' },
    });
    render(<GenerationPanel />);

    const imageMode = screen.getByRole('button', { name: /image to 3d/i });
    expect(imageMode.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('forge-reference-label').textContent).toContain('potion.png');
    expect(screen.queryByTestId('forge-submit-block')?.textContent ?? '').not.toContain('Upload a reference image first.');
    expect((screen.getByPlaceholderText(/leave blank to match the image/i) as HTMLInputElement).value).toBe('bronze potion');
  });
});

describe('[guard] a plain upload submits exactly as before', () => {
  it("posts { mode, providerId, imageDataUrl, prompt, assetClass } byte-for-byte, and the job has no sourceImage", async () => {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/visual-gen/generate' && init?.method === 'POST') {
        bodies.push(String(init.body));
        return new Response(JSON.stringify({ success: true, data: { jobId: 'runner-1' } }), { status: 202 });
      }
      return new Response(JSON.stringify({ success: true, data: { status: 'running' } }), { status: 200 });
    }));
    render(<GenerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /image to 3d/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'crate.png', { type: 'image/png' })] } });
    const submit = screen.getByRole('button', { name: /generate 3d model/i });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(submit);

    await waitFor(() => expect(bodies).toHaveLength(1));
    const b = JSON.parse(bodies[0]);
    expect(Object.keys(b)).toEqual(['mode', 'providerId', 'imageDataUrl', 'prompt']);
    expect(bodies[0]).toBe(JSON.stringify({
      mode: b.mode, providerId: b.providerId, imageDataUrl: b.imageDataUrl, prompt: b.prompt, assetClass: undefined,
    }));
    expect(b.mode).toBe('image-to-3d');
    expect(b.imageDataUrl).toBe('data:image/png;base64,eA==');
    await waitFor(() => expect(useForgeStore.getState().jobs[0]?.status).toBe('generating'));
    expect(useForgeStore.getState().jobs[0].sourceImage).toBeUndefined();
  });
});

describe('Image2DPanel — "Make 3D from this image"', () => {
  it('stages the generated image and opens the Generate tab, with no paid call', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/visual-gen/generate-2d' && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true, data: {
          url: '/api/visual-gen/image/potion.png', name: 'potion.png', providerId: 'leonardo', providerName: 'Leonardo',
        } }));
      }
      if (url === '/api/visual-gen/generate-2d') {
        return new Response(JSON.stringify({ success: true, data: {
          providers: [{ id: 'leonardo', name: 'Leonardo', description: 'cloud', executable: true }], defaultProviderId: 'leonardo',
        } }));
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } });
    }));
    render(<Image2DPanel />);
    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'bronze potion' } });
    await waitFor(() => expect(screen.getByTestId('image2d-submit').hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByTestId('image2d-submit'));

    fireEvent.click(await screen.findByRole('button', { name: /make 3d from this image/i }));

    await waitFor(() => expect(useNavigationStore.getState().moduleTabs['asset-forge']).toBe('generate'));
    expect(useForgeStore.getState().reference).toEqual({
      dataUrl: 'data:image/png;base64,AQID', source: 'image-2d', sourceName: 'potion.png', subject: 'bronze potion',
    });
    expect(urls.filter((u) => u.includes('/api/visual-gen/generate') && !u.includes('generate-2d'))).toEqual([]);
    expect(urls).toContain('GET /api/visual-gen/image/potion.png');
  });
});

describe('GenerationQueue — the card states its 2D origin', () => {
  it("prints 'from 2D image <name>' for a job made from a 2D result, and nothing for an upload", () => {
    useForgeStore.setState({ jobs: [
      { id: 'a', mode: 'image-to-3d', prompt: 'bronze potion', providerId: 'tripo3d', status: 'failed', progress: 0,
        createdAt: Date.now(), imageUrl: DATA_URL, sourceImage: 'potion.png' },
      { id: 'b', mode: 'image-to-3d', prompt: 'crate', providerId: 'tripo3d', status: 'failed', progress: 0,
        createdAt: Date.now(), imageUrl: DATA_URL },
    ] });
    render(<GenerationQueue />);
    const lines = screen.getAllByTestId('job-source-image');
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe('from 2D image potion.png');
  });
});
