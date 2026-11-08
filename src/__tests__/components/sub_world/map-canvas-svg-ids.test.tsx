import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZoneMapCanvas } from '@/components/modules/core-engine/sub_world/map/MapCanvas';
import { ZONES } from '@/components/modules/core-engine/sub_world/_shared/data';

afterEach(cleanup);

describe('ZoneMapCanvas SVG defs', () => {
  it('two canvases on one page do not share def ids and reference their own', () => {
    const { container } = render(
      <div>
        <ZoneMapCanvas zones={ZONES} selectedZone={ZONES[0]} onSelectZone={() => {}} />
        <ZoneMapCanvas zones={ZONES} selectedZone={ZONES[1]} onSelectZone={() => {}} />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((e) => e.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      const grad = svg.querySelector('linearGradient')!.id;
      expect(svg.querySelector('line')!.getAttribute('stroke')).toBe(`url(#${grad})`);
    }
  });
});
