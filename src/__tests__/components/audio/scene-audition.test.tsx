import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { render, renderHook, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { SuspendContext } from '@/hooks/useSuspend';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { useSceneAudition } from '@/components/modules/content/audio/AudioScenePainter/useSceneAudition';
import { auditionMix, type AuditionLibrary } from '@/lib/audio-scene-audition';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { SoundEmitter } from '@/types/audio-scene';

/**
 * LISTEN mode, the live half: a Web Audio graph over the project's real clips.
 * It may only GET (paid generation is a POST to /api/audio-gen), it plays only
 * after an explicit Play, and it must go silent when the keep-alive LRU hides
 * the module (SuspendContext) — and stay silent until Play is clicked again.
 */

class FakeParam {
  value = 1;
  setTargetAtTime = vi.fn((v: number) => { this.value = v; });
}
function node() { return { connect: vi.fn(), disconnect: vi.fn() }; }

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  sources: Array<ReturnType<typeof node> & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  gains: Array<{ gain: FakeParam }> = [];
  filters: Array<{ frequency: FakeParam }> = [];
  close = vi.fn(async () => { this.state = 'closed'; });
  constructor() { FakeAudioContext.instances.push(this); }
  decodeAudioData = vi.fn(async () => ({ duration: 1 }));
  createBufferSource() {
    const s = { ...node(), buffer: null, loop: false, start: vi.fn(), stop: vi.fn() };
    this.sources.push(s);
    return s;
  }
  createGain() { const g = { ...node(), gain: new FakeParam() }; this.gains.push(g); return g; }
  createBiquadFilter() { const f = { ...node(), type: '', frequency: new FakeParam() }; this.filters.push(f); return f; }
  createStereoPanner() { return { ...node(), pan: new FakeParam() }; }
  createConvolver() { return { ...node(), buffer: null }; }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (c: number) => data[c] };
  }
}

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'loop', x: 100, y: 100, soundCueRef: '', assetSetId: 's1',
    attenuationRadius: 200, volumeMultiplier: 1, pitchMin: 1, pitchMax: 1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

const LIB: AuditionLibrary = { s1: [{ relPath: 'sets/s1/drip.mp3', favorite: true }] };

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  fetchSpy = vi.fn(async (url: string) => {
    if (url.startsWith('/api/audio-gen')) {
      return { ok: true, json: async () => ({ success: true, data: {
        sets: [{ id: 's1', name: 'Drips', kind: 'ambience' }],
        assets: [{ id: 'a1', setId: 's1', relPath: 'sets/s1/drip.mp3', favorite: true }],
      } }) };
    }
    if (url.startsWith('/api/audio/import-result')) {
      return { ok: true, json: async () => ({ success: true, data: { bySet: {} } }) };
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function onlyGets() {
  for (const [url, init] of fetchSpy.mock.calls as Array<[string, RequestInit | undefined]>) {
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    expect(url).toMatch(/^\/api\/(audio-asset|audio-gen|audio\/import-result)/);
  }
}

describe('useSceneAudition — [guard] case 6: GET-only, in-place updates, suspend stops, one close', () => {
  it('moves update nodes in place; hiding the module stops it until Play; stop + unmount close once', async () => {
    const scene = { zones: [], emitters: [emitter()] };
    let suspended = false;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SuspendContext.Provider, { value: suspended }, children);
    const { result, rerender, unmount } = renderHook(
      ({ x }: { x: number }) => useSceneAudition(auditionMix(scene, { x, y: 100 }, LIB)),
      { wrapper, initialProps: { x: 100 } },
    );

    expect(FakeAudioContext.instances).toHaveLength(0); // nothing before Play
    await act(async () => { await result.current.play(); });
    const ctx = FakeAudioContext.instances[0];
    await waitFor(() => expect(ctx.sources).toHaveLength(1));
    expect(result.current.playing).toBe(true);

    for (const x of [120, 140, 160, 180, 200]) rerender({ x });
    await act(async () => {});
    expect(ctx.sources).toHaveLength(1); // no new source per move
    expect(ctx.gains.some((g) => g.gain.setTargetAtTime.mock.calls.length >= 5)).toBe(true);
    expect(ctx.filters[0].frequency.setTargetAtTime).toHaveBeenCalled();
    onlyGets();
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/audio-asset'))).toHaveLength(1);

    // The keep-alive LRU hides the module: audio stops.
    suspended = true;
    rerender({ x: 120 });
    await act(async () => {});
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(result.current.playing).toBe(false);

    // Shown again: still silent — no new context until Play.
    suspended = false;
    rerender({ x: 120 });
    await act(async () => {});
    expect(result.current.playing).toBe(false);
    expect(FakeAudioContext.instances).toHaveLength(1);

    await act(async () => { await result.current.play(); });
    const ctx2 = FakeAudioContext.instances[1];
    expect(ctx2).toBeDefined();
    act(() => result.current.stop());
    unmount();
    expect(ctx2.close).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    onlyGets();
  });
});

describe('painter LISTEN mode — case 7', () => {
  it('places the puck, lists heard/not-heard rows, selects on click, plays only on Play', async () => {
    const onSelectEmitter = vi.fn();
    const { container } = render(
      <AudioScenePainter
        zones={[]}
        emitters={[emitter(), emitter({ id: 'e2', name: 'Torch 2', assetSetId: null, x: 160, y: 120 })]}
        onUpdateZones={vi.fn()}
        onUpdateEmitters={vi.fn()}
        onSelectZone={vi.fn()}
        onSelectEmitter={onSelectEmitter}
        selectedZoneId={null}
        selectedEmitterId={null}
        accentColor={ACCENT_CYAN_LIGHT}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /LISTEN/ }));
    const svg = container.querySelector('svg.touch-none-canvas') as SVGSVGElement;
    fireEvent.mouseDown(svg, { clientX: 150, clientY: 110 });
    fireEvent.mouseUp(svg);

    const puck = await screen.findByTestId('listener-puck');
    expect(puck.getAttribute('transform')).toBe('translate(150,110)');

    const heard = await screen.findByTestId('audition-heard-e1');
    expect(heard.textContent).toMatch(/Drip/);
    expect(heard.textContent).toMatch(/-?\d+ dB/);
    const silent = screen.getByTestId('audition-silent-e2');
    expect(silent.textContent).toMatch(/Torch 2/);
    expect(silent.textContent).toMatch(/unbound/);
    fireEvent.click(silent);
    expect(onSelectEmitter).toHaveBeenCalledWith('e2');

    expect(FakeAudioContext.instances).toHaveLength(0); // silent until Play
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play' })); });
    expect(FakeAudioContext.instances).toHaveLength(1);
    onlyGets();
  });
});
