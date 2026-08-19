/**
 * Pure model for MEASURING `generated/` — the ~1 GB tree that has no prune, cap or
 * LRU anywhere. Phase 1 of the retention work: this module can categorise the tree,
 * decide what is provably referenced, and cost a retention policy. It DELETES
 * NOTHING, and deliberately exposes no path that could.
 *
 * The honesty rule this file exists to enforce: **"orphaned" is a claim, not a
 * default.** A file is only ever `unreferenced` when it was absent from every
 * referrer that was actually scanned AND no serving route can enumerate it without
 * a stored reference. If any referrer channel failed, or the file lives somewhere
 * the scan cannot reason about, it is `unknown` — a finding for the operator, never
 * a prune candidate. A plan that overstates what is dead is exactly the kind of
 * claim this campaign removes.
 *
 * Consumed by `scripts/generated-tree-report.ts`, which supplies the real I/O.
 */

import { ASSET_DIRS } from '@/lib/visual-gen/generated-assets';
import { safeIconName } from '@/lib/visual-gen/generated-icons';

/** One file on disk, path relative to `generated/` with `/` separators. */
export interface TreeFile {
  path: string;
  sizeBytes: number;
  mtimeMs: number;
}

/**
 * What KIND of thing a file is, within its provider dir.
 *
 * `attempt` is deliberately NOT called "rejected": `generated-assets.ts` records
 * that attempt 2 is the DELIVERED mesh whenever attempt 1 failed the gate, and
 * nothing on disk says which one the job handed over. It is a separate bucket so
 * the operator can see the bytes, not so a policy can assume they are garbage.
 */
export type Bucket = 'mesh' | 'attempt' | 'preview' | 'image' | 'metadata' | 'unaddressable' | 'other';

export interface CategorizedFile extends TreeFile {
  /** Top-level dir under `generated/` — the provider/campaign that wrote it. */
  group: string;
  bucket: Bucket;
  /** Basename, e.g. `bestof_fg070.preview.png`. */
  base: string;
  /** Lowercased extension without the dot, or '' when there is none. */
  ext: string;
}

const MESH_EXT = new Set(['glb', 'gltf', 'fbx', 'obj', 'usd', 'usdz']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'tga', 'bmp', 'exr']);
const META_EXT = new Set(['json', 'txt', 'md', 'yaml', 'yml', 'csv']);

/** Split a `generated/`-relative path into its parts. Pure. */
export function categorize(f: TreeFile): CategorizedFile {
  const parts = f.path.split('/').filter(Boolean);
  const group = parts.length > 1 ? parts[0] : '(root)';
  const base = parts[parts.length - 1] ?? f.path;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';

  let bucket: Bucket;
  if (parts.includes('_unaddressable')) bucket = 'unaddressable';
  else if (attemptIndex(base) !== undefined) bucket = 'attempt';
  else if (/\.preview\.png$/i.test(base)) bucket = 'preview';
  else if (MESH_EXT.has(ext)) bucket = 'mesh';
  else if (IMAGE_EXT.has(ext)) bucket = 'image';
  else if (META_EXT.has(ext)) bucket = 'metadata';
  else bucket = 'other';

  return { ...f, group, bucket, base, ext };
}

/**
 * The `_aN` retry index the cloud job store writes, for meshes AND their previews.
 * Widened from `generated-assets.attemptOf` (which only reads `.glb`/`.gltf`) so an
 * attempt's thumbnail is bucketed with the attempt it belongs to. Pure.
 */
