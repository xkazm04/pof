import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * The painter used to issue one network write PLUS a full refetch on EVERY
 * mousemove of a drag/resize. These tests pin the replacement contract:
 * a gesture is buffered locally and commits exactly once, on mouseup.
 */

function rectZone(over: Partial<AudioZone> = {}): AudioZone {
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
    id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
    ...over,
  };
}

interface Harness {
  onCommit?: (next: SceneDraft) => Promise<unknown>;
  selectedZoneId?: string | null;
}

function renderPainter({ onCommit, selectedZoneId = null }: Harness = {}) {
  const onUpdateZones = vi.fn();
  const onUpdateEmitters = vi.fn();
  const props = {
    zones: [rectZone()],
    emitters: [emitter()],
    onUpdateZones,
    onUpdateEmitters,
    ...(onCommit ? { onCommit } : {}),
    onSelectZone: vi.fn(),
    onSelectEmitter: vi.fn(),
    selectedZoneId,
    selectedEmitterId: null,
    accentColor: ACCENT_CYAN_LIGHT,
  };
  const view = render(<AudioScenePainter {...props} />);
  return { ...view, onUpdateZones, onUpdateEmitters };
}

/** The zone's own body rect (the draggable one), addressed by its data hook. */
function zoneBody(container: HTMLElement, id = 'z1'): SVGRectElement {
  return container.querySelector(`[data-zone-id="${id}"]`) as SVGRectElement;
}
function canvas(container: HTMLElement): SVGSVGElement {
  return zoneBody(container).ownerSVGElement!;
}
/** Simulate a real drag: press, N mousemoves, release. */
function drag(container: HTMLElement, steps: number) {
  const body = zoneBody(container);
  const svg = canvas(container);
  fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
  for (let i = 1; i <= steps; i++) {
    fireEvent.mouseMove(svg, { clientX: 110 + i * 5, clientY: 110 + i * 5 });
  }
  return svg;
}

afterEach(cleanup);

describe('AudioScenePainter — commit on mouseup', () => {
  it('a 10-move drag performs ZERO writes until mouseup, then exactly one', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit });

    const svg = drag(container, 10);
    expect(onCommit).toHaveBeenCalledTimes(0); // ← was 10 (one per mousemove)

    await act(async () => { fireEvent.mouseUp(svg); });
    expect(onCommit).toHaveBeenCalledTimes(1);

    const committed = onCommit.mock.calls[0][0];
    expect(committed.zones[0].x).toBe(150); // 100 + 10 steps × 5px
    expect(committed.zones[0].y).toBe(150);
  });

  it('shows the drag live on the canvas while writing nothing', () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit });

    drag(container, 4);
    // The optimistic buffer is what renders — no round-trip needed to see the move.
    expect(zoneBody(container).getAttribute('x')).toBe('120');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a resize gesture likewise writes once, on mouseup', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit, selectedZoneId: 'z1' });

    // The se-resize handle is the transparent 16×16 rect at the zone's SE corner.
    const handle = Array.from(container.querySelectorAll('rect')).find(
      (r) => r.getAttribute('fill') === 'transparent' && r.getAttribute('width') === '16',
    )!;
    const svg = canvas(container);
    fireEvent.mouseDown(handle, { clientX: 212, clientY: 172 });
    for (let i = 1; i <= 8; i++) {
      fireEvent.mouseMove(svg, { clientX: 212 + i * 4, clientY: 172 + i * 4 });
    }
    expect(onCommit).toHaveBeenCalledTimes(0);

    await act(async () => { fireEvent.mouseUp(svg); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].zones[0].width).toBe(152); // 120 + 8×4
  });

  it('a mouseup that follows no movement writes nothing at all', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit });
    const body = zoneBody(container);
    const svg = canvas(container);
    fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
    await act(async () => { fireEvent.mouseUp(svg); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('deleting a zone costs ONE write carrying both zones and emitters', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit, selectedZoneId: 'z1' });

    const del = Array.from(container.querySelectorAll('g')).find(
      (g) => g.textContent === '×',
    )!;
    await act(async () => { fireEvent.click(del); });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    expect(next.zones).toHaveLength(0);
    expect(next.emitters[0].zoneId).toBeNull(); // unlinked in the same write
  });

  it('falls back to onUpdateZones when no onCommit is supplied — still once, on mouseup', async () => {
    const { container, onUpdateZones, onUpdateEmitters } = renderPainter();
    const svg = drag(container, 6);
    expect(onUpdateZones).toHaveBeenCalledTimes(0);

    await act(async () => { fireEvent.mouseUp(svg); });
    expect(onUpdateZones).toHaveBeenCalledTimes(1);
    // Only the half that changed is written.
    expect(onUpdateEmitters).toHaveBeenCalledTimes(0);
  });
});

describe('AudioScenePainter — gesture state survives the commit', () => {
  it('keeps zoom and stays mounted across a commit round-trip', async () => {
    let release!: () => void;
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockImplementation(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    const { container } = renderPainter({ onCommit });

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeTruthy();

    const svg = drag(container, 3);
    fireEvent.mouseUp(svg);

    // In flight: the canvas is still here, still at 120%, still showing the move.
    expect(screen.getByRole('application')).toBeTruthy();
    expect(screen.getByText('120%')).toBeTruthy();

    await act(async () => { release(); });

    expect(screen.getByRole('application')).toBeTruthy();
    expect(screen.getByText('120%')).toBeTruthy();
  });
});

describe('AudioScenePainter — a failed commit is visible and non-destructive', () => {
  it('surfaces the reason, keeps the buffer, and retries it', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('Scene write rejected by the server'))
      .mockResolvedValue(undefined);
    const { container } = renderPainter({ onCommit });

    const svg = drag(container, 10);
    await act(async () => { fireEvent.mouseUp(svg); });

    // Visible, with the server's own reason.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Scene write rejected by the server');
    expect(alert.textContent).toContain('still on the canvas');

    // The buffer is NOT lost: the canvas still shows where the user dropped it,
    // even though the props still say x=100.
    expect(zoneBody(container).getAttribute('x')).toBe('150');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    });

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit.mock.calls[1][0].zones[0].x).toBe(150); // the same buffer
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dismissing the banner keeps the edit on the canvas', async () => {
    const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>()
      .mockRejectedValue(new Error('offline'));
    const { container } = renderPainter({ onCommit });

    const svg = drag(container, 2);
    await act(async () => { fireEvent.mouseUp(svg); });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss save error' }));
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(zoneBody(container).getAttribute('x')).toBe('110');
  });
});
