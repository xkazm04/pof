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
