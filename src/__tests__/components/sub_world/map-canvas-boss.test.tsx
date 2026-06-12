import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ZoneMapCanvas, type MapZone } from '@/components/modules/core-engine/sub_world/map/MapCanvas';

const zones: MapZone[] = [
  { id: 'hub', displayName: 'Hub', cx: 50, cy: 50, type: 'hub', status: 'active', connections: ['keep'] },
  { id: 'keep', displayName: 'Ruined Keep', cx: 85, cy: 50, type: 'boss', status: 'locked', connections: [] },
];

describe('ZoneMapCanvas boss zone positioning', () => {
  it('renders the boss as a percent-positioned rect sharing the canvas coordinate space (not a pixel-space polygon)', () => {
    const { container } = render(
      <ZoneMapCanvas zones={zones} selectedZone={zones[0]} onSelectZone={() => {}} />,
    );

    // The old boss used <polygon points="85,38 …"> in user-space pixels — it
    // must no longer exist.
    expect(container.querySelector('polygon')).toBeNull();

    // The boss diamond is a rect positioned with percent x/y at its zone center,
    // exactly like the boss label's percent coordinates — so the shape and its
    // label can no longer diverge.
    const bossRect = Array.from(container.querySelectorAll('rect')).find(
      (r) => r.getAttribute('x') === '85%' && r.getAttribute('y') === '50%',
    );
    expect(bossRect).toBeTruthy();
  });
});
