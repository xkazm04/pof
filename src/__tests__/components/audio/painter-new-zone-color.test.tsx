import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { NEW_ZONE_PALETTE } from '@/components/modules/content/audio/AudioScenePainter/constants';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import { contrastRatio, WCAG_AA_NON_TEXT } from '@/lib/contrast';

/** The painter's surface (`--surface-deep`, read from the theme so it cannot drift). */
const SURFACE_DEEP = /--surface-deep:\s*(#[0-9a-fA-F]{6})/.exec(
  readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf-8'),
)![1];

afterEach(cleanup);

async function drawZones(count: number): Promise<string[]> {
  const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
  const scene: SceneDraft = { zones: [], emitters: [] };
  const { rerender } = render(
    <AudioScenePainter zones={scene.zones} emitters={scene.emitters} onUpdateZones={vi.fn()}
      onUpdateEmitters={vi.fn()} onCommit={onCommit} onSelectZone={vi.fn()} onSelectEmitter={vi.fn()}
      selectedZoneId={null} selectedEmitterId={null} accentColor={ACCENT_CYAN_LIGHT} />,
  );
  for (let i = 0; i < count; i++) {
    fireEvent.click(screen.getByText('VOL_RECT'));
    const svg = document.querySelector('svg.touch-none-canvas') as SVGSVGElement;
    fireEvent.mouseDown(svg, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(svg, { clientX: 110, clientY: 90 });
    await act(async () => { fireEvent.mouseUp(svg); });
    // Round-trip the server copy so the next zone sees the previous ones.
    const zones = onCommit.mock.calls[onCommit.mock.calls.length - 1][0].zones;
    rerender(
      <AudioScenePainter zones={zones} emitters={[]} onUpdateZones={vi.fn()}
        onUpdateEmitters={vi.fn()} onCommit={onCommit} onSelectZone={vi.fn()} onSelectEmitter={vi.fn()}
        selectedZoneId={null} selectedEmitterId={null} accentColor={ACCENT_CYAN_LIGHT} />,
    );
  }
  return onCommit.mock.calls[onCommit.mock.calls.length - 1][0].zones.map((z) => z.color);
}

describe('new zone colors', () => {
  it('the first drawn zone is a real accent hue, not the neutral "no preset" token', async () => {
    const [first] = await drawZones(1);
    expect(first.startsWith('var(')).toBe(false);
  });

  it('every palette hue is a concrete color that is visible on the painter surface', () => {
    expect(NEW_ZONE_PALETTE.length).toBeGreaterThanOrEqual(8);
    for (const c of NEW_ZONE_PALETTE) {
      expect(c.startsWith('var(')).toBe(false);
      expect(contrastRatio(c, SURFACE_DEEP)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
  });

  it('colors cycle through the palette in order and stay distinct within one cycle', async () => {
    const colors = await drawZones(3);
    expect(colors).toEqual(NEW_ZONE_PALETTE.slice(0, 3));
  });
});
