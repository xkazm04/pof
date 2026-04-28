/**
 * Shared SVG wire/connector path math for flow-graph editors.
 *
 * `wirePath()` produces a smooth horizontal cubic bezier between two points,
 * with control-point offset proportional to the horizontal distance (capped
 * to avoid excessive curvature on long wires). This is the math that several
 * flow-graph editors (gas-blueprint WiringGraphEditor, ui-hud
 * MenuFlowDiagram, EnemyHealthBarFSM) reinvent.
 *
 * The companion `straightWire()` helper returns an SVG `M…L…` path between
 * two points — useful for the simpler editors that don't use bezier.
 *
 * Per the wave-5 caveat, the node JSX is intentionally NOT extracted; the
 * gas-blueprint pair has divergent node APIs (pin-based vs simple rect).
 *
 * Refs: docs/harness/ui-perfectionist-2026-04-28/05-abilities-progression.md (05.1)
 *       docs/harness/ui-perfectionist-2026-04-28/12-ui-hud-models.md (12.5)
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface WirePathOptions {
  /** Maximum horizontal control-point offset. Default 80. */
  maxControlOffset?: number;
  /** Fraction of horizontal distance used as control-point offset. Default 0.4. */
  controlOffsetRatio?: number;
}

/**
 * Cubic bezier "wire" between two points, biased horizontal.
 *
 * Returns an SVG path string suitable for `<path d={...}>`.
 */
export function wirePath(
  from: Point2D,
  to: Point2D,
  options: WirePathOptions = {},
): string {
  const { maxControlOffset = 80, controlOffsetRatio = 0.4 } = options;
  const cpOffset = Math.min(maxControlOffset, Math.abs(to.x - from.x) * controlOffsetRatio);
  return `M ${from.x} ${from.y} C ${from.x + cpOffset} ${from.y}, ${to.x - cpOffset} ${to.y}, ${to.x} ${to.y}`;
}
