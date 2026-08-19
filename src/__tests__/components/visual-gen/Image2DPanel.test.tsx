/**
 * The 2D submit surface — the first button in PoF that turns a prompt into an image.
 *
 * FORCED-FAILURE SUITE. Before this direction no such surface existed, so each of
 * these was unassertable: a provider with no key is disabled WITH the reason BEFORE
 * any submit; a forced click on it sends nothing; a provider failure shows the
 * provider's own sentence; and no `<img>` is ever rendered without a real url behind
 * it (the placeholder-that-reads-as-a-result failure mode).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { Image2DPanel } from '@/components/modules/visual-gen/asset-forge/Image2DPanel';

function envelope(data: unknown): Response {
  return { ok: true, json: async () => ({ success: true, data }) } as unknown as Response;
}
function failure(error: string): Response {
  return { ok: false, status: 502, json: async () => ({ success: false, error }) } as unknown as Response;
}

const LEO_READY = {
  id: 'leonardo', name: 'Leonardo', description: 'cloud text-to-image', executable: true, official: true,
};
const QWEN_NO_KEY = {
  id: 'qwen-image', name: 'Qwen-Image', description: 'dashscope text-to-image',
  executable: false, missingKey: true,
  reason: 'Qwen-Image has no API key on this server — set QWEN_API_KEY or DASHSCOPE_API_KEY and restart.',
};
const SCENARIO_UNWIRED = {
  id: 'scenario', name: 'Scenario', description: 'pbr textures', executable: false,
  reason: 'Scenario produces a PBR TEXTURE SET, not a single image — it runs from the Material Lab.',
};

/** Mock the capability GET, then the generate POST. */
function mockFetch(capsProviders: unknown[], defaultProviderId: string | null, onPost?: () => Response) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return onPost ? onPost() : envelope({ ok: true });
    return envelope({ providers: capsProviders, defaultProviderId });
  });
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Image2DPanel — capability arrives from the server, before any submit', () => {
  it('disables a keyless provider and shows WHY, without being clicked', async () => {
    mockFetch([LEO_READY, QWEN_NO_KEY, SCENARIO_UNWIRED], 'leonardo');
    render(<Image2DPanel />);

    const qwen = await screen.findByTestId('image2d-provider-qwen-image');
    expect(qwen.getAttribute('data-executable')).toBe('false');
    expect(qwen.hasAttribute('disabled')).toBe(true);
    expect(qwen.textContent).toContain('NO KEY');
    expect(qwen.textContent).toContain('QWEN_API_KEY');

    // "wired but keyless" and "not wired at all" read as different states.
    const scenario = screen.getByTestId('image2d-provider-scenario');
    expect(scenario.textContent).toContain('NOT WIRED');
    expect(scenario.textContent).toContain('PBR TEXTURE SET');

    expect(screen.getByTestId('image2d-provider-leonardo').textContent).toContain('READY');
  });

  it('keeps submit off, with the reason, when NOTHING on the server can run', async () => {
    const fetchMock = mockFetch([QWEN_NO_KEY, SCENARIO_UNWIRED], null);
    render(<Image2DPanel />);

    await waitFor(() => expect(screen.getByTestId('image2d-submit-block').textContent)
      .toContain('No 2D provider can run on this server'));
    // The reasons are carried through, not summarised away.
    expect(screen.getByTestId('image2d-submit-block').textContent).toContain('QWEN_API_KEY');

    const submit = screen.getByTestId('image2d-submit');
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'a sword' } });
    fireEvent.click(submit); // forced click shares the button's gate
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // the capability GET only
  });

  it('says an unreachable capability check is unreachable, not "no providers"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch);
    render(<Image2DPanel />);
    await waitFor(() => expect(screen.getByTestId('image2d-submit-block').textContent)
      .toContain('Could not check which 2D providers'));
    expect(screen.getByTestId('image2d-submit').hasAttribute('disabled')).toBe(true);
  });

  it('asks for a prompt before it will spend anything', async () => {
    mockFetch([LEO_READY, QWEN_NO_KEY], 'leonardo');
    render(<Image2DPanel />);
    await waitFor(() => expect(screen.getByTestId('image2d-submit-block').textContent)
      .toContain('Describe the image first'));
  });
});

describe('Image2DPanel — the submit reaches the route and shows the real result', () => {
  it('POSTs the prompt and the chosen provider, then renders the served image', async () => {
    const fetchMock = mockFetch([LEO_READY, QWEN_NO_KEY], 'leonardo', () =>
      envelope({
        ok: true, providerId: 'leonardo', providerName: 'Leonardo',
        url: '/api/visual-gen/image/leonardo_1700000000000.jpg',
        name: 'leonardo_1700000000000.jpg', sourceUrl: 'https://cdn.leonardo/abc', durationMs: 12,
      }));
    render(<Image2DPanel />);
    await screen.findByTestId('image2d-provider-leonardo');

    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'a bronze shield' } });
    fireEvent.click(screen.getByTestId('image2d-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('/api/visual-gen/generate-2d');
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'a bronze shield', providerId: 'leonardo' });

    const img = await screen.findByTestId('image2d-image');
    expect(img.getAttribute('src')).toBe('/api/visual-gen/image/leonardo_1700000000000.jpg');
    expect(screen.getByTestId('image2d-provenance').textContent).toContain('leonardo_1700000000000.jpg');
    expect(screen.getByTestId('image2d-provenance').textContent).toContain('Leonardo');
  });

  it('shows the provider\'s own failure reason and renders no image', async () => {
    mockFetch([LEO_READY], 'leonardo', () => failure('Leonardo generation failed (401): invalid api key'));
    render(<Image2DPanel />);
    await screen.findByTestId('image2d-provider-leonardo');

    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'a bronze shield' } });
    fireEvent.click(screen.getByTestId('image2d-submit'));

    const err = await screen.findByTestId('image2d-error');
    expect(err.textContent).toContain('invalid api key');
    expect(screen.queryByTestId('image2d-image')).toBeNull();
    expect(screen.queryByTestId('image2d-result')).toBeNull();
  });

  it('renders no image placeholder when the route reports success without a url', async () => {
    // A "generated" result with nothing on disk must show nothing, never a stand-in.
    mockFetch([LEO_READY], 'leonardo', () => envelope({ ok: true, providerId: 'leonardo', providerName: 'Leonardo', durationMs: 3 }));
    render(<Image2DPanel />);
    await screen.findByTestId('image2d-provider-leonardo');
    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('image2d-submit'));

    await waitFor(() => expect(screen.getByTestId('image2d-submit').textContent).toContain('Generate image'));
    expect(screen.queryByTestId('image2d-image')).toBeNull();
  });
});
