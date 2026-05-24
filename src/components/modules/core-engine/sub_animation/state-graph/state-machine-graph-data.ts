import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { ACCENT, STATE_GROUPS, STATE_NODES } from '../_shared/data';

/* ── Module-scope graph data for SVG visualization ────────────────────────── */

export const STATE_TO_GROUP_MAP = (() => {
  const map = new Map<string, string>();
  for (const g of STATE_GROUPS) for (const s of g.states) map.set(s, g.group);
  return map;
})();

function groupNodeColor(group: string): string {
  switch (group) {
    case 'Movement': return STATUS_SUCCESS;
    case 'Combat': return STATUS_ERROR;
    case 'Reaction': return STATUS_WARNING;
    case 'Ability': return ACCENT;
    case 'Social': return ACCENT_EMERALD;
    case 'Traversal': return ACCENT_CYAN;
    default: return ACCENT;
  }
}

export const GN_W = 130;
export const GN_H = 48;

export interface GraphNode { group: string; cx: number; cy: number; color: string; stateCount: number }
export interface GraphEdge { from: string; to: string; count: number }

export const GRAPH_NODES: GraphNode[] = STATE_GROUPS.map((g, i) => ({
  group: g.group,
  cx: 100 + (i % 3) * 200,
  cy: 55 + Math.floor(i / 3) * 100,
  color: groupNodeColor(g.group),
  stateCount: g.states.length,
}));

export const GRAPH_NODE_MAP = new Map(GRAPH_NODES.map(n => [n.group, n]));

export const GRAPH_EDGES: GraphEdge[] = (() => {
  const map = new Map<string, number>();
  for (const node of STATE_NODES) {
    const fg = STATE_TO_GROUP_MAP.get(node.name);
    for (const t of node.transitions) {
      const tg = STATE_TO_GROUP_MAP.get(t.to);
      if (fg && tg && fg !== tg) {
        const key = `${fg}->${tg}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
  }
  return Array.from(map, ([key, count]) => {
    const [from, to] = key.split('->');
    return { from, to, count };
  });
})();

/** Compute point on rectangle edge closest to a target direction. */
export function rectEdgePoint(cx: number, cy: number, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = GN_W / 2;
  const hh = GN_H / 2;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const t = Math.min(
    ax > 0.001 ? hw / ax : Infinity,
    ay > 0.001 ? hh / ay : Infinity,
  );
  return { x: cx + dx * t, y: cy + dy * t };
}
