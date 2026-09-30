/**
 * The icon library's ONE door — `generated/icons/` is written and read through here.
 *
 * The library has several writers (the contact-sheet cut, icon-from-mesh, and the
 * out-of-process scripts `power-icon.mjs`, `batch-generate.mjs`, `scripts/diablo/media.ts`)
 * and used to have two listers that shaped the same directory differently. Its one claim
 * about where an icon came from (`renderedFrom`) lived in an extension-stripped
 * `<base>.render.json`, so a mesh render of `x.png` also stamped a Leonardo `x.jpg`, and a
 * later overwrite of `x.png` kept the stale "this depicts the mesh" claim forever — the
 * reader checked that a sidecar was PRESENT, never that it described the current bytes.
 *
 * ── The rule: provenance is bound to the bytes it describes ─────────────────────────
 * {@link commitLibraryIcon} writes the bytes, stats them, and only then writes
 * `<name>.prov.json` (the FULL name, extension included) carrying the origin plus that
 * size + mtime. {@link readIconLibrary} accepts a record only while both still equal the
 * file's own stat; anything else — a script writer, an out-of-band overwrite, a sidecar
 * whose write failed — reads `{ kind: 'unrecorded' }`. An origin is recorded by the
 * producer at creation, never inferred later. A legacy `<base>.render.json` is still read,
 * for a `.png` only (the one extension icon-from-mesh ever wrote) and only while its `at`
 * post-dates the bytes. Nothing here renames or deletes a file; sidecars are additive.
 *
 * Both readers — `GET /api/visual-gen/icons` (cached) and `bindIconsDeps.listIconLibrary`
 * (bind-icons, settle) — call {@link readIconLibrary}, so they cannot disagree. The reader
 * is SYNC with an injectable fs because settle and bind are synchronous passes. A commit
 * drops the in-process listing cache, so an in-place overwrite (which leaves the directory
 * mtime alone) is visible on the next listing instead of after the TTL.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { stat as fsStat, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildIconList, safeIconName, type GeneratedIcon, type IconOrigin } from './generated-icons';
import { invalidateListingCache } from './generated-assets';

export type { IconOrigin };

/** The in-process listing-cache key the icons route caches under and a commit drops. */
export const ICON_LISTING_CACHE_KEY = 'icons';

const UNRECORDED: IconOrigin = { kind: 'unrecorded' };

/** `<cwd>/generated/icons` — the library root both readers and the in-app writers use. */
export function iconLibraryDir(): string {
  return join(process.cwd(), 'generated', 'icons');
}

/** The bound provenance sidecar of one icon — the FULL name, so x.png and x.jpg never share. Pure. */
export function provenanceName(iconName: string): string {
  return `${iconName}.prov.json`;
}

/** The legacy (read-only) render sidecar icon-from-mesh used to write: extension stripped. Pure. */
export function legacyRenderSidecarName(iconName: string): string {
  return `${iconName.replace(/\.[^.]+$/, '')}.render.json`;
}

/** A bound provenance record: the origin plus the stat of the bytes it describes. */
export interface IconProvenanceRecord {
  origin: IconOrigin;
  sizeBytes: number;
  mtimeMs: number;
  at: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validate an origin; a half-formed one is no claim at all. Pure. */
function parseOrigin(v: unknown): IconOrigin | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  if (o.kind === 'mesh-render' && isStr(o.renderedFrom) && isNum(o.yawDeg)) {
    return { kind: 'mesh-render', renderedFrom: o.renderedFrom, yawDeg: o.yawDeg };
  }
  if (o.kind === 'contact-sheet' && typeof o.sheetUrl === 'string' && isNum(o.cellIndex)) {
    return { kind: 'contact-sheet', sheetUrl: o.sheetUrl, cellIndex: o.cellIndex, ...(isStr(o.model) ? { model: o.model } : {}) };
  }
  return o.kind === 'unrecorded' ? UNRECORDED : null;
}

/** Read a `<name>.prov.json`; `null` for anything malformed. Pure. */
export function parseProvenance(raw: string): IconProvenanceRecord | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const origin = parseOrigin(v?.origin);
    if (!origin || !isNum(v.sizeBytes) || !isNum(v.mtimeMs)) return null;
    return { origin, sizeBytes: v.sizeBytes, mtimeMs: v.mtimeMs, at: isNum(v.at) ? v.at : 0 };
  } catch {
    return null;
  }
}

/** Read a legacy `<base>.render.json`; `null` for anything malformed (a claim missing its mesh is no claim). Pure. */
export function parseLegacyRenderSidecar(raw: string): { renderedFrom: string; yawDeg: number; at: number } | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || !isStr(v.renderedFrom) || !isNum(v.yawDeg)) return null;
    return { renderedFrom: v.renderedFrom, yawDeg: v.yawDeg, at: isNum(v.at) ? v.at : 0 };
  } catch {
    return null;
  }
}

