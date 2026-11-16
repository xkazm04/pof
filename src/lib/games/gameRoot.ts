/**
 * Server-only (fs): the folder of a game's OWN engine repo — where its `build/evidence/` lives
 * (spark gtai-phase-2, WP2). Never import this into a client component.
 *
 * Resolution:
 *  1. `POF_GAME_ROOT_<ID>` (id uppercased, `-` → `_`) wins when set. It is authoritative: a set
 *     value that is not on disk resolves to `null`, never falls back to `engine.root` (a typo must
 *     not silently grade a different checkout).
 *  2. Otherwise a godot game's `engine.root`, resolved against the PoF repo root
 *     (`resolveGamesRoot`: `POF_GAMES_ROOT`, else `process.cwd()`), when it exists on disk.
 *  3. Otherwise `null` = unbound; callers DEFER with `noGameRootReason(id)`.
 *
 * UE games keep `ueRootForGame` (`ueBinding.ts`); this resolver is the Godot adapter's binding.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GameId } from './types';
import { getGame } from './registry';
import { resolveGamesRoot } from './intake/files';

type Env = Readonly<Record<string, string | undefined>>;

export interface GameRootDeps {
  env?: Env;
  exists?: (p: string) => boolean;
  /** The PoF repo root `engine.root` is resolved against. Default `resolveGamesRoot(env)`. */
  repoRoot?: string;
}

/** `POF_GAME_ROOT_GTAI` for `gtai`. */
export function gameRootEnvVar(id: GameId): string {
  return `POF_GAME_ROOT_${id.toUpperCase().replace(/-/g, '_')}`;
}

export function gameRootFor(id: GameId, deps: GameRootDeps = {}): string | null {
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? fs.existsSync;
  const override = env[gameRootEnvVar(id)]?.trim();
  if (override) return exists(override) ? path.resolve(override) : null;
  const { engine } = getGame(id);
  if (engine.kind !== 'godot' || engine.root === null) return null;
  const abs = path.resolve(deps.repoRoot ?? resolveGamesRoot(env), engine.root);
  return exists(abs) ? abs : null;
}

/** Why `gameRootFor(id)` is null, naming the env var and the declared root. */
export function noGameRootReason(id: GameId, env: Env = process.env): string {
  const v = gameRootEnvVar(id);
  const { engine } = getGame(id);
  const label = engine.kind === 'godot' ? ` (Godot ${engine.version})` : '';
  const override = env[v]?.trim();
  if (override) return `no game root for ${id}${label}: ${v}=${override} is not on disk`;
  const declared = engine.kind === 'godot' && engine.root !== null
    ? `engine.root ${engine.root} is not on disk`
    : 'no engine.root is declared';
  return `no game root for ${id}${label}: ${v} is unset and ${declared}`;
}
