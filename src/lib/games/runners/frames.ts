/**
 * Server-only (fs): a lane's frames from `<masters>/<group>/<lane>/frames.json`, and the ONE door that serves them.
 *
 * Only a file NAMED in that lane's frames.json (as `file` or `before`) is ever readable, it must be a plain
 * relative path with an image extension, and its real path must stay inside the lane folder (a symlink out is
 * refused). The lane id is `[a-z0-9-]+`, so it cannot climb. Nothing outside the masters folder is reachable.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LaneFrame } from '@/lib/games/runners/runnerTypes';

export const MAX_FRAMES = 15;
export const LANE_ID = /^[a-z0-9][a-z0-9-]*$/;
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

export const mimeOf = (file: string): string | undefined => MIME[path.extname(file).toLowerCase()];

/** A plain relative path: no drive, no leading slash, no `..` segment, an image extension. */
export function isSafeFrameName(file: string): boolean {
  if (!file || file.includes('\0') || path.isAbsolute(file) || /^[a-zA-Z]:/.test(file) || file.startsWith('/') || file.startsWith('\\')) return false;
  if (file.split(/[\\/]/).some((seg) => seg === '..' || seg === '')) return false;
  return mimeOf(file) !== undefined;
}

/** `<masters>/<group>/<lane>`: the first group folder that holds this lane's frames.json, or null. */
export function laneFramesDir(masters: string, laneId: string): string | null {
  if (!LANE_ID.test(laneId)) return null;
  let groups: fs.Dirent[];
  try { groups = fs.readdirSync(masters, { withFileTypes: true }); } catch { return null; }
  for (const g of groups.filter((d) => d.isDirectory()).sort((a, b) => (a.name < b.name ? 1 : -1))) {
    const dir = path.join(masters, g.name, laneId);
    if (fs.existsSync(path.join(dir, 'frames.json'))) return dir;
  }
  return null;
}

interface RawFrame { file?: unknown; title?: unknown; source?: unknown; note?: unknown; before?: unknown }

function listed(dir: string): RawFrame[] {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
    const arr = Array.isArray(raw) ? raw : (raw as { frames?: unknown } | null)?.frames;
    return Array.isArray(arr) ? arr.filter((x): x is RawFrame => typeof x === 'object' && x !== null) : [];
  } catch { return []; }
}

/** The real path of `file` when it is a real file that stays inside `dir` (symlinks resolved), else null. */
function insideDir(dir: string, file: string): string | null {
  try {
    const real = fs.realpathSync(path.join(dir, file));
    const rel = path.relative(fs.realpathSync(dir), real);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) && fs.statSync(real).isFile() ? real : null;
  } catch { return null; }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

export function readFrames(masters: string | undefined, laneId: string, urlOf: (file: string) => string): LaneFrame[] {
  if (!masters) return [];
  const dir = laneFramesDir(masters, laneId);
  if (!dir) return [];
  const out: LaneFrame[] = [];
  for (const e of listed(dir)) {
    const file = str(e.file);
    if (!file || !isSafeFrameName(file) || !insideDir(dir, file)) continue;
    const before = str(e.before);
    const beforeOk = before !== undefined && isSafeFrameName(before) && insideDir(dir, before) !== null;
    const source = str(e.source);
    const note = str(e.note);
    out.push({
      file, title: str(e.title) ?? file,
      ...(source ? { source } : {}), ...(note ? { note } : {}),
      url: urlOf(file),
      ...(beforeOk ? { before, beforeUrl: urlOf(before) } : {}),
    });
    if (out.length >= MAX_FRAMES) break;
  }
  return out;
}

export type FrameRead = { ok: true; bytes: Buffer; mime: string } | { ok: false; status: 400 | 404; reason: string };

/** The door: a frame is served only when this lane's frames.json names it. */
export function readFrameFile(masters: string | undefined, laneId: string, file: string): FrameRead {
  if (!masters) return { ok: false, status: 404, reason: 'no masters folder configured' };
  if (!LANE_ID.test(laneId) || !isSafeFrameName(file)) return { ok: false, status: 400, reason: 'bad lane or file name' };
  const dir = laneFramesDir(masters, laneId);
  if (!dir) return { ok: false, status: 404, reason: 'no frames.json for this lane' };
  if (!listed(dir).some((e) => e.file === file || e.before === file)) return { ok: false, status: 404, reason: 'not listed in frames.json' };
  const real = insideDir(dir, file);
  if (!real) return { ok: false, status: 404, reason: 'file not found in the lane folder' };
  return { ok: true, bytes: fs.readFileSync(real), mime: mimeOf(file) as string };
}
