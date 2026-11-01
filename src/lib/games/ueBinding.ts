/**
 * Server-only: which engine project a game's acceptance reads. Kept out of the pure registry
 * because `resolveUeRoot` is filesystem/env-backed.
 *
 * - `pof` → the existing chain (`POF_UE_ROOT` env, else the default PoF UE project).
 * - a game whose engine is `undecided`, or `ue5` with `root: null` other than pof → `null` =
 *   "no engine project bound"; callers DEFER with `unboundReason(id)`, never fail and never fall back
 *   to PoF's project (that would grade one game against another's engine tree).
 *
 * STUB (wire commit): WP1 implements and wires it into the UE-static checkers.
 */
import type { GameId } from './types';

export function ueRootForGame(_id: GameId): string | null {
  return null;
}

export function unboundReason(id: GameId): string {
  return `no engine project bound for game ${id}`;
}
