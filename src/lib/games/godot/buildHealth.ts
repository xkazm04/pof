/**
 * Server-only (fs + git): a game's build health — every `pof.godot-evidence/1` kind read through
 * `readGodotEvidence`, the game root, its HEAD and one aggregate (ticket F-10). The wire shape and
 * the pure helpers live in `buildHealthTypes.ts`. Never import this into a client component.
 *
 * The HEAD is read ONCE and handed to every kind's read, so the rows are dated against the same
 * commit and the route costs one `git rev-parse`, not eight.
 */
import { getGame } from '@/lib/games/registry';
import { gameRootFor, noGameRootReason, type GameRootDeps } from '@/lib/games/gameRoot';
import type { GameId } from '@/lib/games/types';
import { GODOT_EVIDENCE_KINDS } from './evidenceTypes';
import { gitHeadOf, readGodotEvidence, type ReadEvidenceDeps } from './readEvidence';
import { aggregateOf, buildHealthState, type BuildHealth, type BuildHealthRow } from './buildHealthTypes';

export interface BuildHealthDeps {
  root?: GameRootDeps;
  /** Read this lane worktree's evidence instead of the game root (already validated against the lanes board). */
  lane?: { id: string; cwd: string };
  /** Default `gitHeadOf`. */
  headOf?: (root: string) => string | null;
  readFile?: ReadEvidenceDeps['readFile'];
  /** Default `new Date()`. */
  now?: () => Date;
}

export function buildHealthFor(gameId: GameId, deps: BuildHealthDeps = {}): BuildHealth {
  const game = getGame(gameId);
  const readAt = (deps.now ?? (() => new Date()))().toISOString();
  const engine = game.engine.kind;
  const unbound = (reason: string): BuildHealth => ({
    gameId, ...(deps.lane ? { lane: deps.lane.id } : {}), engine, binding: 'unbound', reason, root: null, head: null, readAt, rows: [], aggregate: aggregateOf([], false),
  });

  if (engine !== 'godot') {
    return unbound(`${game.title} is not a Godot game (engine: ${engine}); its build health is not read from pof.godot-evidence/1 files`);
  }
  const root = deps.lane ? deps.lane.cwd : gameRootFor(gameId, deps.root);
  if (root === null) return unbound(noGameRootReason(gameId, deps.root?.env));

  const head = (deps.headOf ?? gitHeadOf)(root);
  const rows = GODOT_EVIDENCE_KINDS.map((kind): BuildHealthRow => {
    const v = readGodotEvidence(root, kind, { gameId, headOf: () => head, ...(deps.readFile ? { readFile: deps.readFile } : {}) });
    const e = v.evidence;
    return {
      kind,
      status: v.status,
      state: buildHealthState(v.status, v.reason, e !== undefined),
      detail: v.detail,
      ...(v.reason !== undefined ? { reason: v.reason } : {}),
      ...(e ? { builtAt: e.builtAt, commit: e.commit, godotVersion: e.godotVersion } : {}),
      ...(e?.counts ? { counts: e.counts } : {}),
      ...(e?.metrics ? { metrics: e.metrics } : {}),
    };
  });
  return { gameId, ...(deps.lane ? { lane: deps.lane.id } : {}), engine, binding: 'bound', root, head, readAt, rows, aggregate: aggregateOf(rows, true) };
}
