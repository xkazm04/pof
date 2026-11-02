/**
 * Server-only: which engine project a game's acceptance reads. Kept out of the pure registry
 * because `resolveUeRoot` is filesystem/env-backed (fs is reached lazily through
 * `ueStaticCheckers`, so importing this module never drags `node:fs` into a client chunk).
 *
 * - `pof` → the existing chain (`POF_UE_ROOT` env, else the default PoF UE project).
 * - a game whose engine is `undecided` or non-UE (`godot`), or `ue5` with `root: null` other than pof → `null` =
 *   "no engine project bound"; callers DEFER with `unboundReason(id)`, never fail and never fall back
 *   to PoF's project (that would grade one game against another's engine tree).
 * - a `ue5` game with a root → that root when it exists on disk, else `null` (unbound, not PoF's).
 *
 * Wired into the L2 static sweep (`staticVerify.ts`: `verifyStaticAll` + `staticVerdictFor`).
 */
import type { GameId } from './types';
import { DEFAULT_GAME, getGame } from './registry';
import { resolveUeRoot, ueRootExists } from '@/lib/catalog/acceptance/ueStaticCheckers';

export function ueRootForGame(id: GameId): string | null {
  if (id === DEFAULT_GAME) return resolveUeRoot();
  const { engine } = getGame(id);
  if (engine.kind !== 'ue5' || engine.root === null) return null;
  return ueRootExists(engine.root) ? engine.root : null;
}

export function unboundReason(id: GameId): string {
  const { engine } = getGame(id);
  if (engine.kind === 'godot') return `game ${id} runs on Godot ${engine.version}: PoF's engine bridge is UE-only (no Godot adapter yet)`;
  return `no engine project bound for game ${id}`;
}
