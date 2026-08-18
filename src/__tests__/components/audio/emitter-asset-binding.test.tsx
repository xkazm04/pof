import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { SoundEmitter } from '@/types/audio-scene';

/**
 * An emitter's only tie to sound was a path the user hand-typed, while a library
 * of really-generated sets sat one tab away with no edge to the scene model.
 * These tests pin the binding: pick a set, the id is what persists, and the
 * picker states each set's REAL import status instead of implying one.
 */

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
    ...over,
  };
}

const SETS = [
  { id: 'set-a', name: 'Cave Drips', kind: 'sfx', eventKey: null, surface: null, loopable: false, createdAt: 1 },
  { id: 'set-b', name: 'Wind Gusts', kind: 'ambience', eventKey: null, surface: null, loopable: true, createdAt: 2 },
];
const ASSETS = [
  { id: 'a1', setId: 'set-a', filename: 'x.mp3' },
  { id: 'a2', setId: 'set-a', filename: 'y.mp3' },
];
const IMPORTS = {
  'Cave Drips': { id: 1, setName: 'Cave Drips', eventKey: null, surface: null, assetsImported: 2, cuePath: '/Game/Audio/CaveDrips/SC_CaveDrips', wiredEvent: null, createdAt: 1 },
};

/** Mock the two GETs the picker joins; `sets` lets a case empty the library. */
function mockLibrary({ sets = SETS, assets = ASSETS, bySet = IMPORTS } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const data = url.startsWith('/api/audio-gen')
      ? { sets, assets }
      : { bySet, latest: null, preflight: { ok: true } };
    return { json: async () => ({ success: true, data }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Let the picker's two fetches resolve. */
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

function renderPanel(em: SoundEmitter, onCommit = vi.fn().mockResolvedValue(undefined)) {
  render(<EmitterPropertyPanel emitter={em} onCommit={onCommit} accentColor={ACCENT_CYAN_LIGHT} />);
  return onCommit;
}

describe('EmitterPropertyPanel — library asset binding', () => {
  it('costs nothing until the user browses or a binding exists', () => {
    const fetchMock = mockLibrary();
    renderPanel(emitter());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('binds the emitter to a set id when one is picked', async () => {
    mockLibrary();
    const onCommit = renderPanel(emitter());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Browse/i })); });
    await flush();

    await act(async () => { fireEvent.click(screen.getByRole('option', { name: /Cave Drips/ })); });
    expect(onCommit).toHaveBeenCalledWith({ assetSetId: 'set-a' });
  });

  it('states each set’s real import status, imported or not', async () => {
    mockLibrary();
    renderPanel(emitter());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Browse/i })); });
    await flush();

    const imported = screen.getByRole('option', { name: /Cave Drips/ });
    expect(imported.textContent).toContain('/Game/Audio/CaveDrips/SC_CaveDrips');
    const fresh = screen.getByRole('option', { name: /Wind Gusts/ });
    expect(fresh.textContent).toContain('no UE import recorded');
    expect(fresh.textContent).not.toContain('/Game/Audio/');
  });

  it('names the bound set and its import path without browsing', async () => {
    mockLibrary();
    renderPanel(emitter({ assetSetId: 'set-a' }));
    await flush();

    expect(screen.getByText('Cave Drips')).toBeTruthy();
    expect(screen.getByText('/Game/Audio/CaveDrips/SC_CaveDrips')).toBeTruthy();
    expect(screen.getByText('2 clips')).toBeTruthy();
  });

  it('says a bound set that has vanished from the library has vanished', async () => {
    mockLibrary({ sets: [SETS[1]] });
    renderPanel(emitter({ assetSetId: 'set-a' }));
    await flush();

    expect(screen.getByText(/not in the library any more/)).toBeTruthy();
  });

  it('unbinds back to null', async () => {
    mockLibrary();
    const onCommit = renderPanel(emitter({ assetSetId: 'set-a' }));
    await flush();

    await act(async () => { fireEvent.click(screen.getByLabelText('Unbind asset set')); });
    expect(onCommit).toHaveBeenCalledWith({ assetSetId: null });
  });

  it('admits an empty library instead of showing an empty list', async () => {
    mockLibrary({ sets: [], assets: [] });
    renderPanel(emitter());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Browse/i })); });
    await flush();

    expect(screen.getByText(/The library is empty/)).toBeTruthy();
  });

  it('keeps the raw path box as a clearly-secondary manual override', () => {
    mockLibrary();
    renderPanel(emitter());
    expect(screen.getByLabelText('Sound cue path')).toBeTruthy();
    expect(screen.getByText(/Nothing is bound, so codegen uses this path/)).toBeTruthy();
  });
});
