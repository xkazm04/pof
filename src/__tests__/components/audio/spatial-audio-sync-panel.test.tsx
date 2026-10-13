import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SpatialAudioGeneratorPanel } from '@/components/modules/content/audio/SpatialAudioGeneratorPanel';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioSceneDocument, LevelAudioSyncRow } from '@/types/audio-scene';

/**
 * Level -> audio writes only after the plan is on screen AND the operator
 * applies it; a hand-tuned room is overwritten only when its toggle is set.
 */

const SCENE: AudioSceneDocument = {
  id: 7, name: 'Crypt Mix', description: '', zones: [], emitters: [], globalReverbPreset: 'cave',
  soundPoolSize: 32, maxConcurrentSounds: 16, lastGeneratedAt: null, createdAt: '', updatedAt: '',
};

const ROWS: LevelAudioSyncRow[] = [
  { roomId: 'r1', roomName: 'Hall', zoneId: 'zone-room-r1', status: 'new', fields: [], keptEmitters: [] },
  { roomId: 'r2', roomName: 'Crypt', zoneId: 'zone-room-r2', status: 'kept', fields: ['reverbPreset'], keptEmitters: [] },
];

type Body = { action: string; overwrite?: string[] };

function mockApi() {
  const calls: Body[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String((init as RequestInit).body)) as Body;
    calls.push(body);
    const data = body.action === 'list-levels'
      ? [{ id: 1, name: 'Crypt Level', roomCount: 2, connectionCount: 1 }]
      : body.action === 'preview'
        ? {
          rows: ROWS, ops: [{ kind: 'addZone' }], summary: { new: 1, unchanged: 0, updated: 0, kept: 1, orphaned: 0 },
          suggestedGlobalReverb: 'large-hall', report: [], targetSceneId: 7,
        }
        : { audioScene: SCENE, report: [], rows: ROWS, summary: { new: 1, unchanged: 0, updated: 0, kept: 1, orphaned: 0 }, merged: true };
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });
  return calls;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SpatialAudioGeneratorPanel — preview, then explicit apply', () => {
  it('shows the plan with nothing written, and writes only on Apply with the chosen overwrites', async () => {
    const calls = mockApi();
    const onSceneCreated = vi.fn();
    render(<SpatialAudioGeneratorPanel activeDoc={SCENE} accentColor={ACCENT_CYAN_LIGHT} onSceneCreated={onSceneCreated} />);

    fireEvent.click(await screen.findByLabelText(/Sync into active scene/));
    expect(await screen.findByText(/\+1 new, 0 updated, 1 kept \(hand-tuned: reverbPreset\)/)).toBeTruthy();
    expect(calls.some((c) => c.action === 'generate')).toBe(false);

    fireEvent.click(screen.getByLabelText('overwrite'));
    await waitFor(() => expect(calls.some((c) => c.action === 'preview' && c.overwrite?.includes('r2'))).toBe(true));
    expect(calls.some((c) => c.action === 'generate')).toBe(false);

    const apply = await screen.findByRole('button', { name: /Apply 1 change to "Crypt Mix"/ });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    await waitFor(() => expect(onSceneCreated).toHaveBeenCalledTimes(1));
    const gen = calls.filter((c) => c.action === 'generate');
    expect(gen).toHaveLength(1);
    expect(gen[0].overwrite).toEqual(['r2']);
  });

  it('surfaces a load error with retry instead of the empty state when list-levels fails', async () => {
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as Body;
      if (body.action === 'list-levels') {
        attempts += 1;
        if (attempts === 1) {
          return new Response(JSON.stringify({ success: false, error: 'Level DB unavailable' }), { status: 500 });
        }
        return new Response(
          JSON.stringify({ success: true, data: [{ id: 1, name: 'Crypt Level', roomCount: 2, connectionCount: 1 }] }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            rows: ROWS, ops: [], summary: { new: 0, unchanged: 2, updated: 0, kept: 0, orphaned: 0 },
            suggestedGlobalReverb: 'cave', report: [], targetSceneId: null,
          },
        }),
        { status: 200 },
      );
    });

    render(<SpatialAudioGeneratorPanel activeDoc={SCENE} accentColor={ACCENT_CYAN_LIGHT} onSceneCreated={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Level DB unavailable');
    expect(screen.queryByText(/No level design documents found/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('Crypt Level')).toBeTruthy();
    expect(attempts).toBe(2);
  });
});

