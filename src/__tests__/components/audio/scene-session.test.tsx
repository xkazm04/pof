import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useCallback, useState } from 'react';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SceneDraft } from '@/lib/audio-scene-ops';
import type { AudioSceneDocument, AudioZone, SoundEmitter, UpdateAudioScenePayload } from '@/types/audio-scene';

/**
 * ONE scene edit session for every AudioView tab. The painter's op buffer used
 * to live inside PainterTab, so the rest of AudioView wrote the same scene
 * through other doors: a whole-zones-array writer built from `activeDoc` per
 * soundscape field, debounced fields that dropped their edit on unmount, and a
 * scene switch that stranded the painter's own ops. These cases drive the real
 * AudioView over an in-memory `useAudioScene` whose `commitDoc` can be held
 * (PUT in flight, no refetch yet) or rejected.
 */

type Mode = 'resolve' | 'hold' | 'reject';

const h = vi.hoisted(() => ({
  useAudioScene: null as null | (() => unknown),
  onComplete: {} as Record<string, ((success: boolean) => void) | undefined>,
  sendPrompt: {} as Record<string, (prompt: string) => void>,
}));

vi.mock('@/hooks/useAudioScene', () => ({ useAudioScene: () => h.useAudioScene!() }));

// Mirrors useModuleCLI's contract: the completion reads the LATEST render's
// `onComplete` (the real hook refreshes its ref every render).
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (s: boolean) => void }) => {
    h.onComplete[opts.sessionKey] = opts.onComplete;
    h.sendPrompt[opts.sessionKey] ??= vi.fn();
    return { isRunning: false, sendPrompt: h.sendPrompt[opts.sessionKey], execute: vi.fn() };
  },
}));
vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: () => ({ isRunning: false, sendPrompt: vi.fn(), activeItemId: null }),
}));
vi.mock('@/hooks/useModuleReviewCli', () => ({
  useModuleReviewCli: () => ({
    refetchKey: 0, lastCompletedId: null,
    checklistCli: { isRunning: false, sendPrompt: vi.fn(), activeItemId: null },
    isReviewing: false, isFixing: false,
    startReview: vi.fn(), handleFix: vi.fn(), handleSync: vi.fn(),
  }),
}));

import { AudioView } from '@/components/modules/content/audio/AudioView';
import { PainterTab } from '@/components/modules/content/audio/AudioView/PainterTab';

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'ambient', x: 400, y: 400, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

function doc(over: Partial<AudioSceneDocument> = {}): AudioSceneDocument {
  return {
    id: 1, name: 'Scene One', description: '', zones: [], emitters: [],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
    ...over,
  } as AudioSceneDocument;
}

/** The in-memory server behind the mocked useAudioScene. */
const srv = {
  docs: [] as AudioSceneDocument[],
  mode: 'resolve' as Mode,
  writes: [] as UpdateAudioScenePayload[],
  updates: [] as UpdateAudioScenePayload[],
};

function useFakeAudioScene() {
  const [docs, setDocs] = useState(srv.docs);
  const [activeDocId, setActiveDocId] = useState<number | null>(srv.docs[0]?.id ?? null);

  // useAudioScene.commitDoc: PUT, then refetch; rejects with the server's reason.
  const commitDoc = useCallback((payload: UpdateAudioScenePayload) => {
    srv.writes.push(structuredClone(payload));
    if (srv.mode === 'reject') return Promise.reject(new Error('Scene write rejected by the server'));
    if (srv.mode === 'hold') return new Promise<AudioSceneDocument>(() => {});
    srv.docs = srv.docs.map((d) => (d.id === payload.id ? { ...d, ...payload } : d));
    setDocs(srv.docs);
    return Promise.resolve(srv.docs.find((d) => d.id === payload.id)!);
  }, []);

  const updateDoc = useCallback(async (payload: UpdateAudioScenePayload) => {
    srv.updates.push(payload);
    return null;
  }, []);

  return {
    docs,
    summary: { totalScenes: docs.length, totalZones: 0, totalEmitters: 0, zonesByReverb: {}, emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 } },
    activeDoc: docs.find((d) => d.id === activeDocId) ?? null,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    setActiveDocId,
    createDoc: vi.fn(),
    updateDoc,
    commitDoc,
    deleteDoc: vi.fn(),
    refetch: vi.fn(),
  };
}
h.useAudioScene = useFakeAudioScene;

function typeInto(el: HTMLElement, text: string) {
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(el, { target: { value: text.slice(0, i) } });
  }
}

const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const settle = () => advance(UI_TIMEOUTS.textEditDebounce + 50);
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

const tab = (name: string) => screen.getByRole('tab', { name });
const sceneButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

