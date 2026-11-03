/**
 * Combat lab — the wire shape of the Game home's "Combat lab" room (client-safe: no fs).
 *
 * The combat lanes write game tables (`weapons.json`, `enemies.json`, `powers.json`) and the arena lane writes
 * per-session telemetry JSON, each on its own branch tonight (on main after the merge). The reader looks in the game
 * root and the lane worktrees and says WHICH source each thing came from.
 *
 * Absent-value convention: a table that is not there is `state: 'missing'` with where it was expected; a metric a
 * session did not record is omitted from `metrics` (never 0). `null` is not used on the wire.
 */

export type CombatTableKey = 'weapons' | 'melee' | 'enemies' | 'powers';
export const COMBAT_TABLE_KEYS: readonly CombatTableKey[] = ['weapons', 'melee', 'enemies', 'powers'];

/** Where a read came from: the game root (`main`) or one lane's worktree. */
export interface CombatSource { id: string; label: string }

export interface CombatTable {
  key: CombatTableKey;
  state: 'ok' | 'missing' | 'invalid';
  /** `missing`: the paths looked in. `invalid`: why the file has no rows. */
  reason?: string;
  /** Relative path inside the source, always set. */
  file: string;
  from?: CombatSource;
  columns: string[];
  /** Columns left out of `columns` (a table wider than the cap). */
  hiddenColumns: number;
  rows: Array<{ label?: string; values: Record<string, string | number | boolean> }>;
  /** The weapons table's kill targets (`{ id, hp }`), when the document lists them. */
  targets?: Array<{ id: string; hp: number }>;
}

/** `kills`: how many kills the seconds average (set for the arena's per-spawn lists). */
export interface TtkPoint { weapon: string; rangeM: number; seconds: number; kills?: number }

export interface SessionMetric { key: 'hitRate' | 'damageTaken' | 'latency' | 'dodges' | 'knockdowns' | 'turnRate' | 'topSpeed' | 'courseTime'; value: number }

export interface TelemetrySession {
  /** File name inside its telemetry folder. */
  file: string;
  from: CombatSource;
  /** Epoch ms of the file's last write. */
  mtimeMs: number;
  /** `age` is computed by the server against `readAt`; the client never reads a clock. */
  ageMs: number;
  metrics: SessionMetric[];
  ttk: TtkPoint[];
  /** Top-level scalar values, shown when no known metric was recognised in the file. */
  other: Record<string, string | number | boolean>;
}

/** One lane's station file in the arena's stations folder. Counts are omitted when the file has no such list. */
export interface ArenaStation {
  file: string;
  from: CombatSource;
  id?: string; name?: string; area?: string;
  spawns?: number; props?: number; tuningKeys?: number; measurements?: number;
  /** The file could not be read as JSON. */
  unreadable?: boolean;
}
export interface StationsRead { dir: string; items: ArenaStation[]; expected: string }

export interface CombatLabRead {
  gameId: string;
  readAt: string;
  configured: boolean;
  reason?: string;
  /** What was asked: `auto` (game root, then every lane), `main`, or a lane id. */
  source: string;
  /** What can be picked: `auto`, `main`, each lane worktree that exists. */
  sources: CombatSource[];
  tables: CombatTable[];
  /** Optional on the wire so a read from an older server still renders. */
  stations?: StationsRead;
  telemetry: { dirs: string[]; sessions: TelemetrySession[]; expected: string };
}

export const METRIC_LABEL: Record<SessionMetric['key'], string> = {
  hitRate: 'Hit rate', damageTaken: 'Damage taken', latency: 'Input latency', dodges: 'Dodges', knockdowns: 'Knockdowns', turnRate: 'Turn rate', topSpeed: 'Top speed', courseTime: 'Course time (s)',
};
