/**
 * The game registry — pure (no Node imports), so client and server resolve a game identically.
 * An UNKNOWN game id or an UNMAPPED canon profile throws: silently resolving either to PoF would
 * put one game's entities on another game's board and nothing would say so (the same rule as
 * `rulesForProfile`).
 */
import { DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';
import type { GameCatalogSplit, GameDef, GameId } from './types';
import { GAME_IDS } from './types';
import { POF_GAME } from './pof';
import { GTAI_GAME } from './gtai';

export const DEFAULT_GAME: GameId = 'pof';

export const GAMES: Readonly<Record<GameId, GameDef>> = {
  pof: POF_GAME,
  gtai: GTAI_GAME,
};

export function isGameId(id: unknown): id is GameId {
  return typeof id === 'string' && (GAME_IDS as readonly string[]).includes(id);
}

export function getGame(id: string): GameDef {
  if (!isGameId(id)) throw new Error(`Unknown game "${id}" — registered: ${GAME_IDS.join(', ')}`);
  return GAMES[id];
}

export function gameOfProfile(profileId: string): GameId {
  for (const g of GAME_IDS) if (GAMES[g].canonProfiles.includes(profileId)) return g;
  throw new Error(`Canon profile "${profileId}" belongs to no registered game — add it to a GameDef.canonProfiles`);
}

/** The game an entity belongs to, derived from its canon profile (code seeds carry none → PoF). */
export function gameOfEntity(entity: { provenance?: { canonProfile?: string } } | null | undefined): GameId {
  return gameOfProfile(entity?.provenance?.canonProfile ?? DEFAULT_CANON_PROFILE);
}

/** The profile a game's NEW entities are authored under. */
export function authoringProfileOf(id: GameId): string {
  return GAMES[id].canonProfiles[0];
}

/** Split the registered pipelines by a game's manifest. */
export function catalogsForGame(id: GameId, registered: readonly string[]): GameCatalogSplit {
  const game = GAMES[id];
  if (game.manifest === 'all') return { inManifest: [...registered], offManifest: [], planned: [] };
  const known = new Set(registered);
  const inManifest = game.manifest.filter((e) => e.fit !== 'planned' && known.has(e.catalogId)).map((e) => e.catalogId);
  const used = new Set(inManifest);
  return {
    inManifest,
    offManifest: registered.filter((c) => !used.has(c)),
    planned: game.manifest.filter((e) => e.fit === 'planned'),
  };
}
