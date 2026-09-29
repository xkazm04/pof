import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useCallback, useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { PainterTab } from '@/components/modules/content/audio/AudioView/PainterTab';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import type { AudioSceneDocument, AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * ONE scene edit buffer. The painter used to hold a whole-scene snapshot and
 * each property panel its own per-record buffer; neither could see the other,
 * and the panel's write was built from the server copy. So a drag whose write
 * failed was reverted by the next panel write, and the painter's Retry then
 * reverted that panel write in turn. These cases drive PainterTab over an
 * in-memory server (the same `{ id, zones, emitters }` payload `commitDoc` takes).
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'A', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e', name: 'Drip', type: 'ambient', x: 400, y: 400, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

function doc(): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [zone()], emitters: [emitter()],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
  } as AudioSceneDocument;
}

const noopCli = { isRunning: false, sendPrompt: vi.fn() } as unknown as never;

interface ServerLog {
  writes: SceneDraft[];
  server: AudioSceneDocument;
  /** The server accepts a write (PUT + refetch). */
  accept: (next: SceneDraft) => AudioSceneDocument;
}

function makeServer(): ServerLog {
  const log: ServerLog = {
    writes: [],
    server: doc(),
    accept: (next) => {
      log.server = { ...log.server, zones: next.zones, emitters: next.emitters };
      return log.server;
    },
  };
  return log;
}

/** PainterTab over an in-memory commitDoc; `rejectFirst` makes write 1 fail. */
function Harness({ log, rejectFirst, initialZone = null, initialEmitter = null }: {
  log: ServerLog; rejectFirst: boolean; initialZone?: string | null; initialEmitter?: string | null;
}) {
  const [activeDoc, setActiveDoc] = useState(log.server);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(initialZone);
  const [selectedEmitterId, setSelectedEmitterId] = useState<string | null>(initialEmitter);

  // Mirrors useAudioScene.commitDoc: PUT, then refetch; rejects when refused.
  const commitScene = useCallback(async (next: SceneDraft) => {
    log.writes.push(structuredClone(next));
    if (rejectFirst && log.writes.length === 1) throw new Error('Scene write rejected by the server');
    setActiveDoc(log.accept(next));
  }, [log, rejectFirst]);

  return (
    <PainterTab
      activeDoc={activeDoc}
      commitScene={commitScene}
      setSelectedZoneId={setSelectedZoneId}
      setSelectedEmitterId={setSelectedEmitterId}
      selectedZoneId={selectedZoneId}
      selectedEmitterId={selectedEmitterId}
      handleGenerateZoneCode={vi.fn()}
      handleGenerateSoundscape={vi.fn()}
      audioCli={noopCli}
    />
  );
}

function zoneBody(container: HTMLElement, id = 'A'): SVGRectElement {
  return container.querySelector(`[data-zone-id="${id}"]`) as SVGRectElement;
}

/** Press on zone A, N mousemoves of +5px each. Returns the canvas. */
function dragZone(container: HTMLElement, steps: number): SVGSVGElement {
  const body = zoneBody(container);
  const svg = body.ownerSVGElement!;
  fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
  for (let i = 1; i <= steps; i++) {
    fireEvent.mouseMove(svg, { clientX: 110 + i * 5, clientY: 110 + i * 5 });
  }
  return svg;
}

function typeInto(el: HTMLElement, text: string) {
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(el, { target: { value: text.slice(0, i) } });
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('PainterTab — one scene buffer, no lost update', () => {
  it('case 7: a failed drag and a later panel rename both reach the server in one write', async () => {
    const log = makeServer();
    const { container } = render(<Harness log={log} rejectFirst />);

    // Drag zone A by +50/+50; the mouseup write is refused.
    const svg = dragZone(container, 10);
    await act(async () => { fireEvent.mouseUp(svg); });
    expect(log.writes).toHaveLength(1);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(zoneBody(container).getAttribute('x')).toBe('150'); // still on the canvas

    // The drag selected A, so its panel is open. Rename it and let the pause fire.
    const name = screen.getByLabelText('Zone name') as HTMLInputElement;
    typeInto(name, 'Cave');
    await act(async () => { vi.advanceTimersByTime(UI_TIMEOUTS.textEditDebounce + 50); });

    expect(log.writes).toHaveLength(2);
    const written = log.writes[1].zones.find((z) => z.id === 'A')!;
    expect(written.name).toBe('Cave');
    expect(written.x).toBe(150);
    expect(written.y).toBe(150);

    const onServer = log.server.zones.find((z) => z.id === 'A')!;
    expect(onServer).toMatchObject({ name: 'Cave', x: 150, y: 150 });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PainterTab — the canvas renders the same buffer the panels write', () => {
  it('case 8 [guard half]: a 10-move drag performs 0 writes until mouseup, then exactly 1', async () => {
    const log = makeServer();
    const { container } = render(<Harness log={log} rejectFirst={false} />);

    const svg = dragZone(container, 10);
    expect(log.writes).toHaveLength(0);
    await act(async () => { fireEvent.mouseUp(svg); });
    expect(log.writes).toHaveLength(1);
    expect(log.writes[0].zones[0].x).toBe(150);
  });

  it('case 8: dragging the emitter Attenuation slider redraws the canvas circle with 0 writes', () => {
    const log = makeServer();
    const { container } = render(<Harness log={log} rejectFirst={false} initialEmitter="e" />);

    const slider = screen.getByLabelText('Attenuation') as HTMLInputElement;
    for (const v of ['100', '150', '220']) fireEvent.change(slider, { target: { value: v } });

    const circle = container.querySelector('circle[fill="url(#radar-glow)"]') as SVGCircleElement;
    expect(circle.getAttribute('r')).toBe('220');
    expect(log.writes).toHaveLength(0);
  });
});
