/* Keyed by MOVEMENT_STATES label (not array index), so reordering or inserting a state
 * cannot mis-wire the graph; state-machine-data.guard.test pins it to the state list. */
export const STATE_POSITIONS: Record<string, { x: number; y: number }> = {
  Idle: { x: 110, y: 30 },    // top center
  Walk: { x: 40, y: 95 },     // mid-left
  Run: { x: 180, y: 95 },     // mid-right
  Sprint: { x: 110, y: 160 }, // bottom center
  Dodge: { x: 210, y: 30 },   // top right
};

export interface StateTransition { from: string; to: string; label?: string }
export const STATE_TRANSITIONS: StateTransition[] = [
  { from: 'Idle', to: 'Walk', label: 'Input' },
  { from: 'Walk', to: 'Idle', label: 'Release' },
  { from: 'Walk', to: 'Run', label: 'Speed >' },
  { from: 'Run', to: 'Walk', label: 'Speed <' },
  { from: 'Run', to: 'Sprint', label: 'Shift' },
  { from: 'Sprint', to: 'Run', label: 'Release' },
  { from: 'Idle', to: 'Dodge', label: 'Space' },
  { from: 'Walk', to: 'Dodge', label: 'Space' },
  { from: 'Run', to: 'Dodge', label: 'Space' },
  // UE ARPGCharacterBase::TryDodge cancels sprint and dodges, so Sprint reaches Dodge too.
  { from: 'Sprint', to: 'Dodge', label: 'Space' },
  { from: 'Dodge', to: 'Idle', label: 'Done' },
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
