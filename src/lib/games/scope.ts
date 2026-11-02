/**
 * Active-game SCOPING — the one pure rule every view applies to show only the active game
 * (lab tree, Matrix, search, coach, /status lanes and entity sets, the Game home).
 *
 * Pure (no React, no Node): unit-pinned in `src/__tests__/lib/games/scope.test.ts`. The game is
 * DERIVED from an entity's canon profile (`gameOfProfile`), never stored. Two honesty rules:
 *  - `pof` (`manifest: 'all'`) scopes to exactly the list it is given, in the order given, so
 *    PoF's board is today's board.
 *  - An entity whose canon profile belongs to NO registered game is in NO game. `gameOfProfile`
 *    throws for it (the registry's rule); a render cannot throw, so here it is simply not shown
 *    on any board rather than silently resolved to PoF.
 */
import { DEFAULT_GAME, GAMES, catalogsForGame, gameOfProfile } from './registry';
import type { GameDef, GameId, ManifestEntry, ManifestFit } from './types';

/** What an entity carries that names its canon profile: a stored entity's provenance, or a LabEntity's resolved `canonProfile`. */
export interface ProfiledEntity {
  canonProfile?: string;
  provenance?: { canonProfile?: string };
}

/** The game an entity belongs to, or `null` when its profile maps to no registered game. Never throws. */
export function gameOfEntitySafe(entity: ProfiledEntity | null | undefined): GameId | null {
  const profile = entity?.canonProfile ?? entity?.provenance?.canonProfile;
  if (profile === undefined) return DEFAULT_GAME; // code seeds carry no provenance: PoF's own
  try {
    return gameOfProfile(profile);
  } catch {
    return null;
  }
}

/** Does `entity` belong to `gameId`? Absent entity = a code seed's absence of provenance = PoF. */
export function entityInGame(entity: ProfiledEntity | null | undefined, gameId: GameId): boolean {
  return gameOfEntitySafe(entity) === gameId;
}

/** The catalogs a game's views show. */
export interface CatalogScope {
  /** Catalogs to show, in the order of `registered` (in-manifest, plus off-manifest under showAll). */
  visible: string[];
  /** Of `visible`, the off-manifest ones — rendered greyed, "not in <title>". */
  offManifest: ReadonlySet<string>;
  /** Manifest entries for pipelines that do not exist yet. */
  planned: ManifestEntry[];
}

/**
 * Scope a registered catalog list to a game. `registered` order is kept (the lab's category
 * grouping and /status's registry order both depend on it). For `manifest: 'all'` the result
 * is `registered` itself, unchanged.
 */
export function scopeCatalogIds(gameId: GameId, registered: readonly string[], showAll: boolean): CatalogScope {
  const split = catalogsForGame(gameId, registered);
  const inGame = new Set(split.inManifest);
  const off = new Set(showAll ? split.offManifest : []);
  return {
    visible: registered.filter((c) => inGame.has(c) || off.has(c)),
    offManifest: off,
    planned: split.planned,
  };
}

/**
 * Keep only the entities of `gameId` from a catalog-keyed entity map (catalogs left empty are
 * dropped). A catalog whose entities ALL belong to the game keeps its original inner object, so
 * per-catalog memo caches keyed on that reference (the coach's) do not miss for PoF.
 */
export function entitiesInGame<E extends ProfiledEntity>(
  byCatalog: Readonly<Record<string, Readonly<Record<string, E>>>>,
  gameId: GameId,
): Record<string, Readonly<Record<string, E>>> {
  const out: Record<string, Readonly<Record<string, E>>> = {};
  for (const [catalogId, byId] of Object.entries(byCatalog)) {
    const entries = Object.entries(byId);
    const kept = entries.filter(([, e]) => entityInGame(e, gameId));
    if (kept.length === 0) continue;
    out[catalogId] = kept.length === entries.length ? byId : Object.fromEntries(kept);
  }
  return out;
}

/**
 * The entity set /status grades for a game. PoF's /status has always graded the CODE SEEDS
 * only (it never hydrated persisted rows), so for `pof` that stays exactly the seed map. A
 * non-default game has no code seeds by construction — its entities are the persisted
 * (intake / one-shot) rows — so for it the set is the persisted rows of that game.
 */
export function statusEntitiesForGame<E extends ProfiledEntity>(
  gameId: GameId,
  seeds: Readonly<Record<string, Readonly<Record<string, E>>>>,
  persisted: Readonly<Record<string, Readonly<Record<string, E>>>>,
): Readonly<Record<string, Readonly<Record<string, E>>>> {
  if (gameId === DEFAULT_GAME) return seeds;
  const fromSeeds = entitiesInGame(seeds, gameId);
  const fromPersisted = entitiesInGame(persisted, gameId);
  const out: Record<string, Readonly<Record<string, E>>> = { ...fromSeeds };
  for (const [c, byId] of Object.entries(fromPersisted)) out[c] = { ...(out[c] ?? {}), ...byId };
  return out;
}

