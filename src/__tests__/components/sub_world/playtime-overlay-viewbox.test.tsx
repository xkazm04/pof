import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PlaytimeTopologyOverlay } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeTopologyOverlay';
import { STATIC_WORLD, TOPOLOGY_NODES } from '@/components/modules/core-engine/sub_world/_shared/data';

afterEach(cleanup);

describe('PlaytimeTopologyOverlay viewBox', () => {
  it('contains every drawn node', () => {
    const { container } = render(<PlaytimeTopologyOverlay mode="all" onModeChange={() => {}} world={STATIC_WORLD} />);
    const svg = Array.from(container.querySelectorAll('svg')).find((s) => s.querySelectorAll('circle').length === TOPOLOGY_NODES.length)!;
    const [x, y, w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    for (const c of Array.from(svg.querySelectorAll('circle'))) {
      const cx = Number(c.getAttribute('cx'));
      const cy = Number(c.getAttribute('cy'));
      const r = Number(c.getAttribute('r'));
      expect(cx - r).toBeGreaterThanOrEqual(x);
      expect(cx + r).toBeLessThanOrEqual(x + w);
      expect(cy - r).toBeGreaterThanOrEqual(y);
      expect(cy + r).toBeLessThanOrEqual(y + h);
    }
  });
});