/* ── Write ────────────────────────────────────────────────────────────────── */

export interface CommitFs {
  stat(path: string): Promise<{ size: number; mtimeMs: number }>;
  writeFile(path: string, body: string): Promise<void>;
  now(): number;
}

const nodeCommitFs: CommitFs = {
  stat: (p) => fsStat(p),
  writeFile: (p, body) => fsWriteFile(p, body, 'utf-8'),
  now: () => Date.now(),
};

export interface CommittedIcon {
  name: string;
  path: string;
  url: string;
  origin: IconOrigin;
}

/** The door's commit signature, as the in-app writers inject it. */
export type CommitLibraryIcon = (
  dir: string,
  name: string,
  write: (path: string) => Promise<void>,
  origin: IconOrigin,
) => Promise<unknown>;

/**
 * Commit one icon: `write(path)` lays the bytes, then the sidecar is bound to their stat.
 *
 * Throws what `write` throws — and then writes NO sidecar (a record beside bytes that did
 * not land is a checkable claim that checks out wrong). A sidecar write that fails after
 * the bytes landed leaves the icon reading `unrecorded`, which is the truth. The listing
 * cache is dropped whenever the bytes may have changed.
 */
export async function commitLibraryIcon(
  dir: string,
  name: string,
  write: (path: string) => Promise<void>,
  origin: IconOrigin,
  fs: CommitFs = nodeCommitFs,
): Promise<CommittedIcon> {
  if (safeIconName(name) == null) throw new Error(`"${name}" is not a servable icon name`);
  const root = dir.replace(/\\/g, '/');
  const path = `${root}/${name}`;
  try {
    await write(path);
    const s = await fs.stat(path);
    const record: IconProvenanceRecord = { origin, sizeBytes: s.size, mtimeMs: s.mtimeMs, at: fs.now() };
    await fs.writeFile(`${root}/${provenanceName(name)}`, `${JSON.stringify(record, null, 2)}\n`);
  } finally {
    invalidateListingCache(ICON_LISTING_CACHE_KEY);
  }
  return { name, path, url: `/api/visual-gen/icon/${encodeURIComponent(name)}`, origin };
}

/* ── Read ─────────────────────────────────────────────────────────────────── */

export interface LibraryReadFs {
  readdir(dir: string): string[];
  stat(path: string): { isFile(): boolean; size: number; mtimeMs: number };
  readFile(path: string): string;
}

const nodeReadFs: LibraryReadFs = {
  readdir: (d) => readdirSync(d),
  stat: (p) => statSync(p),
  readFile: (p) => readFileSync(p, 'utf-8'),
};

/** The origin of ONE file's current bytes, from the sidecars present beside it. */
function originOf(
  name: string,
  s: { size: number; mtimeMs: number },
  present: Set<string>,
  read: (sidecar: string) => string,
): IconOrigin {
  const safeRead = (f: string) => { try { return read(f); } catch { return ''; } };
  const prov = provenanceName(name);
  if (present.has(prov)) {
    const rec = parseProvenance(safeRead(prov));
    if (rec && rec.sizeBytes === s.size && rec.mtimeMs === s.mtimeMs) return rec.origin;
  }
  const legacy = legacyRenderSidecarName(name);
  if (/\.png$/i.test(name) && present.has(legacy)) {
    const old = parseLegacyRenderSidecar(safeRead(legacy));
    // `at` is whole ms; the file's mtime can carry a sub-ms fraction of the same instant.
    if (old && old.at >= Math.floor(s.mtimeMs)) {
      return { kind: 'mesh-render', renderedFrom: old.renderedFrom, yawDeg: old.yawDeg };
    }
  }
  return UNRECORDED;
}

/**
 * The shaped icon manifest of `dir`, every entry carrying the origin of its CURRENT bytes.
 * `null` when the directory cannot be read (absent library). Subdirectories (e.g.
 * `_unaddressable/`) and sidecars never appear: only servable image FILES are listed.
 */
export function readIconLibrary(dir: string, fs: LibraryReadFs = nodeReadFs): GeneratedIcon[] | null {
  let files: string[];
  try {
    files = fs.readdir(dir);
  } catch {
    return null;
  }
  const present = new Set(files);
  const stated = files.flatMap((name) => {
    if (safeIconName(name) == null) return [];
    try {
      const s = fs.stat(join(dir, name));
      if (!s.isFile()) return [];
      return [{ name, mtimeMs: s.mtimeMs, origin: originOf(name, s, present, (f) => fs.readFile(join(dir, f))) }];
    } catch {
      return [];
    }
  });
  return buildIconList(stated);
}
