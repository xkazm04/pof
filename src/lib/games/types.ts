/**
 * GAMES — the workspace axis PoF was missing (spark gtai-uprising-project, 2026-11-01).
 *
 * A game is a code-registered workspace that owns canon profiles, a pipeline manifest and an
 * engine binding. Nothing stores a game id on an entity or artifact: the game is DERIVED from the
 * entity's canon profile (`gameOfEntity`), so the existing tables need no migration and an
 * artifact inherits its entity's game. See docs/architecture/game-workspaces.md.
 *
 * Absent-value convention (stated once): OMIT a key for "not applicable" (`expected`, `note`,
 * `designDir`). `engine.root: null` is a claim — "no engine project bound" — and renders as
 * "unbound", never as zero or as a failure.
 */

/** Minted ids, never display names (registry: multi-project — identity survives renames). */
export type GameId = 'pof' | 'gtai';

export const GAME_IDS: readonly GameId[] = ['pof', 'gtai'];

/** How a game uses a pipeline: as-is, reworked for its genre, or not built yet. */
export type ManifestFit = 'reuse' | 'reskin' | 'planned';

export interface ManifestEntry {
  /** A registered catalogId, or — for `fit: 'planned'` — the slug the future pipeline will take. */
  catalogId: string;
  fit: ManifestFit;
  /** Reskin intent or planning note, e.g. "quests -> hitman contracts". */
  note?: string;
  /** Declared expected entity count (the coverage basis). ABSENT = no target declared. */
  expected?: number;
}

export type GameEngine =
  | { kind: 'ue5'; root: string | null }
  /** A locked non-UE engine. `root` is the game's own repo, relative to the PoF repo root (`gameRoot.ts`;
   *  `POF_GAME_ROOT_<ID>` overrides). L2 static verify reads its `pof.godot-evidence/1` files; the runtime
   *  tiers (L3/L4 drain, packaging) are UE-only and DEFER with an adapter-missing reason. */
  | { kind: 'godot'; version: string; root: string | null }
  | { kind: 'undecided' };

/**
 * Where a game's overnight/day lane runners live (`games/gtai/night/night.mjs --root R`): each root holds a
 * `night.json`, `logs/<lane>/state.json` and `billing.json`; `masters` holds `<group>/<lane>/frames.json`.
 * Paths are relative to the PoF repo root (`POF_GAMES_ROOT`, else cwd). Env overrides (`runnersConfig.ts`):
 * `POF_GAME_RUNNER_ROOTS_<ID>` (`;`-separated) and `POF_GAME_MASTERS_<ID>`.
 */
export interface GameRunners {
  roots: readonly string[];
  masters: string;
}

/**
 * Where lanes leave the owner design questions (`asks/<lane>-<n>.json`) and where answers go (`answers.json`);
 * relative to the PoF repo root. Env override `POF_GAME_DECISIONS_<ID>` (`decisionsConfig.ts`).
 */
export interface GameDecisions {
  root: string;
}

/**
 * The combat lab's inputs: the game tables the combat lanes write (paths relative to a game root OR a lane
 * worktree), the folders the arena writes per-session telemetry JSON into, and the runner roots (by folder name)
 * whose lanes are searched. Nothing is hard-coded in the reader.
 */
export interface GameCombatLab {
  tables: { weapons: string; enemies: string; powers: string };
  telemetryDirs: readonly string[];
  laneRoots: readonly string[];
  /** The engine's `user://` folder (Godot: `%APPDATA%/<custom_user_dir_name>`), read for telemetry only: a run that
   *  logs to `user://` lands there whatever worktree it ran in. */
  userData?: { appDataFolder: string; telemetryDirs: readonly string[] };
}

export interface GameDef {
  id: GameId;
  title: string;
  /** Profiles whose entities belong to this game. The FIRST is the profile new entities author under. */
  canonProfiles: readonly string[];
  /** `'all'` = every registered pipeline (PoF's own game keeps exactly today's view). */
  manifest: readonly ManifestEntry[] | 'all';
  engine: GameEngine;
  /** Repo-relative folder holding the game's versioned design truth, e.g. 'games/gtai'. */
  designDir?: string;
  /** Lane runner roots + the masters folder; OMIT = the game has no lane runners. */
  runners?: GameRunners;
  /** Owner design-decision folder; OMIT = the game has no decision board. */
  decisions?: GameDecisions;
  /** Combat lab inputs; OMIT = the game has no combat lab. */
  combatLab?: GameCombatLab;
}

/** The split a game's manifest makes of the registered pipelines. */
export interface GameCatalogSplit {
  /** Registered catalogIds this game uses, in manifest order (`'all'` → registration order). */
  inManifest: string[];
  /** Registered catalogIds this game does NOT use (shown only under "show all pipelines"). */
  offManifest: string[];
  /** Manifest entries with `fit: 'planned'` — pipelines the game needs that do not exist yet. */
  planned: ManifestEntry[];
}