export function attemptIndex(base: string): number | undefined {
  const m = base.match(/_a(\d+)(?:\.preview)?\.[A-Za-z0-9]+$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

export interface CategoryRow {
  key: string;
  group: string;
  bucket: Bucket;
  count: number;
  bytes: number;
}

/** Per `(group, bucket)` counts and byte totals, largest first. Pure. */
export function summarize(files: CategorizedFile[]): { rows: CategoryRow[]; count: number; bytes: number } {
  const byKey = new Map<string, CategoryRow>();
  for (const f of files) {
    const key = `${f.group}/${f.bucket}`;
    const row = byKey.get(key) ?? { key, group: f.group, bucket: f.bucket, count: 0, bytes: 0 };
    row.count += 1;
    row.bytes += f.sizeBytes;
    byKey.set(key, row);
  }
  const rows = [...byKey.values()].sort((a, b) => b.bytes - a.bytes);
  return {
    rows,
    count: files.length,
    bytes: files.reduce((n, f) => n + f.sizeBytes, 0),
  };
}

/* ── Reference classification ─────────────────────────────────────────────── */

/**
 * Everything the scan found that NAMES a generated file, plus an honest record of
 * which referrer channels actually ran. A channel that failed does not silently
 * shrink the reference set — it downgrades every would-be verdict to `unknown`.
 */
export interface ReferenceIndex {
  /** Basenames referenced, e.g. `pof_characters_vael.glb`. */
  names: ReadonlySet<string>;
  /** Where each basename was seen — for the report, so a claim is checkable. */
  sources: ReadonlyMap<string, readonly string[]>;
  /** Referrer channels that ran to completion (e.g. `pipeline_artifacts`, `repo-source`). */
  scanned: readonly string[];
  /** Channels that were expected but could NOT be read. Non-empty ⇒ nothing is provable. */
  failed: readonly string[];
}

export type RefClass =
  /** A scanned referrer names this exact file. */
  | 'referenced'
  /** No stored reference, but a serving route ENUMERATES it, so the app can surface it. */
  | 'reachable'
  /** Absent from every scanned referrer AND enumerable by nothing. The only prune-eligible class. */
  | 'unreferenced'
  /** Not provable — a referrer channel failed. Never a prune candidate. */
  | 'unknown';

export interface ClassifiedFile extends CategorizedFile {
  refClass: RefClass;
  /** Why the file got this class, in one clause — the report prints it verbatim. */
  why: string;
}

const ENUMERATED_MESH_DIRS: ReadonlySet<string> = new Set(ASSET_DIRS.map((d) => d.dir));

/**
 * Can a serving route list this file WITHOUT any stored reference?
 *
 * Mirrors what the routes actually do, and nothing more:
 *  - `/api/visual-gen/assets` reads each allow-listed dir NON-recursively and lists
 *    `*.glb`, attaching `<base>.preview.png` only when that sibling exists.
 *  - `/api/visual-gen/icons` reads `generated/icons` NON-recursively and lists names
 *    that pass `safeIconName` — so `icons/_unaddressable/**` is outside it.
 *
 * Pure; `present` is the set of `generated/`-relative paths that exist.
 */
export function isEnumerable(f: CategorizedFile, present: ReadonlySet<string>): boolean {
  const depth = f.path.split('/').length;
  if (f.group === 'icons') return depth === 2 && safeIconName(f.base) != null;
  if (!ENUMERATED_MESH_DIRS.has(f.group) || depth !== 2) return false;
  if (/\.glb$/i.test(f.base)) return true;
  if (/\.preview\.png$/i.test(f.base)) {
    return present.has(`${f.group}/${f.base.replace(/\.preview\.png$/i, '.glb')}`);
  }
  return false;
}

/**
 * Classify one file against the scanned referrers. Pure.
 *
 * A failed referrer channel makes EVERY non-referenced verdict `unknown` — a
 * partial scan can prove a reference exists, never that one does not.
 */
export function classify(f: CategorizedFile, refs: ReferenceIndex, present: ReadonlySet<string>): ClassifiedFile {
  if (refs.names.has(f.base)) {
    const where = refs.sources.get(f.base) ?? [];
    return { ...f, refClass: 'referenced', why: `named by ${where.join(', ') || 'a scanned referrer'}` };
  }
  if (isEnumerable(f, present)) {
    return { ...f, refClass: 'reachable', why: 'listed by a serving route without needing a stored reference' };
  }
  if (refs.failed.length > 0) {
    return { ...f, refClass: 'unknown', why: `referrer scan incomplete (${refs.failed.join(', ')} unreadable)` };
  }
  return {
    ...f,
    refClass: 'unreferenced',
    why: `absent from ${refs.scanned.join(' + ')} and enumerable by no serving route`,
  };
}

/**
 * The file a SIDECAR belongs to, or null when the path is not one. Pure.
 *
 * Two couplings exist in this tree and both are load-bearing:
 *  - `<base>.preview.png` is the thumbnail the 3D listing derives from `<base>.glb`;
 *  - `<base>.fbm/<texture>` is the texture folder an FBX exporter writes beside
 *    `<base>.fbx` — the mesh is broken without it.
 *
 * A sidecar is only ever as dead as its owner: pricing one for removal while the
 * owner lives would break a working asset, which is a worse outcome than the bytes.
 */
export function sidecarOwnerPath(path: string): string | null {
  const preview = path.match(/^(.*)\.preview\.png$/i);
  if (preview) return `${preview[1]}.glb`;
  const fbm = path.match(/^(.*)\.fbm\/[^/]+$/i);
  if (fbm) return `${fbm[1]}.fbx`;
  return null;
}

/**
 * Classify a whole tree, then let every sidecar inherit its owner's verdict. Pure.
 *
 * Inheritance runs after the direct pass so a sidecar can never be called
 * unreferenced while the mesh it belongs to is referenced or reachable.
 */
export function classifyTree(
  files: CategorizedFile[],
  refs: ReferenceIndex,
  present: ReadonlySet<string>,
): ClassifiedFile[] {
  const direct = files.map((f) => classify(f, refs, present));
  const byPath = new Map(direct.map((f) => [f.path, f]));

  return direct.map((f) => {
    if (f.refClass === 'referenced') return f;
    const ownerPath = sidecarOwnerPath(f.path);
    const owner = ownerPath ? byPath.get(ownerPath) : undefined;
    if (!owner || owner.refClass === f.refClass) return f;
    if (owner.refClass === 'unreferenced') return f; // no upgrade to inherit
    return { ...f, refClass: owner.refClass, why: `sidecar of ${ownerPath}, which is ${owner.refClass}` };
  });
}

export interface ClassSummary {
  refClass: RefClass;
  count: number;
  bytes: number;
}

/** Counts and bytes per reference class, in ladder order. Pure. */
export function summarizeClasses(files: ClassifiedFile[]): ClassSummary[] {
  const order: RefClass[] = ['referenced', 'reachable', 'unknown', 'unreferenced'];
  return order.map((refClass) => {
    const of = files.filter((f) => f.refClass === refClass);
    return { refClass, count: of.length, bytes: of.reduce((n, f) => n + f.sizeBytes, 0) };
  });
}

export interface GroupSummary {
  group: string;
  count: number;
  bytes: number;
  unreferenced: number;
  unreferencedBytes: number;
  /** True when NOTHING in the dir is referenced or reachable. */
  wholeGroupUnreferenced: boolean;
}

/**
 * Per top-level dir, how much of it nothing PoF can see is using. Pure.
 *
 * `wholeGroupUnreferenced` is the signal worth acting on FIRST, and not by
 * deleting: a dir where nothing at all is referenced is usually a dir whose
 * consumer is outside the scan (a hand-import into the UE project, an operator's
 * working set), not a dir full of garbage. It marks where phase 2 needs a real
 * referrer channel before any policy could be trusted there.
 */
export function summarizeGroups(files: ClassifiedFile[]): GroupSummary[] {
  const byGroup = new Map<string, ClassifiedFile[]>();
  for (const f of files) {
    const list = byGroup.get(f.group) ?? [];
    list.push(f);
    byGroup.set(f.group, list);
  }
  return [...byGroup.entries()]
    .map(([group, list]) => {
      const un = list.filter((f) => f.refClass === 'unreferenced');
      return {
        group,
        count: list.length,
        bytes: list.reduce((n, f) => n + f.sizeBytes, 0),
        unreferenced: un.length,
        unreferencedBytes: un.reduce((n, f) => n + f.sizeBytes, 0),
        wholeGroupUnreferenced: list.length > 0 && un.length === list.length,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

/* ── Dry-run prune plans ──────────────────────────────────────────────────── */

export interface PrunePolicy {
  id: string;
  /** What it would remove, in one line. */
  what: string;
  /**
   * What the operator must decide before this policy could ever run. Every policy
   * has one: phase 1 chooses nothing, it only prices the options.
   */
  caveat: string;
  /**
   * True when the policy deliberately prices files that are still LIVE (referenced
   * or route-reachable). Only the retry-attempt bucket does this, because sizing it
   * is the whole question the operator asked — and a plan that includes live files
   * must say so at the top rather than in a footnote.
   */
  pricesLiveFiles?: boolean;
  select: (files: ClassifiedFile[], ctx: PruneContext) => ClassifiedFile[];
}

export interface PruneContext {
  /** Reference clock for age-based policies, so a plan is reproducible in a test. */
  now: number;
  /** Age threshold in days for the stale policy. */
  staleDays: number;
  present: ReadonlySet<string>;
}

export interface PrunePlan {
  policy: string;
  what: string;
  caveat: string;
  files: ClassifiedFile[];
  count: number;
  bytes: number;
  /** How many of the selected files are still referenced or route-reachable. */
  liveSelected: number;
}

const DAY_MS = 86_400_000;

/**
 * The retention options worth pricing, each stated as what it WOULD remove.
 *
 * No policy here is endorsed and none is applied. Phase 2 owes the operator's
 * choice among them (plus whatever they add) and the executor that acts on it.
 */
export const PRUNE_POLICIES: readonly PrunePolicy[] = [
  {
    id: 'unreferenced',
    what: 'every file provably unreferenced by the scanned referrers and enumerable by no route',
    caveat:
      'The scan sees this repo and this SQLite DB. It does not see the UE project tree, the ' +
      'operator\'s own use, or any external script — so "unreferenced" means unreferenced by ' +
      'everything PoF can observe, not unused.',
    select: (files) => files.filter((f) => f.refClass === 'unreferenced'),
  },
  {
    id: 'stale-unreferenced',
    what: 'unreferenced files older than the age threshold',
    caveat: 'Same blind spots as `unreferenced`, narrowed by mtime — which a copy or restore resets.',
    select: (files, ctx) =>
      files.filter((f) => f.refClass === 'unreferenced' && ctx.now - f.mtimeMs > ctx.staleDays * DAY_MS),
  },
  {
    id: 'orphan-previews',
    what: 'preview thumbnails whose .glb is gone',
    caveat:
      'The 3D listing derives a preview from its mesh, so a preview with no mesh can never be ' +
      'served — but it may still be the only surviving image of a deleted mesh.',
    select: (files, ctx) =>
      files.filter(
        (f) =>
          /\.preview\.png$/i.test(f.base) &&
          f.refClass !== 'referenced' &&
          !ctx.present.has(`${f.group}/${f.base.replace(/\.preview\.png$/i, '.glb')}`),
      ),
  },
  {
    id: 'retry-attempts',
    what: 'every `_aN` retry file (N ≥ 2), INCLUDING ones still live in the gallery',
    caveat:
      'REQUIRES ADJUDICATION — nothing on disk records which attempt the job handed over. ' +
      'Attempt 2 IS the delivered mesh whenever attempt 1 failed the gate, so this policy can ' +
      'destroy the shipped asset. It is also the ONE policy here that prices live files: a ' +
      'top-level attempt in an allow-listed dir is listed by the 3D gallery today. Priced to ' +
      'size the bucket, not to be run.',
    pricesLiveFiles: true,
    select: (files) => files.filter((f) => f.bucket === 'attempt' && f.refClass !== 'referenced'),
  },
];

/** Cost one policy. Returns what it WOULD remove; there is no execution path. Pure. */
export function prunePlan(policy: PrunePolicy, files: ClassifiedFile[], ctx: PruneContext): PrunePlan {
  const selected = policy.select(files, ctx);
  return {
    policy: policy.id,
    what: policy.what,
    caveat: policy.caveat,
    files: selected,
    count: selected.length,
    bytes: selected.reduce((n, f) => n + f.sizeBytes, 0),
    liveSelected: selected.filter((f) => f.refClass === 'referenced' || f.refClass === 'reachable').length,
  };
}

/** Cost every policy against one classified tree. Pure. */
export function allPrunePlans(files: ClassifiedFile[], ctx: PruneContext): PrunePlan[] {
  return PRUNE_POLICIES.map((p) => prunePlan(p, files, ctx));
}

/* ── Reference extraction ─────────────────────────────────────────────────── */

/**
 * Filename-shaped tokens in an arbitrary blob of text (a DB row, a source file).
 * Extraction is by SHAPE and then intersected with what is actually on disk, so a
 * name is never guessed at — `%20`-style escapes are decoded first because artifact
 * URLs store `encodeURIComponent` output. Pure.
 */
export function referencedNames(text: string, onDisk: ReadonlySet<string>): string[] {
  if (!text) return [];
  let decoded = text;
  if (text.includes('%')) {
    try {
      decoded = decodeURIComponent(text);
    } catch {
      decoded = text; // a lone `%` is not a reason to skip the row
    }
  }
  const hits = new Set<string>();
  for (const m of decoded.matchAll(/[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]{2,5}/g)) {
    if (onDisk.has(m[0])) hits.add(m[0]);
  }
  return [...hits];
}
