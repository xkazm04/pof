/**
 * Server-only: where a game's design-decision folder is. Config, never hard-coded in a reader: the game's manifest
 * (`GameDef.decisions.root`, relative to the PoF repo root: `POF_GAMES_ROOT`, else cwd) with the env override
 * `POF_GAME_DECISIONS_<ID>` (absolute or repo-relative). `null` = the game declares none.
 */
import path from 'node:path';
import { getGame } from '@/lib/games/registry';
import { resolveGamesRoot } from '@/lib/games/intake/files';
import type { GameId } from '@/lib/games/types';

type Env = Readonly<Record<string, string | undefined>>;

export const decisionsEnvVar = (id: GameId) => `POF_GAME_DECISIONS_${id.toUpperCase().replace(/-/g, '_')}`;

export function decisionsRootFor(id: GameId, deps: { env?: Env; repoRoot?: string } = {}): string | null {
  const env = deps.env ?? process.env;
  const rel = env[decisionsEnvVar(id)]?.trim() || getGame(id).decisions?.root;
  return rel ? path.resolve(deps.repoRoot ?? resolveGamesRoot(env), rel) : null;
}
