export const STATE_POSITIONS: { x: number; y: number }[] = [
  { x: 110, y: 30 },   // Idle (top center)
  { x: 40, y: 95 },    // Walk (mid-left)
  { x: 180, y: 95 },   // Run (mid-right)
  { x: 110, y: 160 },  // Sprint (bottom center)
  { x: 210, y: 30 },   // Dodge (top right)
];

export interface StateTransition { from: number; to: number; label?: string }
export const STATE_TRANSITIONS: StateTransition[] = [
  { from: 0, to: 1, label: 'Input' },
  { from: 1, to: 0, label: 'Release' },
  { from: 1, to: 2, label: 'Speed >' },
  { from: 2, to: 1, label: 'Speed <' },
  { from: 2, to: 3, label: 'Shift' },
  { from: 3, to: 2, label: 'Release' },
  { from: 0, to: 4, label: 'Space' },
  { from: 1, to: 4, label: 'Space' },
  { from: 2, to: 4, label: 'Space' },
  { from: 4, to: 0, label: 'Done' },
];

export const NODE_RX = 28;
export const NODE_RY = 14;

/** Compute edge start/end points offset to the ellipse surface */
export function edgeEndpoints(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  return {
    x1: from.x + Math.cos(angle) * NODE_RX,
    y1: from.y + Math.sin(angle) * NODE_RY,
    x2: to.x - Math.cos(angle) * NODE_RX,
    y2: to.y - Math.sin(angle) * NODE_RY,
  };
}
