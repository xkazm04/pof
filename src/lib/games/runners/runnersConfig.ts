/**
 * Server-only: where a game's lane runner roots and masters folder are. Config, never hard-coded in a reader:
 * the game's manifest (`GameDef.runners`, paths relative to the PoF repo root) with env overrides
 * `POF_GAME_RUNNER_ROOTS_<ID>` (`;`-separated, absolute or repo-relative) and `POF_GAME_MASTERS_<ID>`.
 * A path that is not on disk is dropped from `masters` (no frames) but kept in `roots` (the board says the root is
 * unreadable instead of silently showing fewer lanes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getGame } from '@/lib/games/registry';
import { resolveGamesRoot } from '@/lib/games/intake/files';
import type { GameId } from '@/lib/games/types';

type Env = Readonly<Record<string, string | undefined>>;

export interface RunnersConfig {
  roots: string[];
  masters?: string;
}

const envKey = (id: GameId) => id.toUpperCase().replace(/-/g, '_');
export const runnerRootsEnvVar = (id: GameId) => `POF_GAME_RUNNER_ROOTS_${envKey(id)}`;
export const mastersEnvVar = (id: GameId) => `POF_GAME_MASTERS_${envKey(id)}`;

/** `null` = the game declares no runners (and no env override names any). */
export function runnersConfigFor(id: GameId, deps: { env?: Env; repoRoot?: string; exists?: (p: string) => boolean } = {}): RunnersConfig | null {
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? fs.existsSync;
  const base = deps.repoRoot ?? resolveGamesRoot(env);
  const declared = getGame(id).runners;
  const rootsEnv = env[runnerRootsEnvVar(id)]?.trim();
  const mastersEnv = env[mastersEnvVar(id)]?.trim();
  const rootList = rootsEnv ? rootsEnv.split(';').map((s) => s.trim()).filter(Boolean) : declared ? [...declared.roots] : [];
  const mastersRel = mastersEnv || declared?.masters;
  if (rootList.length === 0 && !mastersRel) return null;
  const masters = mastersRel ? path.resolve(base, mastersRel) : undefined;
  return {
    roots: rootList.map((r) => path.resolve(base, r)),
    ...(masters && exists(masters) ? { masters } : {}),
  };
}
