import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { AdvancedTexturePanel } from '@/components/modules/visual-gen/material-lab/AdvancedTexturePanel';

// fetch is always mocked here: no test in this file may reach a paid provider.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AdvancedTexturePanel — Scenario generate guard', () => {
  it('cannot spend a paid Scenario call on an empty or blank prompt', () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    render(<AdvancedTexturePanel />);
    const generate = screen.getByTestId('scenario-generate') as HTMLButtonElement;

    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: '   ' } });
    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    expect(generate.disabled).toBe(false);
  });
});

describe('AdvancedTexturePanel — every tile reports failure through TileError', () => {
  const fill = (id: string, value: string) =>
    fireEvent.change(screen.getByTestId(id), { target: { value } });

  const tiles: Array<{ name: string; testId: string; prepare: () => void; run: string }> = [
    { name: 'scenario', testId: 'scenario-error', prepare: () => fill('scenario-prompt', 'stone'), run: 'scenario-generate' },
    { name: 'upscale', testId: 'upscale-error', prepare: () => fill('upscale-image-id', 'img-1'), run: 'upscale-run' },
    { name: 'unzoom', testId: 'unzoom-error', prepare: () => fill('unzoom-image-id', 'img-1'), run: 'unzoom-run' },
    {
      name: 'controlnet', testId: 'controlnet-error', run: 'controlnet-run',
      prepare: () => { fill('controlnet-prompt', 'icon'); fill('controlnet-image-id', 'init-1'); },
    },
    {
      name: 'inpaint', testId: 'inpaint-error', run: 'inpaint-run',
      prepare: () => { fill('inpaint-prompt', 'patch'); fill('inpaint-image-id', 'base-1'); },
    },
  ];

  it.each(tiles)('$name: a 429 is an announced, classified alert with a Retry that re-runs the call', async (tile) => {
    const fetchMock = mockFetch({ status: 429, body: { success: false, error: 'Leonardo generation failed (429): rate limit exceeded' } });
    render(<AdvancedTexturePanel />);
    tile.prepare();
    fireEvent.click(screen.getByTestId(tile.run));

    const node = await screen.findByTestId(tile.testId);
    expect(node.getAttribute('role')).toBe('alert');
    expect(node.getAttribute('data-error-kind')).toBe('rate-limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId(`${tile.testId}-retry`));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('AdvancedTexturePanel — every field has an accessible name', () => {
  it('no input, select or textarea relies on its placeholder alone', () => {
    mockFetch({ body: { success: true, data: {} } });
    const { container } = render(<AdvancedTexturePanel />);
    const fields = Array.from(container.querySelectorAll('input, select, textarea'));
    expect(fields.length).toBe(12);
    const unnamed = fields
      .filter((el) => !el.getAttribute('aria-label') && !(el.id && container.querySelector(`label[for="${el.id}"]`)))
      .map((el) => el.getAttribute('data-testid'));
    expect(unnamed).toEqual([]);
  });
});
