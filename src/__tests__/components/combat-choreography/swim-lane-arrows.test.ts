import { describe, it, expect } from 'vitest';
import { LANES, FLOW_ARROWS } from '@/components/modules/core-engine/sub_combat/_shared/data';
import {
  swimArrowGeometry, SWIM_NODE_MAP,
} from '@/components/modules/core-engine/sub_combat/flow/SwimLaneDiagram';

describe('SwimLaneDiagram arrow geometry', () => {
  it('places every lane feature at a finite coordinate', () => {
    const names = LANES.flatMap((l) => l.featureNames);
    for (const n of names) {
      const node = SWIM_NODE_MAP.get(n);
      expect(node, n).toBeDefined();
      expect(Number.isFinite(node!.cx), n).toBe(true);
    }
  });

  it('resolves both endpoints of every FLOW_ARROW (none silently dropped)', () => {
    const dropped = FLOW_ARROWS.filter((a) => !SWIM_NODE_MAP.has(a.from) || !SWIM_NODE_MAP.has(a.to));
    expect(dropped).toEqual([]);
  });

  it('points every arrowhead along the direction the edge arrives from', () => {
    const backwards: string[] = [];
    for (const a of FLOW_ARROWS) {
      const g = swimArrowGeometry(SWIM_NODE_MAP.get(a.from)!, SWIM_NODE_MAP.get(a.to)!);
      const [tip, b1, b2] = g.head;
      expect(tip).toEqual(g.end);
      // final tangent of the cubic: c2 -> end
      const tx = g.end.x - g.c2.x;
      const ty = g.end.y - g.c2.y;
      // head direction: base midpoint -> tip
      const hx = tip.x - (b1.x + b2.x) / 2;
      const hy = tip.y - (b1.y + b2.y) / 2;
      if (tx * hx + ty * hy <= 0) backwards.push(`${a.from} -> ${a.to}`);
    }
    expect(backwards).toEqual([]);
  });

  it('never ends an edge inside its source node', () => {
    for (const a of FLOW_ARROWS) {
      const from = SWIM_NODE_MAP.get(a.from)!;
      const g = swimArrowGeometry(from, SWIM_NODE_MAP.get(a.to)!);
      const insideSource = Math.abs(g.end.x - from.cx) < 60 && Math.abs(g.end.y - from.cy) < 12;
      expect(insideSource, `${a.from} -> ${a.to}`).toBe(false);
    }
  });
});
