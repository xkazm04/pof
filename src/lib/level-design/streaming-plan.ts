/**
 * The streaming zone plan — its types, its default document, and the ONE
 * reducer that writes it.
 *
 * The planner used to hold its plan in component-local useStates. It is
 * mounted only while the Streaming tab is active, so every tab round trip
 * reseeded the demo zones; its mode lived in three independent states
 * (paint type / selection / link source) whose precedence was decided by
 * if-order; and "change a zone's type" had two different name rules (the
 * palette renamed, the editor kept the name). Here the mode is one union, every
 * gesture is a named {@link StreamingOp}, and `useLevelDesignView` owns the
 * reducer so the plan survives any tab switch (the planner falls back to a
 * private instance when rendered on its own). `buildStreamingZonePrompt` reads
 * these same types, so lib never imports from the component folder.
 *
 * Op names are a contract: the streaming preflight's one-click fixes dispatch
 * `updateZone` / `updateTransition` by name.
 */

export type ZoneType = 'town' | 'forest' | 'ruins' | 'catacombs' | 'boss-arena' | 'hub' | 'dungeon' | 'custom';
export type LoadPriority = 'always' | 'high' | 'normal' | 'low';
export type TransitionStyle = 'seamless' | 'loading-screen' | 'fade' | 'portal';
export type TransitionTrigger = 'proximity' | 'interaction' | 'automatic';

export interface StreamingZone {
  id: string;
  name: string;
  type: ZoneType;
  gridX: number;
  gridY: number;
  loadPriority: LoadPriority;
  alwaysLoaded: boolean;
  /** Streaming distance — how many cells away to begin loading */
  preloadRadius: number;
}

export interface ZoneTransition {
  id: string;
  fromId: string;
  toId: string;
  style: TransitionStyle;
  triggerType: TransitionTrigger;
  /** Optional condition text, e.g. "Defeat Boss" */
  condition: string;
}

/** What the prompt builder (and anything downstream) reads: the document without UI state. */
export interface StreamingZonePlannerConfig {
  zones: StreamingZone[];
  transitions: ZoneTransition[];
  gridSize: number;
}

/** The single interaction mode. Paint and link cannot coexist. */
export type StreamingMode =
  | { kind: 'select' }
  | { kind: 'paint'; zoneType: ZoneType }
  | { kind: 'erase' }
  | { kind: 'link'; from: string };

export interface StreamingPlanState extends StreamingZonePlannerConfig {
  mode: StreamingMode;
  selectedZoneId: string | null;
}

export type StreamingOp =
  | { type: 'setPaint'; zoneType: ZoneType }
  | { type: 'setErase' }
  | { type: 'startLink'; from: string }
  | { type: 'cancelMode' }
  /** A grid click, resolved by the current mode. */
  | { type: 'cellClick'; x: number; y: number }
  | { type: 'paint'; x: number; y: number; zoneType: ZoneType }
  | { type: 'erase'; x: number; y: number }
  | { type: 'updateZone'; zoneId: string; patch: Partial<Omit<StreamingZone, 'id'>> }
  | { type: 'setZoneType'; zoneId: string; zoneType: ZoneType }
  | { type: 'updateTransition'; transitionId: string; patch: Partial<Omit<ZoneTransition, 'id'>> }
  | { type: 'deleteTransition'; transitionId: string }
  | { type: 'select'; zoneId: string | null };

/** The reducer's state and dispatch, handed to a planner that does not own them. */
export interface StreamingPlanStore {
  state: StreamingPlanState;
  dispatch: (op: StreamingOp) => void;
}

export interface StreamingOpDeps {
  /** Id for a new zone (`'z'`) or transition (`'tr'`). */
  newId: (prefix: 'z' | 'tr') => string;
}

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  'town': 'Town',
  'forest': 'Forest',
  'ruins': 'Ruins',
  'catacombs': 'Catacombs',
  'boss-arena': 'Boss Arena',
  'hub': 'Hub',
  'dungeon': 'Dungeon',
  'custom': 'Custom',
};

export const DEFAULT_GRID_SIZE = 7;

