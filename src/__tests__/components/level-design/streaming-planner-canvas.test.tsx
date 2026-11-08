/**
 * What the streaming planner draws on its grid has to agree with the plan it draws.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZoneCell } from '@/components/modules/content/level-design/StreamingZonePlanner/ZoneCell';
import { CELL_SIZE } from '@/components/modules/content/level-design/StreamingZonePlanner/constants';
import type { StreamingZone } from '@/components/modules/content/level-design/StreamingZonePlanner/types';

afterEach(cleanup);

const ZONE: StreamingZone = {
  id: 'z', name: 'Town', type: 'town', gridX: 2, gridY: 3, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1,
};

describe('ZoneCell preload ring', () => {
  it.each([1, 2])('radius %i is the square of cells centred on the zone', (preloadRadius) => {
    const { container } = render(
      <svg><ZoneCell zone={{ ...ZONE, preloadRadius }} selectedZoneId="z" linkingFrom={null} paintType={null} handleCellClick={() => {}} /></svg>,
    );
    const ring = container.querySelector('rect[stroke-dasharray="8,8"]')!;
    const x = Number(ring.getAttribute('x'));
    const y = Number(ring.getAttribute('y'));
    const size = Number(ring.getAttribute('width'));
    expect(x + size / 2).toBe(ZONE.gridX * CELL_SIZE + CELL_SIZE / 2);
    expect(y + size / 2).toBe(ZONE.gridY * CELL_SIZE + CELL_SIZE / 2);
    expect(size).toBe((preloadRadius * 2 + 1) * CELL_SIZE - 8);
  });
});
