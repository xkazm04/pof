import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MaterialPresetList } from '@/components/modules/visual-gen/material-lab/MaterialPresetList';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

// eslint-disable-next-line no-restricted-syntax -- a PBR base colour (material data), not a UI colour
const PARAMS = { baseColor: '#808080', metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1 };
let deletes = 0;
let release: () => void = () => {};

beforeEach(() => {
  deletes = 0;
  useMaterialStore.setState({
    presets: [{ id: 'p1', name: 'Steel', params: PARAMS, createdAt: '' }],
    presetsLoaded: true,
    presetsLoading: false,
    activePresetId: null,
  });
  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') deletes += 1;
    // Hold the response open so the second click lands while the first is in flight.
    return new Promise((resolve) => {
      release = () => resolve({ json: async () => ({ success: true, data: { deleted: true } }) } as Response);
    });
  });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('MaterialPresetList — one action at a time', () => {
  it('a second Delete while the first is in flight sends nothing', async () => {
    render(<MaterialPresetList />);
    const del = screen.getByRole('button', { name: 'Delete preset Steel' }) as HTMLButtonElement;
    fireEvent.click(del);
    expect(del.disabled).toBe(true);
    fireEvent.click(del);
    expect(deletes).toBe(1);
    await act(async () => { release(); });
  });
});
