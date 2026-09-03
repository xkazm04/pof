// ── Node types for the visual level flow editor ──

export type RoomType = 'combat' | 'puzzle' | 'exploration' | 'boss' | 'safe' | 'transition' | 'cutscene' | 'hub';
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type SyncStatus = 'synced' | 'doc-ahead' | 'code-ahead' | 'diverged' | 'unlinked';
export type PacingCurve = 'rising' | 'falling' | 'peak' | 'rest' | 'buildup';

export interface RoomNode {
  id: string;
  name: string;
  type: RoomType;
  description: string;
  /** Natural-language encounter/event design */
  encounterDesign: string;
  difficulty: DifficultyLevel;
  pacing: PacingCurve;
  /** Position in the visual editor */
  x: number;
  y: number;
  /** Linked C++ files (relative to Source/) */
  linkedFiles: string[];
  /** Spawn system entries referenced by this room */
  spawnEntries: SpawnEntry[];
  /** Tags for filtering/searching */
  tags: string[];
  /**
   * Machine-readable key/flag identifiers the player permanently acquires by
   * clearing this room (e.g. `['brass-key']`, `['guardian-defeated']`).
   *
   * Optional so documents written before gates existed keep parsing; a room
   * that omits it simply grants nothing. These identifiers are the satisfiers
   * for `RoomConnection.requires` and are consumed by the gate-and-key
   * solvability closure in `@/lib/level-design/pacing-linter`.
   */
  grants?: string[];
}

export interface SpawnEntry {
  id: string;
  enemyClass: string;
  count: number;
  spawnDelay: number;
  wave: number;
}

export interface RoomConnection {
  id: string;
  fromId: string;
  toId: string;
  /** Whether traversal is one-way or bidirectional */
  bidirectional: boolean;
  /** Condition for unlock (e.g., "defeat boss", "collect key") — authored prose, for display */
  condition: string;
  /**
   * Machine-readable gate: key/flag identifiers (see `RoomNode.grants`) that
   * must ALL be held before this connection can be traversed.
   *
   * Optional, so existing documents keep parsing — a connection with no
   * `requires` (or an empty one) is **ungated** and walked as an open door.
   * A connection that carries free-text `condition` but no `requires` is a
   * gate no checker can read: the linter reports it as an *undeclared gate*
   * and marks the reachability result unproven rather than silently treating
   * the lock as open.
   */
  requires?: string[];
}

// ── Design Document (the "living doc") ──

export interface LevelDesignDocument {
  id: number;
  name: string;
  description: string;
  /** Full natural-language design narrative */
  designNarrative: string;
  /** The rooms and connections (visual graph data) */
  rooms: RoomNode[];
  connections: RoomConnection[];
  /** Difficulty arc: ordered list of room IDs representing intended flow */
  difficultyArc: string[];
  /** Overall pacing description */
  pacingNotes: string;
  /** Sync tracking */
  syncStatus: SyncStatus;
  syncReport: SyncDivergence[];
  /** Code generation tracking */
  lastGeneratedAt: string | null;
  lastCodeHash: string | null;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

export interface SyncDivergence {
  roomId: string;
  roomName: string;
  field: string;
  docValue: string;
  codeValue: string;
  severity: 'info' | 'warning' | 'critical';
  suggestion: string;
}

// ── Summary stats ──

export interface LevelDesignSummary {
  totalDocs: number;
  totalRooms: number;
  syncedCount: number;
  divergedCount: number;
  unlinkedCount: number;
  difficultyDistribution: Record<DifficultyLevel, number>;
  roomTypeDistribution: Record<RoomType, number>;
}

// ── API payloads ──

export interface CreateDocPayload {
  name: string;
  description: string;
  designNarrative?: string;
}

export interface UpdateDocPayload {
  id: number;
  name?: string;
  description?: string;
  designNarrative?: string;
  rooms?: RoomNode[];
  connections?: RoomConnection[];
  difficultyArc?: string[];
  pacingNotes?: string;
  syncStatus?: SyncStatus;
  syncReport?: SyncDivergence[];
  lastGeneratedAt?: string;
  lastCodeHash?: string;
}
