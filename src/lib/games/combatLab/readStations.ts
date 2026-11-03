/**
 * Server-only (fs): the arena's stations. Every lane adds its station as one file in `GameCombatLab.stationsDir`
 * (`id`, `name`, `area`, a spawn list, props, the tuning keys it exposes, the measurements it reports); this lists them
 * across sources so the owner sees which lane has plugged in what. Schema-tolerant: a count is the length of the first
 * list/map under a key that names it, and is omitted when the file has no such key (never 0).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ArenaStation, StationsRead } from './combatTypes';
import type { SourceDir } from './readCombatLab';

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function countUnder(doc: Record<string, unknown>, ...needles: string[]): number | undefined {
  for (const [k, v] of Object.entries(doc)) {
    if (!needles.some((n) => k.toLowerCase().includes(n))) continue;
    if (Array.isArray(v)) return v.length;
    if (isRec(v)) return Object.keys(v).length;
  }
  return undefined;
}

export function stationOf(file: string, from: ArenaStation['from'], doc: unknown): ArenaStation {
  const d = isRec(doc) ? doc : {};
  const st: ArenaStation = { file, from };
  const id = str(d.id), name = str(d.name), area = str(d.area);
  if (id) st.id = id;
  if (name) st.name = name;
  if (area) st.area = area;
  const spawns = countUnder(d, 'spawn'), props = countUnder(d, 'prop'), tuning = countUnder(d, 'tun', 'expose'), reports = countUnder(d, 'measure', 'report');
  if (spawns !== undefined) st.spawns = spawns;
  if (props !== undefined) st.props = props;
  if (tuning !== undefined) st.tuningKeys = tuning;
  if (reports !== undefined) st.measurements = reports;
  return st;
}

export function readStations(dirRel: string, sources: SourceDir[]): StationsRead {
  const items: ArenaStation[] = [];
  const searched = sources.filter((s) => !s.telemetryDirs);
  for (const s of searched) {
    let names: string[];
    try { names = fs.readdirSync(path.join(s.root, dirRel)).filter((n) => n.toLowerCase().endsWith('.json')).sort(); } catch { continue; }
    for (const n of names) {
      const full = path.join(s.root, dirRel, n);
      const from = { id: s.id, label: s.label };
      try {
        if (fs.statSync(full).size > 1_000_000) throw new Error('too large');
        items.push(stationOf(n, from, JSON.parse(fs.readFileSync(full, 'utf8'))));
      } catch { items.push({ file: n, from, unreadable: true }); }
    }
  }
  return {
    dir: dirRel, items,
    expected: `one JSON file per lane in ${dirRel} (inside the game root or a lane worktree); ${items.length ? '' : `none found in ${searched.map((s) => s.label).join(', ') || 'any source'}`}`.trim(),
  };
}
