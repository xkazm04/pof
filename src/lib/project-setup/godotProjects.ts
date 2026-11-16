/**
 * Server-only (fs): the Godot projects the landing screen can open.
 *
 * A Godot project is a folder holding a `project.godot`. The candidates are the registered
 * Godot games (`GAMES`, engine.kind 'godot'): each game's repo root resolves through
 * `gameRootFor` (so `POF_GAME_ROOT_<ID>` still wins), and the project folder is `<root>/project`
 * (the layout GTAI uses) or the root itself. A game whose root is unbound, or that has no
 * `project.godot`, is simply not listed. The display name is the project's own `config/name`.
 * Never import this into a client component.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GAMES } from '@/lib/games/registry';
import { GAME_IDS, type GameId } from '@/lib/games/types';
import { gameRootFor } from '@/lib/games/gameRoot';

export interface DetectedGodotProject {
  /** The registered game this project is (PoF opens its game workspace). */
  gameId: GameId;
  /** `config/name` from project.godot, else the game's title. */
  name: string;
  /** The folder holding project.godot. */
  path: string;
  /** The game's repo root (where build evidence lives). */
  root: string;
  /** The version the game registry locks, e.g. '4.7.2'. */
  engineVersion: string;
  /** Always true for a listed project: project.godot was read. */
  validated: boolean;
}

export interface GodotDetectDeps {
  readFile?: (p: string) => string | null;
  rootFor?: (id: GameId) => string | null;
}

const readText = (p: string): string | null => {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
};

/** `config/name="RTAI: Uprising"` -> `RTAI: Uprising`; null when absent or empty. */
export function parseGodotProjectName(projectGodot: string): string | null {
  const m = /^config\/name\s*=\s*"((?:[^"\\]|\\.)*)"/m.exec(projectGodot);
  const name = m?.[1]?.replace(/\\(["\\])/g, '$1').trim();
  return name ? name : null;
}

export function detectGodotProjects(deps: GodotDetectDeps = {}): DetectedGodotProject[] {
  const read = deps.readFile ?? readText;
  const rootFor = deps.rootFor ?? ((id: GameId) => gameRootFor(id));
  const found: DetectedGodotProject[] = [];
  for (const id of GAME_IDS) {
    const game = GAMES[id];
    if (game.engine.kind !== 'godot') continue;
    const root = rootFor(id);
    if (!root) continue;
    for (const dir of [path.join(root, 'project'), root]) {
      const text = read(path.join(dir, 'project.godot'));
      if (text === null) continue;
      found.push({
        gameId: id,
        name: parseGodotProjectName(text) ?? game.title,
        path: dir,
        root,
        engineVersion: game.engine.version,
        validated: true,
      });
      break;
    }
  }
  return found;
}