/**
 * Keep artifact rows whose entity is in `gameId`. An artifact inherits its entity's game; a row
 * whose entity is not known to the client (a removed entity, persisted rows not hydrated) has
 * no provenance and reads as PoF's — the same rule `gameOfEntity` applies to a code seed — so
 * PoF's rows are exactly today's rows.
 */
export function rowsInGame<R extends { entityId: string }>(
  rows: readonly R[],
  gameId: GameId,
  lookup: (entityId: string) => ProfiledEntity | undefined,
): R[] {
  return rows.filter((r) => entityInGame(lookup(r.entityId), gameId));
}

// ── Game home model ────────────────────────────────────────────────────────────────────────

/** One Game-home pipeline row. Coverage and readiness are SEPARATE fields, never blended. */
export interface GamePipelineRow {
  catalogId: string;
  /** `'all'` = the game's manifest is the whole registry (pof), so no per-pipeline fit is declared. */
  fit: ManifestFit | 'all';
  note?: string;
  /** False for a manifest entry that names no registered pipeline (a typo, or a removed one). */
  registered: boolean;
  /** Entities of this game in this catalog. */
  count: number;
  /** Declared target; ABSENT = no target declared (never rendered as 0). */
  expected?: number;
}

/** The Game home's pipeline rows: built manifest pipelines first (manifest order), then planned. */
export function gamePipelineRows(
  gameId: GameId,
  registered: readonly string[],
  entitiesByCatalog: Readonly<Record<string, Readonly<Record<string, ProfiledEntity>>>>,
): GamePipelineRow[] {
  const countOf = (c: string) => Object.values(entitiesByCatalog[c] ?? {}).filter((e) => entityInGame(e, gameId)).length;
  const manifest = GAMES[gameId].manifest;
  if (manifest === 'all') return registered.map((c) => ({ catalogId: c, fit: 'all', registered: true, count: countOf(c) }));
  const known = new Set(registered);
  const built = manifest.filter((e) => e.fit !== 'planned');
  const planned = manifest.filter((e) => e.fit === 'planned');
  return [...built, ...planned].map((e) => ({
    catalogId: e.catalogId,
    fit: e.fit,
    ...(e.note !== undefined ? { note: e.note } : {}),
    registered: known.has(e.catalogId),
    count: e.fit === 'planned' ? 0 : countOf(e.catalogId),
    ...(e.expected !== undefined ? { expected: e.expected } : {}),
  }));
}

/** Coverage text: "3 / 10", or "3 · no target declared" when the manifest declares none. */
export function coverageText(row: Pick<GamePipelineRow, 'count' | 'expected'>): string {
  return row.expected === undefined ? `${row.count} · no target declared` : `${row.count} / ${row.expected}`;
}

/** The ladder rungs a readiness reading can take (mirrors `status/readiness.ts`). */
export type ReadinessCode = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
const RUNGS: readonly ReadinessCode[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'];

/**
 * The best REACHED rung across a catalog's cells, or `'unmeasured'` when nothing was measured:
 * no artifact rows for the game's entities, or no cell reached above R0. Never R0 for "nothing
 * measured" — R0 is a claim ("nothing wired"), unmeasured is the absence of one.
 */
export function bestReadiness(
  rowCount: number,
  readings: readonly { level: ReadinessCode; state: 'reached' | 'waiting' | 'blocked' }[],
): ReadinessCode | 'unmeasured' {
  if (rowCount === 0) return 'unmeasured';
  let best = 0;
  for (const r of readings) if (r.state === 'reached') best = Math.max(best, RUNGS.indexOf(r.level));
  return best === 0 ? 'unmeasured' : RUNGS[best];
}

/** How a game's engine binding reads. Pure: from `GameDef.engine`, no server call. */
export type EngineState =
  | { kind: 'undecided' }
  | { kind: 'unbound' }
  | { kind: 'bound'; root: string }
  /** pof's `root: null` means "the existing server-side chain" (POF_UE_ROOT, else the default project). */
  | { kind: 'project-default' }
  /** A locked non-UE engine. L2 reads the game-written evidence under its root (`gameRoot.ts`; a root not on
   *  disk defers as unbound, which this pure view cannot see); the runtime tiers are UE-only and defer. */
  | { kind: 'adapter-missing'; engine: 'godot'; version: string; root: string | null };

export function engineStateOf(game: Pick<GameDef, 'id' | 'engine'>): EngineState {
  if (game.engine.kind === 'undecided') return { kind: 'undecided' };
  if (game.engine.kind === 'godot') return { kind: 'adapter-missing', engine: 'godot', version: game.engine.version, root: game.engine.root };
  if (game.engine.root !== null) return { kind: 'bound', root: game.engine.root };
  return game.id === DEFAULT_GAME ? { kind: 'project-default' } : { kind: 'unbound' };
}
