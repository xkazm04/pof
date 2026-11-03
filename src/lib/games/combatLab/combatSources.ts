/**
 * Server-only: which folders the combat lab reads, resolved through config (never a path from the query):
 * `main` = the game root (`gameRootFor`), and every lane worktree of the runner roots named in
 * `GameCombatLab.laneRoots` (resolved by `readLanesBoard`). `auto` reads them all, game root first.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LanesBoard } from '@/lib/games/runners/runnerTypes';
import type { GameCombatLab } from '@/lib/games/types';
import type { CombatSource } from './combatTypes';
import type { SourceDir } from './readCombatLab';

export interface SourceSet { pickable: CombatSource[]; selected: SourceDir[] }

/** `null` = the asked source does not exist (the route answers 404). */
export function resolveSources(
  cfg: GameCombatLab, mainRoot: string | null, board: LanesBoard, ask: string, appData: string | undefined = process.env.APPDATA,
): SourceSet | null {
  const all: SourceDir[] = [];
  if (mainRoot) all.push({ id: 'main', label: 'game root (main)', root: mainRoot });
  for (const r of board.roots.filter((x) => cfg.laneRoots.includes(path.basename(x.root)))) {
    for (const l of r.lanes) if (l.cwdExists && !all.some((s) => s.id === l.id)) all.push({ id: l.id, label: `lane ${l.id}${l.branch ? ` (${l.branch})` : ''}`, root: l.cwd });
  }
  if (cfg.userData && appData) {
    const root = path.join(appData, cfg.userData.appDataFolder);
    if (fs.existsSync(root)) all.push({ id: 'userdata', label: `engine user:// (${cfg.userData.appDataFolder})`, root, telemetryDirs: cfg.userData.telemetryDirs });
  }
  const pickable: CombatSource[] = [{ id: 'auto', label: 'auto: game root, then every lane' }, ...all.map(({ id, label }) => ({ id, label }))];
  if (ask === 'auto') return { pickable, selected: all };
  const one = all.find((s) => s.id === ask);
  return one ? { pickable, selected: [one] } : null;
}
