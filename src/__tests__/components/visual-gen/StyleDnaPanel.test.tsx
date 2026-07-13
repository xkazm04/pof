import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { StyleDnaPanel } from '@/components/modules/visual-gen/asset-forge/StyleDnaPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';

afterEach(cleanup);

const PROFILE: StyleDnaProfile = {
  id: 'dna-1',
  name: 'Alice gothic',
  dna: {
    palette: ['desaturated teal', 'rust orange'],
    materials: ['aged brass'],
    mood: ['whimsical-macabre'],
    render: ['painterly'],
    motifs: ['playing cards'],
  },
  sourceImageCount: 4,
  active: true,
  createdAt: '2026-07-13',
};

const envelope = (data: unknown) => ({
  ok: true,
  json: async () => ({ success: true, data }),
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  useForgeStore.setState({ activeStyleDna: null, applyStyleDna: true });
  fetchMock = vi.fn(async () => envelope({ active: null, profiles: [] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('StyleDnaPanel', () => {
  it('with no profiles it auto-expands and invites a first mood board, Distill disabled', async () => {
    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText(/drop 2–6 images/i)).toBeTruthy();
    const distill = screen.getByRole('button', { name: /distill style/i });
    expect(distill.hasAttribute('disabled')).toBe(true);
  });

  it('renders the active profile in the header and its DNA strip when expanded', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ active: PROFILE, profiles: [PROFILE] }));
    render(<StyleDnaPanel />);
    expect(await screen.findByText('Alice gothic')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /project style/i }));
    const strip = screen.getByTestId('dna-strip');
    expect(strip.textContent).toContain('desaturated teal');
    expect(strip.textContent).toContain('aged brass');
    expect(strip.textContent).toContain('playing cards');
  });

  it('the apply toggle flips the store flag generation prompts read', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ active: PROFILE, profiles: [PROFILE] }));
    render(<StyleDnaPanel />);
    const toggle = await screen.findByRole('button', { name: /applied to prompts/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(useForgeStore.getState().applyStyleDna).toBe(false);
    expect(screen.getByRole('button', { name: /^apply to prompts$/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('distills an uploaded board and promotes the returned profile to active', async () => {
    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const file = new File(['img-bytes'], 'board.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('mood-board-input'), { target: { files: [file] } });
    await screen.findByAltText('mood board image 1'); // FileReader finished

    fetchMock.mockResolvedValueOnce(envelope({ profile: PROFILE }));
    fireEvent.click(screen.getByRole('button', { name: /distill style from 1 image/i }));

    await waitFor(() => expect(useForgeStore.getState().activeStyleDna?.name).toBe('Alice gothic'));
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(post).toBeTruthy();
    const body = JSON.parse((post![1] as RequestInit).body as string) as { images: string[] };
    expect(body.images[0]).toMatch(/^data:image\/png;base64,/);
  });

  it('a failed distillation surfaces the server reason with a retry', async () => {
    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const file = new File(['img-bytes'], 'board.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('mood-board-input'), { target: { files: [file] } });
    await screen.findByAltText('mood board image 1');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ success: false, error: 'style distillation failed: QWEN_API_KEY not set' }),
    });
    fireEvent.click(screen.getByRole('button', { name: /distill style from 1 image/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('QWEN_API_KEY');
  });
});