export const DEFAULT_ZONES: readonly StreamingZone[] = [
  { id: 'z-town', name: 'Town', type: 'town', gridX: 2, gridY: 2, loadPriority: 'always', alwaysLoaded: true, preloadRadius: 2 },
  { id: 'z-forest', name: 'Dark Forest', type: 'forest', gridX: 3, gridY: 1, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-ruins', name: 'Old Ruins', type: 'ruins', gridX: 4, gridY: 2, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-cata', name: 'Catacombs', type: 'catacombs', gridX: 3, gridY: 3, loadPriority: 'low', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-boss', name: 'Boss Arena', type: 'boss-arena', gridX: 5, gridY: 2, loadPriority: 'high', alwaysLoaded: false, preloadRadius: 2 },
];

export const DEFAULT_TRANSITIONS: readonly ZoneTransition[] = [
  { id: 'tr-1', fromId: 'z-town', toId: 'z-forest', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-2', fromId: 'z-forest', toId: 'z-ruins', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-3', fromId: 'z-town', toId: 'z-cata', style: 'fade', triggerType: 'interaction', condition: '' },
  { id: 'tr-4', fromId: 'z-ruins', toId: 'z-boss', style: 'loading-screen', triggerType: 'interaction', condition: 'Collect 3 Rune Fragments' },
];

export function initialStreamingPlan(): StreamingPlanState {
  return {
    zones: structuredClone(DEFAULT_ZONES) as StreamingZone[],
    transitions: structuredClone(DEFAULT_TRANSITIONS) as ZoneTransition[],
    gridSize: DEFAULT_GRID_SIZE,
    mode: { kind: 'select' },
    selectedZoneId: null,
  };
}

export function toConfig(state: StreamingPlanState): StreamingZonePlannerConfig {
  return { zones: state.zones, transitions: state.transitions, gridSize: state.gridSize };
}

export function zoneAt(zones: readonly StreamingZone[], x: number, y: number): StreamingZone | null {
  return zones.find((z) => z.gridX === x && z.gridY === y) ?? null;
}

/**
 * THE set-zone-type rule, for the palette and the editor alike: a zone still
 * named its type's default label follows the new type; a name the designer
 * chose is kept.
 */
export function withZoneType(zone: StreamingZone, zoneType: ZoneType): StreamingZone {
  const name = zone.name === ZONE_TYPE_LABELS[zone.type] ? ZONE_TYPE_LABELS[zoneType] : zone.name;
  return { ...zone, type: zoneType, name };
}

let idSeq = 0;
const DEFAULT_DEPS: StreamingOpDeps = {
  newId: (prefix) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`,
};

const mapZone = (state: StreamingPlanState, id: string, fn: (z: StreamingZone) => StreamingZone): StreamingPlanState =>
  ({ ...state, zones: state.zones.map((z) => (z.id === id ? fn(z) : z)) });

function link(state: StreamingPlanState, from: string, x: number, y: number, deps: StreamingOpDeps): StreamingPlanState {
  const done: StreamingPlanState = { ...state, mode: { kind: 'select' } };
  const target = zoneAt(state.zones, x, y);
  if (!target || target.id === from) return done;
  const exists = state.transitions.some((t) =>
    (t.fromId === from && t.toId === target.id) || (t.fromId === target.id && t.toId === from));
  if (exists) return done;
  const transition: ZoneTransition = {
    id: deps.newId('tr'), fromId: from, toId: target.id, style: 'seamless', triggerType: 'proximity', condition: '',
  };
  return { ...done, transitions: [...state.transitions, transition] };
}

export function applyStreamingOp(
  state: StreamingPlanState,
  op: StreamingOp,
  deps: StreamingOpDeps = DEFAULT_DEPS,
): StreamingPlanState {
  switch (op.type) {
    case 'setPaint':
      return { ...state, mode: { kind: 'paint', zoneType: op.zoneType } };
    case 'setErase':
      return { ...state, mode: { kind: 'erase' } };
    case 'startLink':
      return state.zones.some((z) => z.id === op.from) ? { ...state, mode: { kind: 'link', from: op.from } } : state;
    case 'cancelMode':
      return { ...state, mode: { kind: 'select' } };
    case 'cellClick': {
      const { mode } = state;
      if (mode.kind === 'link') return link(state, mode.from, op.x, op.y, deps);
      if (mode.kind === 'erase') return applyStreamingOp(state, { type: 'erase', x: op.x, y: op.y }, deps);
      if (mode.kind === 'paint') return applyStreamingOp(state, { type: 'paint', x: op.x, y: op.y, zoneType: mode.zoneType }, deps);
      return { ...state, selectedZoneId: zoneAt(state.zones, op.x, op.y)?.id ?? null };
    }
    case 'paint': {
      const existing = zoneAt(state.zones, op.x, op.y);
      if (existing) {
        return { ...mapZone(state, existing.id, (z) => withZoneType(z, op.zoneType)), selectedZoneId: existing.id };
      }
      const zone: StreamingZone = {
        id: deps.newId('z'), name: ZONE_TYPE_LABELS[op.zoneType], type: op.zoneType,
        gridX: op.x, gridY: op.y, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1,
      };
      return { ...state, zones: [...state.zones, zone], selectedZoneId: zone.id };
    }
    case 'erase': {
      const existing = zoneAt(state.zones, op.x, op.y);
      if (!existing) return state;
      return {
        ...state,
        zones: state.zones.filter((z) => z.id !== existing.id),
        transitions: state.transitions.filter((t) => t.fromId !== existing.id && t.toId !== existing.id),
        selectedZoneId: state.selectedZoneId === existing.id ? null : state.selectedZoneId,
      };
    }
    case 'updateZone': {
      const { type, ...rest } = op.patch;
      return mapZone(state, op.zoneId, (z) => {
        const patched = { ...z, ...rest };
        return type ? withZoneType(patched, type) : patched;
      });
    }
    case 'setZoneType':
      return mapZone(state, op.zoneId, (z) => withZoneType(z, op.zoneType));
    case 'updateTransition':
      return {
        ...state,
        transitions: state.transitions.map((t) => (t.id === op.transitionId ? { ...t, ...op.patch } : t)),
      };
    case 'deleteTransition':
      return { ...state, transitions: state.transitions.filter((t) => t.id !== op.transitionId) };
    case 'select':
      return { ...state, selectedZoneId: op.zoneId };
  }
}

/** `useReducer`-shaped: the level-design view and the planner's private fallback both use this. */
export function streamingPlanReducer(state: StreamingPlanState, op: StreamingOp): StreamingPlanState {
  return applyStreamingOp(state, op);
}