function zoneBody(container: HTMLElement, id = 'z1'): SVGRectElement {
  return container.querySelector(`[data-zone-id="${id}"]`) as SVGRectElement;
}

/** Press on zone z1 (at 100,100), move by (dx, dy) in 10 frames, release. */
async function dragZoneBy(container: HTMLElement, dx: number, dy: number) {
  const body = zoneBody(container);
  const svg = body.ownerSVGElement!;
  fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
  for (let i = 1; i <= 10; i++) {
    fireEvent.mouseMove(svg, { clientX: 110 + (dx * i) / 10, clientY: 110 + (dy * i) / 10 });
  }
  await act(async () => { fireEvent.mouseUp(svg); });
}

const zoneIn = (w: UpdateAudioScenePayload, id: string) => w.zones?.find((z) => z.id === id);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  srv.mode = 'resolve';
  srv.writes = [];
  srv.updates = [];
  h.onComplete = {};
  h.sendPrompt = {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AudioView — one scene edit session across tabs', () => {
  it('case 1: two zone soundscapes typed in one debounce window land in ONE rebased write', async () => {
    srv.docs = [doc({ zones: [zone(), zone({ id: 'z2', name: 'Hall', x: 300 })] })];
    srv.mode = 'hold';
    render(<AudioView />);
    await click(tab('Soundscapes'));

    typeInto(screen.getByLabelText('Soundscape description for Cavern'), 'drip');
    typeInto(screen.getByLabelText('Soundscape description for Hall'), 'wind');
    await settle();

    const last = srv.writes[srv.writes.length - 1];
    expect(last.id).toBe(1);
    expect(zoneIn(last, 'z1')?.soundscapeDescription).toBe('drip');
    expect(zoneIn(last, 'z2')?.soundscapeDescription).toBe('wind');
  });

  it('case 2: a soundscape write after an unconfirmed drag carries the dragged geometry', async () => {
    srv.docs = [doc({ zones: [zone()] })];
    srv.mode = 'hold';
    const { container } = render(<AudioView />);

    await dragZoneBy(container, 200, -60);
    expect(srv.writes).toHaveLength(1);
    expect(zoneIn(srv.writes[0], 'z1')).toMatchObject({ x: 300, y: 40 });

    await click(tab('Soundscapes'));
    typeInto(screen.getByLabelText('Soundscape description for Cavern'), 'drip');
    await settle();

    const write = [...srv.writes].reverse().find((w) => zoneIn(w, 'z1')?.soundscapeDescription === 'drip');
    expect(write).toBeDefined();
    expect(zoneIn(write!, 'z1')).toMatchObject({ x: 300, y: 40 });
  });

  it('case 3: a tab switch inside the debounce window writes the description / setting instead of dropping it', async () => {
    srv.docs = [doc()];
    render(<AudioView />);

    await click(tab('Soundscapes'));
    typeInto(screen.getByLabelText('Scene description'), 'damp');
    await advance(100);
    await click(tab('Scene Painter'));
    await settle();

    const descWrites = srv.writes.filter((w) => 'description' in w);
    expect(descWrites).toHaveLength(1);
    expect(descWrites[0]).toMatchObject({ id: 1, description: 'damp' });

    await click(tab('Settings'));
    fireEvent.change(screen.getByRole('spinbutton', { name: /Sound Pool Size/i }), { target: { value: '40' } });
    await advance(100);
    await click(tab('Scene Painter'));
    await settle();

    const poolWrites = srv.writes.filter((w) => 'soundPoolSize' in w);
    expect(poolWrites).toHaveLength(1);
    expect(poolWrites[0]).toMatchObject({ id: 1, soundPoolSize: 40 });
  });

  it('case 4: a scene switch writes the pending panel edit to the scene it was made in', async () => {
    srv.docs = [doc({ emitters: [emitter()] }), doc({ id: 2, name: 'Scene Two' })];
    const { container } = render(<AudioView />);

    const body = container.querySelector('circle[r="10"]') as SVGCircleElement;
    fireEvent.mouseDown(body, { clientX: 400, clientY: 400 });
    await act(async () => { fireEvent.mouseUp(body.ownerSVGElement!); });
    typeInto(screen.getByLabelText('Emitter name'), 'Rain');
    expect(srv.writes).toHaveLength(0);

    await click(sceneButton('Scene Two'));
    await settle();

    const toScene1 = srv.writes.filter((w) => w.id === 1);
    expect(toScene1).toHaveLength(1);
    expect(toScene1[0].emitters?.find((e) => e.id === 'e1')?.name).toBe('Rain');
    expect(srv.writes.some((w) => w.id === 2 && w.emitters?.some((e) => e.id === 'e1'))).toBe(false);
    expect(heading()).toBe('Scene Two');
  });

  it('case 5: a failed write holds the scene switch until Retry or Discard', async () => {
    srv.docs = [doc({ zones: [zone()] }), doc({ id: 2, name: 'Scene Two' })];
    srv.mode = 'reject';
    const { container } = render(<AudioView />);

    await dragZoneBy(container, 50, 50);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    await click(sceneButton('Scene Two'));
    expect(heading()).toBe('Scene One');
    const notice = screen.getByRole('alert', { name: /unsaved scene change/i });
    expect(notice.textContent).toMatch(/Scene One/);
    expect(within(notice).getByRole('button', { name: /Retry/ })).toBeTruthy();

    const writesBefore = srv.writes.length;
    await click(within(notice).getByRole('button', { name: /Discard/ }));
    expect(heading()).toBe('Scene Two');
    expect(screen.queryByRole('alert', { name: /unsaved scene change/i })).toBeNull();
    expect(srv.writes).toHaveLength(writesBefore);
  });

  it('case 5b: Retry re-sends the held ops to the old scene, then switches', async () => {
    srv.docs = [doc({ zones: [zone()] }), doc({ id: 2, name: 'Scene Two' })];
    srv.mode = 'reject';
    const { container } = render(<AudioView />);

    await dragZoneBy(container, 50, 50);
    await click(sceneButton('Scene Two'));
    expect(heading()).toBe('Scene One');

    srv.mode = 'resolve';
    const notice = screen.getByRole('alert', { name: /unsaved scene change/i });
    await click(within(notice).getByRole('button', { name: /Retry/ }));

    const last = srv.writes[srv.writes.length - 1];
    expect(last.id).toBe(1);
    expect(zoneIn(last, 'z1')).toMatchObject({ x: 150, y: 150 });
    expect(heading()).toBe('Scene Two');
  });

  it('case 6: Generate Audio System prompts from the buffered scene, not the server copy', async () => {
    srv.docs = [doc({ zones: [zone()] })];
    render(<AudioView />);
    await click(tab('Soundscapes'));

    typeInto(screen.getByLabelText('Soundscape description for Cavern'), 'drip');
    await advance(100);
    await click(screen.getByRole('button', { name: /Generate Audio System/ }));

    const send = h.sendPrompt['audio-codegen'] as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('Soundscape: drip');
  });

  it('case 7: a CLI run completing after a scene switch stamps the scene it ran for', async () => {
    srv.docs = [doc({ zones: [zone()] }), doc({ id: 2, name: 'Scene Two' })];
    render(<AudioView />);

    await click(screen.getByRole('button', { name: /Generate Audio System/ }));
    await click(sceneButton('Scene Two'));
    expect(heading()).toBe('Scene Two');

    await act(async () => { h.onComplete['audio-codegen']?.(true); });
    expect(srv.updates).toHaveLength(1);
    expect(srv.updates[0].id).toBe(1);
    expect(srv.updates[0].lastGeneratedAt).toEqual(expect.any(String));
  });
});

