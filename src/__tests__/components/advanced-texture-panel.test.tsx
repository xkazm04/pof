import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { AdvancedTexturePanel } from '@/components/modules/visual-gen/material-lab/AdvancedTexturePanel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AdvancedTexturePanel — Scenario PBR tile', () => {
  it('posts the prompt to /api/scenario and renders the PBR thumbnails', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { albedoUrl: 'a.png', normalUrl: 'n.png', roughnessUrl: 'r.png' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    fireEvent.click(screen.getByTestId('scenario-generate'));

    await waitFor(() => expect(screen.getByTestId('pbr-albedo')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scenario');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ prompt: 'dungeon stone' });
  });

  it('shows a configure hint when SCENARIO_API_KEY is not configured', async () => {
    mockFetch({ status: 500, body: { success: false, error: 'SCENARIO_API_KEY not configured' } });
    render(<AdvancedTexturePanel />);
    fireEvent.click(screen.getByTestId('scenario-generate'));
    await waitFor(() => expect(screen.getByTestId('scenario-error').textContent).toMatch(/configure/i));
  });
});

describe('AdvancedTexturePanel — seam check', () => {
  const seamData = {
    albedoUrl: 'a.png',
    seam: {
      horizontal: { axis: 'left', delta: 0.3, seam: true },
      vertical: { axis: 'top', delta: 0.01, seam: false },
      hasSeam: true,
      threshold: 0.08,
      worstEdge: 'left edge',
    },
  };

  it('renders a seam warning badge + reroll button when the albedo has a seam', async () => {
    mockFetch({ body: { success: true, data: seamData } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    fireEvent.click(screen.getByTestId('scenario-generate'));

    await waitFor(() => expect(screen.getByTestId('scenario-seam-badge')).toBeTruthy());
    expect(screen.getByTestId('scenario-seam-badge').textContent).toMatch(/left edge/i);
    expect(screen.getByTestId('scenario-reroll')).toBeTruthy();
  });

  it('does not render the seam badge for a clean tile', async () => {
    mockFetch({ body: { success: true, data: { albedoUrl: 'a.png', seam: { ...seamData.seam, hasSeam: false, worstEdge: undefined } } } });
    render(<AdvancedTexturePanel />);
    fireEvent.click(screen.getByTestId('scenario-generate'));

    await waitFor(() => expect(screen.getByTestId('pbr-albedo')).toBeTruthy());
    expect(screen.queryByTestId('scenario-seam-badge')).toBeNull();
  });

  it('reroll re-posts to /api/scenario', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: seamData } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    fireEvent.click(screen.getByTestId('scenario-generate'));

    await waitFor(() => expect(screen.getByTestId('scenario-reroll')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scenario-reroll'));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/scenario');
  });
});

describe('AdvancedTexturePanel — Upscaler tile', () => {
  it('posts mode=upscale with the image id + style and shows the job id', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { upscaleJobId: 'up-1' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('upscale-image-id'), { target: { value: 'img-7' } });
    fireEvent.click(screen.getByTestId('upscale-run'));

    await waitFor(() => expect(screen.getByTestId('upscale-job').textContent).toContain('up-1'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/leonardo');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ mode: 'upscale', imageId: 'img-7', style: 'GENERAL' });
  });
});

describe('AdvancedTexturePanel — Unzoom tile', () => {
  it('posts mode=unzoom with the image id (+ optional prompt) and shows the job id', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { unzoomJobId: 'uz-1' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('unzoom-image-id'), { target: { value: 'img-3' } });
    fireEvent.change(screen.getByTestId('unzoom-prompt'), { target: { value: 'more floor' } });
    fireEvent.click(screen.getByTestId('unzoom-run'));

    await waitFor(() => expect(screen.getByTestId('unzoom-job').textContent).toContain('uz-1'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/leonardo');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ mode: 'unzoom', imageId: 'img-3', prompt: 'more floor' });
  });
});

describe('AdvancedTexturePanel — ControlNet tile', () => {
  it('posts mode=image with a controlnets[] opt and shows the result url', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { imageUrl: 'cn.png', generationId: 'g1' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('controlnet-prompt'), { target: { value: 'icon' } });
    fireEvent.change(screen.getByTestId('controlnet-image-id'), { target: { value: 'init-9' } });
    fireEvent.click(screen.getByTestId('controlnet-run'));

    await waitFor(() => expect(screen.getByTestId('controlnet-result')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/leonardo');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent).toMatchObject({ mode: 'image', prompt: 'icon' });
    expect(sent.opts.controlnets[0]).toMatchObject({ initImageId: 'init-9' });
  });
});

describe('AdvancedTexturePanel — Inpaint tile', () => {
  it('posts mode=image with an inpaint opt (base + mask) and shows the result url', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { imageUrl: 'ip.png', generationId: 'g2' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('inpaint-prompt'), { target: { value: 'patch wall' } });
    fireEvent.change(screen.getByTestId('inpaint-image-id'), { target: { value: 'base-1' } });
    fireEvent.change(screen.getByTestId('inpaint-mask-id'), { target: { value: 'mask-1' } });
    fireEvent.click(screen.getByTestId('inpaint-run'));

    await waitFor(() => expect(screen.getByTestId('inpaint-result')).toBeTruthy());
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent).toMatchObject({ mode: 'image', prompt: 'patch wall' });
    expect(sent.opts.inpaint).toMatchObject({ initImageId: 'base-1', maskImageId: 'mask-1' });
  });
});
