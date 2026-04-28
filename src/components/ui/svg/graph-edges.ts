/**
 * Shared SVG graph-edge math used by state-machine canvases.
 *
 * Both `AnimationStateMachine.tsx` and `StateMachineEditor.tsx` reinvented the
 * same vector math for drawing edges between graph nodes positioned in
 * percentage coordinates: a unit normal along the edge, a perpendicular for
 * bidirectional offset, an inset from each node center, and a midpoint for
 * label placement.
 *
 * Visual fidelity is preserved by keeping the JSX local to each call site —
 * this module exposes the shared geometry only.
 *
 * Refs: docs/harness/ui-perfectionist-2026-04-28/15-animation-audio.md (15.1)
 */

export interface EdgeNode {
  x: number;
  y: number;
}

export interface EdgeGeometry {
  /** Start x (percentage units) — already inset and perpendicular-offset. */
  x1: number;
  /** Start y (percentage units). */
  y1: number;
  /** End x (percentage units). */
  x2: number;
  /** End y (percentage units). */
  y2: number;
  /** Midpoint x — useful for label placement. */
  midX: number;
  /** Midpoint y — useful for label placement. */
  midY: number;
}

export interface EdgeGeometryOptions {
  /** Whether a reverse edge `(to → from)` exists; offsets perpendicular to avoid overlap. */
  reverseExists?: boolean;
  /**
   * `true` when this edge is the "forward" direction in a bidirectional pair.
   * Convention used by both call sites: `from < to` ⇒ forward (perpOffset = -1.5),
   * else backward (perpOffset = +1.5).
   */
  isForward?: boolean;
  /** How far to inset each endpoint from the node center along the edge direction. Default 8. */
  edgeOffset?: number;
  /** Perpendicular offset magnitude when reverseExists. Default 1.5. */
  perpOffsetMagnitude?: number;
}

/**
 * Compute edge endpoints + midpoint between two nodes.
 *
 * Returns `null` when nodes are coincident (zero distance) — caller should
 * skip rendering for that edge.
 */
export function computeEdgeGeometry(
  from: EdgeNode,
  to: EdgeNode,
  options: EdgeGeometryOptions = {},
): EdgeGeometry | null {
  const {
    reverseExists = false,
    isForward = true,
    edgeOffset = 8,
    perpOffsetMagnitude = 1.5,
  } = options;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return null;

  const nx = dx / dist;
  const ny = dy / dist;
  const px = -ny;
  const py = nx;
  const perpOffset = reverseExists ? (isForward ? -perpOffsetMagnitude : perpOffsetMagnitude) : 0;

  const x1 = from.x + nx * edgeOffset + px * perpOffset;
  const y1 = from.y + ny * edgeOffset + py * perpOffset;
  const x2 = to.x - nx * edgeOffset + px * perpOffset;
  const y2 = to.y - ny * edgeOffset + py * perpOffset;

  return {
    x1,
    y1,
    x2,
    y2,
    midX: (x1 + x2) / 2,
    midY: (y1 + y2) / 2,
  };
}
