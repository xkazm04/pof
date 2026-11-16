import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMenuFlowDiagram } from '@/components/modules/content/ui-hud/MenuFlowDiagram/useMenuFlowDiagram';
import { NODE_W, NODE_H } from '@/components/modules/content/ui-hud/MenuFlowDiagram/constants';

/**
 * Screen nodes are drawn over the arrows, so an arrowhead whose tip lies inside a node
 * rectangle is hidden under it. Every route end must stop at (or just outside) the node
 * box, whatever direction it arrives from.
 */

afterEach(cleanup);

const inside = (p: { x: number; y: number }, box: { x: number; y: number }) =>
  p.x > box.x && p.x < box.x + NODE_W && p.y > box.y && p.y < box.y + NODE_H;

function ends(line: string) {
  const m = /^M(-?[\d.]+),(-?[\d.]+) L(-?[\d.]+),(-?[\d.]+)$/.exec(line);
  if (!m) throw new Error(`unparsed path ${line}`);
  return { from: { x: +m[1], y: +m[2] }, to: { x: +m[3], y: +m[4] } };
}

describe('menu flow arrow endpoints', () => {
  it('no default route end lies inside a node box', () => {
    const { result } = renderHook(() => useMenuFlowDiagram());
    const { screens, transitions, getNodeCenter, getArrowPath } = result.current;
    const byId = new Map(screens.map((s) => [s.id, s]));
    const hidden: string[] = [];
    for (const t of transitions) {
      const { line } = getArrowPath(getNodeCenter(t.fromId), getNodeCenter(t.toId), t.bidirectional);
      const { from, to } = ends(line);
      if (inside(to, byId.get(t.toId)!)) hidden.push(`${t.id}:head`);
      if (t.bidirectional && inside(from, byId.get(t.fromId)!)) hidden.push(`${t.id}:tail`);
    }
    expect(hidden).toEqual([]);
  });

  it('horizontal, vertical and diagonal routes all stop at the box edge', () => {
    const { result } = renderHook(() => useMenuFlowDiagram());
    const { getArrowPath } = result.current;
    const box = { x: 400, y: 300 };
    const c = { x: box.x + NODE_W / 2, y: box.y + NODE_H / 2 };
    for (const from of [{ x: c.x - 400, y: c.y }, { x: c.x, y: c.y - 300 }, { x: c.x - 300, y: c.y - 300 }]) {
      const { to } = ends(getArrowPath(from, c, false).line);
      expect(inside(to, box)).toBe(false);
      // and not absurdly far out: within 12px of the box
      const gap = Math.max(box.x - to.x, to.x - (box.x + NODE_W), box.y - to.y, to.y - (box.y + NODE_H));
      expect(gap).toBeLessThanOrEqual(12);
    }
  });
});