describe('PainterTab without a session buffer [guard]', () => {
  function Standalone({ writes }: { writes: SceneDraft[] }) {
    const [activeDoc] = useState(doc({ zones: [zone()] }));
    const commitScene = useCallback(async (next: SceneDraft) => { writes.push(next); }, [writes]);
    const [z, setZ] = useState<string | null>(null);
    const [e, setE] = useState<string | null>(null);
    return (
      <PainterTab
        activeDoc={activeDoc}
        commitScene={commitScene}
        setSelectedZoneId={setZ}
        setSelectedEmitterId={setE}
        selectedZoneId={z}
        selectedEmitterId={e}
        handleGenerateZoneCode={vi.fn()}
        handleGenerateSoundscape={vi.fn()}
        audioCli={{ isRunning: false, sendPrompt: vi.fn() } as never}
      />
    );
  }

  it('case 8: keeps its own buffer: a 10-move drag = 0 writes until mouseup, then exactly 1', async () => {
    const writes: SceneDraft[] = [];
    const { container } = render(<Standalone writes={writes} />);
    const body = zoneBody(container);
    const svg = body.ownerSVGElement!;
    fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
    for (let i = 1; i <= 10; i++) fireEvent.mouseMove(svg, { clientX: 110 + i * 5, clientY: 110 + i * 5 });
    expect(writes).toHaveLength(0);
    await act(async () => { fireEvent.mouseUp(svg); });
    expect(writes).toHaveLength(1);
    expect(writes[0].zones[0].x).toBe(150);
  });
});
