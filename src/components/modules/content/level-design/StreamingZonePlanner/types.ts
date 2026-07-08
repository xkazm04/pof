// ── Types ──

export type ZoneType = 'town' | 'forest' | 'ruins' | 'catacombs' | 'boss-arena' | 'hub' | 'dungeon' | 'custom';
export type LoadPriority = 'always' | 'high' | 'normal' | 'low';
export type TransitionStyle = 'seamless' | 'loading-screen' | 'fade' | 'portal';

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
  triggerType: 'proximity' | 'interaction' | 'automatic';
  /** Optional condition text, e.g. "Defeat Boss" */
  condition: string;
}

export interface StreamingZonePlannerConfig {
  zones: StreamingZone[];
  transitions: ZoneTransition[];
  gridSize: number;
}

export type TransitionLine = ZoneTransition & { x1: number; y1: number; x2: number; y2: number; fromName: string; toName: string };
