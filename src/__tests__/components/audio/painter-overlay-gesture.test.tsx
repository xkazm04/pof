import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone } from '@/types/audio-scene';

/**
 * The canvas used to end every gesture on svg mouseleave, and the toolbar, minimap
 * and zoom cluster overlay the svg inside the same container, so crossing any of
 * them dropped a drag/resize/draw. jsdom has no hit testing, so "pointer enters an
 * overlay" is simulated as: mouseleave on the svg, then moves/up on the overlay.
 */

const zone: AudioZone = {
  id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
  soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
  reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
  occlusionMode: 'medium', priority: 5, color: '',
};

function setup(selectedZoneId: string | null = null) {
  const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
  const { container } = render(
    <AudioScenePainter
      zones={[zone]} emitters={[]} onUpdateZones={vi.fn()} onUpdateEmitters={vi.fn()}
      onCommit={onCommit} onSelectZone={vi.fn()} onSelectEmitter={vi.fn()}
      selectedZoneId={selectedZoneId} selectedEmitterId={null} accentColor={ACCENT_CYAN_LIGHT}
    />,
  );
  const body = container.querySelector('[data-zone-id="z1"]') as SVGRectElement;
  return { container, onCommit, body, svg: body.ownerSVGElement! };
}

const OVERLAYS: Array<[string, () => HTMLElement]> = [
  ['toolbar', () => screen.getByText('SELECT')],
  ['zoom cluster', () => screen.getByRole('button', { name: 'Zoom in' })],
  ['minimap', () => screen.getByLabelText(/Scene minimap/) as unknown as HTMLElement],
];

afterEach(cleanup);

describe('AudioScenePainter - gestures survive crossing an in-canvas overlay', () => {
  it.each(OVERLAYS)('a zone drag keeps following the pointer over the %s', async (_n, pick) => {
    const { onCommit, body, svg } = setup();
    fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
    fireEvent.mouseMove(svg, { clientX: 120, clientY: 120 });
    fireEvent.mouseLeave(svg);
    const overlay = pick();
    fireEvent.mouseMove(overlay, { clientX: 150, clientY: 150 });
    expect(onCommit).not.toHaveBeenCalled(); // leaving the svg is not a release
    expect(body.getAttribute('x')).toBe('140');
    await act(async () => { fireEvent.mouseUp(overlay); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].zones[0].x).toBe(140);
  });

  it('a resize keeps following the pointer over an overlay', async () => {
    const { container, onCommit, svg } = setup('z1');
    const handle = Array.from(container.querySelectorAll('rect')).find(
      (r) => r.getAttribute('fill') === 'transparent' && r.getAttribute('width') === '16',
    )!;
    fireEvent.mouseDown(handle, { clientX: 212, clientY: 172 });
    fireEvent.mouseMove(svg, { clientX: 222, clientY: 182 });
    fireEvent.mouseLeave(svg);
    const overlay = screen.getByRole('button', { name: 'Zoom in' });
    fireEvent.mouseMove(overlay, { clientX: 252, clientY: 212 });
    await act(async () => { fireEvent.mouseUp(overlay); });
    expect(onCommit.mock.calls[0][0].zones[0].width).toBe(160);
  });

  it('a drawn zone keeps growing over an overlay and is added on release there', async () => {
    const { onCommit, svg } = setup();
    fireEvent.click(screen.getByText('VOL_RECT'));
    fireEvent.mouseDown(svg, { clientX: 300, clientY: 300 });
    fireEvent.mouseMove(svg, { clientX: 320, clientY: 320 });
    fireEvent.mouseLeave(svg);
    const overlay = screen.getByRole('button', { name: 'Zoom in' });
    fireEvent.mouseMove(overlay, { clientX: 380, clientY: 360 });
    await act(async () => { fireEvent.mouseUp(overlay); });
    const added = onCommit.mock.calls[0][0].zones.find((z) => z.id !== 'z1')!;
    expect([added.width, added.height]).toEqual([80, 60]);
  });

  it('a press released outside the painter still ends the gesture exactly once', async () => {
    const { onCommit, body, svg } = setup();
    fireEvent.mouseDown(body, { clientX: 110, clientY: 110 });
    fireEvent.mouseMove(svg, { clientX: 130, clientY: 130 });
    await act(async () => { fireEvent.mouseUp(document.body); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.mouseUp(document.body); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
