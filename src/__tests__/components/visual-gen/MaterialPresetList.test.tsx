/**
 * The saved-preset list must never present a swallowed error as "no presets".
 * A failed load/save/delete renders the server's reason with a Retry that
 * re-runs the exact action that failed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MaterialPresetList } from '@/components/modules/visual-gen/material-lab/MaterialPresetList';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

type Row = { id: string; name: string; params: Record<string, unknown>; createdAt: string; updatedAt: string };

let table: Row[] = [];
let failWith: string | null = null;
let calls = 0;

function envelope(body: unknown) {
  return { json: async () => body } as Response;
}

beforeEach(() => {
  table = [];
  failWith = null;
  calls = 0;
  useMaterialStore.setState({ presets: [], presetsLoaded: false, presetsLoading: false, presetSeq: 0, activePresetId: null });
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    calls += 1;
    if (failWith) return envelope({ success: false, error: failWith });
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (method === 'GET') return envelope({ success: true, data: table });
    if (method === 'POST') {
      const row: Row = {
        id: String(body.id),
        name: String(body.name),
        params: body.params as Record<string, unknown>,
        createdAt: '2026-08-19 10:00:00',
        updatedAt: '2026-08-19 10:00:00',
      };
      table = [row, ...table];
      return envelope({ success: true, data: row });
    }
    if (method === 'DELETE') {
      table = table.filter((r) => r.id !== body.id);
      return envelope({ success: true, data: { deleted: true } });
    }
    return envelope({ success: false, error: 'unexpected' });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MaterialPresetList', () => {
  it('loads saved presets on mount and renders them', async () => {
    table = [{ id: 'p1', name: 'Brushed Steel', params: { baseColor: '#8a8a8a', metallic: 1, roughness: 0.3 }, createdAt: '', updatedAt: '' }];
    render(<MaterialPresetList />);
    expect(await screen.findByText('Brushed Steel')).toBeTruthy();
  });

  it('shows the server reason with a Retry instead of an empty list when the load fails', async () => {
    failWith = 'database is locked';
    render(<MaterialPresetList />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('database is locked');
    // The "no saved presets yet" reassurance must NOT be on screen — that copy
    // is reserved for a load that actually succeeded and found nothing.
    expect(screen.queryByText(/No saved presets yet/)).toBeNull();

    // Retry re-runs the failed load, and a now-healthy server clears the error.
    failWith = null;
    table = [{ id: 'p1', name: 'Recovered', params: { baseColor: '#101010' }, createdAt: '', updatedAt: '' }];
    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText('Recovered')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a failed save and keeps no phantom preset', async () => {
    render(<MaterialPresetList />);
    await screen.findByText(/No saved presets yet/);

    failWith = 'UNIQUE constraint failed: materials.id';
    fireEvent.change(screen.getByPlaceholderText('Name this material'), { target: { value: 'Gold' } });
    fireEvent.click(screen.getByText('Save'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('UNIQUE constraint failed');
    expect(screen.queryByText('Gold')).toBeNull();
    expect(useMaterialStore.getState().presets).toHaveLength(0);
  });

  it('saves a preset through the API and lists it', async () => {
    render(<MaterialPresetList />);
    await screen.findByText(/No saved presets yet/);
    const before = calls;

    fireEvent.change(screen.getByPlaceholderText('Name this material'), { target: { value: 'Obsidian' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Obsidian')).toBeTruthy();
    expect(calls).toBeGreaterThan(before); // it actually went to the server
    expect(table.map((r) => r.name)).toEqual(['Obsidian']);
  });

  it('a failed delete leaves the preset on screen and says why', async () => {
    table = [{ id: 'p1', name: 'Keep Me', params: { baseColor: '#222222' }, createdAt: '', updatedAt: '' }];
    render(<MaterialPresetList />);
    await screen.findByText('Keep Me');

    failWith = 'Material not found';
    fireEvent.click(screen.getByLabelText('Delete preset Keep Me'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Material not found'));
    expect(screen.getByText('Keep Me')).toBeTruthy();
  });
});
