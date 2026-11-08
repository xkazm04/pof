/**
 * What the streaming planner draws on its grid has to agree with the plan it draws.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZoneCell } from '@/components/modules/content/level-design/StreamingZonePlanner/ZoneCell';
import { CELL_SIZE } from '@/components/modules/content/level-design/StreamingZonePlanner/constants';
import { TransitionLines } from '@/components/modules/content/level-design/StreamingZonePlanner/TransitionLines';
import { TRANSITION_STYLES } from '@/components/modules/content/level-design/StreamingZonePlanner/constants';
import type { TransitionLine } from '@/components/modules/content/level-design/StreamingZonePlanner/types';
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

const LINE: TransitionLine = {
  id: 't', fromId: 'a', toId: 'b', style: 'seamless', triggerType: 'proximity', condition: '',
  x1: 0, y1: 0, x2: 72, y2: 0, fromName: 'Town', toName: 'Forest',
};

describe('TransitionLines', () => {
  it.each(Object.keys(TRANSITION_STYLES) as TransitionLine['style'][])('%s draws in the colour the list names it', (style) => {
    const { container } = render(<svg><TransitionLines lines={[{ ...LINE, style }]} deleteTransition={() => {}} /></svg>);
    expect(container.querySelector('line')!.getAttribute('stroke')).toBe(TRANSITION_STYLES[style].color);
  });
});

describe('TransitionLines condition badge', () => {
  const CONDITION = 'Collect 3 Rune Fragments From The Deep';

  it('a long condition is upper-cased like a short one, and the badge wraps the text it shows', () => {
    const { container } = render(<svg><TransitionLines lines={[{ ...LINE, condition: CONDITION }]} deleteTransition={() => {}} /></svg>);
    const text = container.querySelector('text')!.textContent!;
    expect(text).toBe(text.toUpperCase());
    expect(text.length).toBeLessThan(CONDITION.length);
    const width = Number(container.querySelector('rect')!.getAttribute('width'));
    expect(width).toBeLessThan(CONDITION.length * 6);
  });
});
