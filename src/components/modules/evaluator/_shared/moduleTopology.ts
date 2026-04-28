import type { SubModuleId } from '@/types/modules';

/**
 * Shared module-topology layout for the ARPG dependency views.
 *
 * Both `DependencyGraph` and `NexusView` previously hand-rolled identical
 * `MODULE_POSITIONS` tables and a `getNodeCenter` helper, with subtly
 * different node-size constants (DependencyGraph used COL_WIDTH=180 / NODE_W=140;
 * NexusView used 200/160). When `arpg-cinematics` is added to the registry,
 * three files needed updates and only one would have been touched in practice.
 *
 * This module extracts the shared positioning math. JSX shape stays divergent
 * (DependencyGraph renders flat rects; NexusView renders pseudo-3D nodes with
 * extra layer overlays) — only the layout is shared (see ui-perfectionist 20.5).
 */

/** 4 columns × 3 rows arrangement for the 12 ARPG modules (logical flow). */
export const MODULE_POSITIONS: Record<string, { col: number; row: number }> = {
  'arpg-character':    { col: 0, row: 0 },
  'arpg-animation':    { col: 1, row: 0 },
  'arpg-gas':          { col: 2, row: 0 },
  'arpg-combat':       { col: 3, row: 0 },
  'arpg-enemy-ai':     { col: 0, row: 1 },
  'arpg-inventory':    { col: 1, row: 1 },
  'arpg-loot':         { col: 2, row: 1 },
  'arpg-ui':           { col: 3, row: 1 },
  'arpg-progression':  { col: 0, row: 2 },
  'arpg-world':        { col: 1, row: 2 },
  'arpg-save':         { col: 2, row: 2 },
  'arpg-polish':       { col: 3, row: 2 },
};

export interface TopologyLayout {
  colWidth: number;
  rowHeight: number;
  nodeW: number;
  nodeH: number;
  padX: number;
  padY: number;
}

/** Compact layout — used by `DependencyGraph` (smaller nodes, tighter columns). */
export const TOPOLOGY_COMPACT: TopologyLayout = {
  colWidth: 180,
  rowHeight: 120,
  nodeW: 140,
  nodeH: 72,
  padX: 40,
  padY: 40,
};

/** Roomy layout — used by `NexusView` (larger nodes, more whitespace for layer overlays). */
export const TOPOLOGY_ROOMY: TopologyLayout = {
  colWidth: 200,
  rowHeight: 130,
  nodeW: 160,
  nodeH: 80,
  padX: 50,
  padY: 50,
};

/**
 * Returns the (x, y) center of a module node for the given layout.
 * Falls back to the (0, 0) cell when a module is missing from `MODULE_POSITIONS`.
 */
export function getNodeCenter(moduleId: SubModuleId, layout: TopologyLayout) {
  const pos = MODULE_POSITIONS[moduleId] ?? { col: 0, row: 0 };
  return {
    x: layout.padX + pos.col * layout.colWidth + layout.nodeW / 2,
    y: layout.padY + pos.row * layout.rowHeight + layout.nodeH / 2,
  };
}
