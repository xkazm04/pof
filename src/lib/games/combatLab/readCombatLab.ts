/**
 * Server-only (fs): the combat lab's read. Looks for the three game tables and the arena's telemetry sessions in
 * each SOURCE (the game root = `main`, and every lane worktree), and says which source each came from. Per table the
 * first source that has it wins (game root first, since after the merge main is the truth); telemetry is every
 * source's sessions, newest first. Read-only; a table that is not there reads `missing` with the paths looked in.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GameCombatLab } from '@/lib/games/types';
import { COMBAT_TABLE_KEYS, type CombatSource, type CombatTable, type CombatTableKey, type TelemetrySession } from './combatTypes';
import { parseTable } from './parseTable';
import { readStations } from './readStations';
import { metricsOf, scalarsOf, ttkOf } from './parseSession';
import { readLaneJsonFile } from '@/lib/games/laneJson';

/** `telemetryDirs`: read these (instead of the config's) for sessions, and never for tables (the engine's user:// folder). */
export interface SourceDir extends CombatSource { root: string; telemetryDirs?: readonly string[] }
export const MAX_SESSIONS = 8;
const MAX_FILE_BYTES = 2_000_000;

function readJson(file: string): { ok: true; doc: unknown } | { ok: false; reason: string } | null {
  let st: fs.Stats;
  try { st = fs.statSync(file); } catch { return null; }
  if (!st.isFile()) return null;
  if (st.size > MAX_FILE_BYTES) return { ok: false, reason: `larger than ${MAX_FILE_BYTES / 1_000_000} MB` };
  try { return { ok: true, doc: readLaneJsonFile(file) }; } catch (e) {
    return { ok: false, reason: `unparseable JSON: ${e instanceof Error ? e.message : 'parse failed'}` };
  }
}

export function readTable(key: CombatTableKey, rel: string, sources: SourceDir[]): CombatTable {
  const empty = { columns: [], hiddenColumns: 0, rows: [] };
  let invalid: CombatTable | null = null;
  for (const s of sources.filter((x) => !x.telemetryDirs)) {
    const r = readJson(path.join(s.root, rel));
    if (!r) continue;
    const from = { id: s.id, label: s.label };
    if (!r.ok) { invalid ??= { key, file: rel, from, state: 'invalid', reason: r.reason, ...empty }; continue; }
    const parsed = parseTable(key, rel, r.doc);
    if (parsed.state === 'ok') return { key, file: rel, from, ...parsed };
    invalid ??= { key, file: rel, from, ...parsed };
  }
  return invalid ?? { key, file: rel, state: 'missing', reason: `not in ${sources.filter((s) => !s.telemetryDirs).map((s) => s.label).join(', ') || 'any source'}; expected at ${rel}`, ...empty };
}

export function readSessions(dirs: readonly string[], sources: SourceDir[], nowMs: number): TelemetrySession[] {
  const out: TelemetrySession[] = [];
  for (const s of sources) {
    for (const rel of s.telemetryDirs ?? dirs) {
      const dir = path.join(s.root, rel);
      let names: string[];
      try { names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json')); } catch { continue; }
      for (const file of names) {
        const full = path.join(dir, file);
        const r = readJson(full);
        if (!r?.ok) continue;
        const mtimeMs = fs.statSync(full).mtimeMs;
        out.push({ file, from: { id: s.id, label: s.label }, mtimeMs, ageMs: Math.max(0, nowMs - mtimeMs), metrics: metricsOf(r.doc), ttk: ttkOf(r.doc), other: scalarsOf(r.doc) });
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_SESSIONS);
}

export function readCombatLab(
  gameId: string, cfg: GameCombatLab, sources: SourceDir[], pickable: CombatSource[], source: string, now = new Date(),
): import('./combatTypes').CombatLabRead {
  return {
    gameId, readAt: now.toISOString(), configured: true, source, sources: pickable,
    tables: COMBAT_TABLE_KEYS.flatMap((k) => { const rel = cfg.tables[k]; return rel ? [readTable(k, rel, sources)] : []; }),
    ...(cfg.stationsDir ? { stations: readStations(cfg.stationsDir, sources) } : {}),
    telemetry: {
      dirs: [...cfg.telemetryDirs],
      sessions: readSessions(cfg.telemetryDirs, sources, now.getTime()),
      expected: `one JSON file per arena session in ${cfg.telemetryDirs.join(' or ')} (inside the game root or a lane worktree)`,
    },
  };
}
