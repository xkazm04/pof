/**
 * Download variants — the files a CC0 source actually offers for one asset, as
 * format x resolution choices with their real sizes.
 *
 * Pure: no fetch, no DOM. `asset-sources.ts` attaches ambientCG variants to the search row
 * (its search already requests `downloadData`); `/api/visual-gen/browse/files` turns the
 * Poly Haven `/files/<id>` tree into variants; the asset browser's picker offers them.
 *
 * Why this exists: the browser's Download used to open the search row's `downloadUrl` — for
 * Poly Haven that is `api.polyhaven.com/files/<id>`, a 20 KB JSON LISTING, which the library
 * then recorded as the acquired asset (and pipeline prompts cited as "already downloaded");
 * for ambientCG it was the first of 8 zips (9.8 MB .. 1.09 GB) with the sizes thrown away.
 */

export interface VariantFile {
  /** The filename the file is saved under (flat — no folders). */
  path: string;
  url: string;
  bytes: number;
  /** For a glTF include: the URI the .gltf references it by (`textures/x_1k.jpg`). */
  ref?: string;
}

export interface DownloadVariant {
  /** Stable within one asset, e.g. `2k-gltf`, `1K-JPG`. */
  id: string;
  /** What the picker shows, e.g. `2K glTF`, `1K HDR`, `1K JPG maps`, `8K-PNG`. */
  label: string;
  /** `gltf` | `hdr` | `exr` | `jpg` | `png` | `zip` | ... */
  format: string;
  /** `1k`, `2k`, ... (ambientCG: parsed from its attribute, `8K-PNG` -> `8k`). */
  resolution: string;
  files: VariantFile[];
  totalBytes: number;
  /** The file that names the acquisition: the .gltf, the single file, or the diffuse map. */
  mainUrl: string;
}

// ── Listings ────────────────────────────────────────────────────────────────

/** A URL that answers a JSON description of files rather than a file. */
export function isListingUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.hostname === 'api.polyhaven.com') return true;
  return u.hostname === 'ambientcg.com' && u.pathname.startsWith('/api/');
}

/** Poly Haven ids are slugs (`ArmChair_01`, `aarfontein_dawn_2`); anything else is refused. */
export function isValidPolyHavenId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id);
}

// ── ambientCG ───────────────────────────────────────────────────────────────

export interface AmbientCgDownload {
  downloadLink: string;
  fileName?: string;
  size?: number;
  filetype?: string;
  attribute: string;
}

/** The `downloadData` part of an ambientCG `full_json` search row. */
export interface AmbientCgDownloadRow {
  downloadFolders?: Record<string, { downloadFiletypeCategories?: Record<string, { downloads?: AmbientCgDownload[] }> }>;
}

const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** Every package ambientCG lists for the row, in API order, each with its size. */
export function ambientCgVariants(row: AmbientCgDownloadRow): DownloadVariant[] {
  const out: DownloadVariant[] = [];
  const seen = new Set<string>();
  for (const folder of Object.values(row.downloadFolders ?? {})) {
    for (const [type, cat] of Object.entries(folder.downloadFiletypeCategories ?? {})) {
      for (const d of cat.downloads ?? []) {
        if (!d.downloadLink) continue;
        const format = d.filetype || type;
        const label = seen.has(d.attribute) ? `${d.attribute} ${format}` : d.attribute;
        seen.add(d.attribute);
        const bytes = d.size ?? 0;
        const path = d.fileName || new URL(d.downloadLink).searchParams.get('file') || basename(d.downloadLink);
        out.push({
          id: label, label, format,
          resolution: /^(\d+K)/i.exec(d.attribute)?.[1].toLowerCase() ?? d.attribute,
          files: [{ path, url: d.downloadLink, bytes }],
          totalBytes: bytes,
          mainUrl: d.downloadLink,
        });
      }
    }
  }
  return out;
}

// ── Poly Haven ──────────────────────────────────────────────────────────────

interface PhFile { url: string; size: number; include?: Record<string, { url: string; size: number }> }
/** `GET https://api.polyhaven.com/files/<id>`: key -> resolution -> format -> file. */
export type PolyHavenFiles = Record<string, unknown>;

const isPhFile = (v: unknown): v is PhFile =>
  !!v && typeof v === 'object' && typeof (v as PhFile).url === 'string' && typeof (v as PhFile).size === 'number';

/** Resolutions under a key that are `Nk` tiers, smallest first. */
function tiers(node: unknown): [string, Record<string, unknown>][] {
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>)
    .filter(([k, v]) => /^\d+k$/.test(k) && !!v && typeof v === 'object')
    .map(([k, v]) => [k, v as Record<string, unknown>] as [string, Record<string, unknown>])
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));
}

const up = (res: string) => res.toUpperCase();
const single = (res: string, format: string, f: PhFile): DownloadVariant => ({
  id: `${res}-${format}`, label: `${up(res)} ${format.toUpperCase()}`, format, resolution: res,
  files: [{ path: basename(f.url), url: f.url, bytes: f.size }], totalBytes: f.size, mainUrl: f.url,
});

function gltfVariants(files: PolyHavenFiles): DownloadVariant[] {
  return tiers(files.gltf).flatMap(([res, byFormat]) => {
    const main = byFormat.gltf;
    if (!isPhFile(main)) return [];
    const bundle: VariantFile[] = [
      { path: basename(main.url), url: main.url, bytes: main.size },
      ...Object.entries(main.include ?? {}).map(([key, f]) => ({ path: basename(key), url: f.url, bytes: f.size, ref: key })),
    ];
    return [{
      id: `${res}-gltf`, label: `${up(res)} glTF`, format: 'gltf', resolution: res, files: bundle,
      totalBytes: bundle.reduce((s, f) => s + f.bytes, 0), mainUrl: main.url,
    }];
  });
}

function hdriVariants(files: PolyHavenFiles): DownloadVariant[] {
  return tiers(files.hdri).flatMap(([res, byFormat]) =>
    ['hdr', 'exr'].flatMap((fmt) => (isPhFile(byFormat[fmt]) ? [single(res, fmt, byFormat[fmt] as PhFile)] : [])));
}

const MAP_FORMATS = ['jpg', 'png', 'exr'] as const;

/** One variant per resolution x image format, holding every flat map (not the blend/gltf/mtlx bundles). */
function mapVariants(files: PolyHavenFiles): DownloadVariant[] {
  const byTier = new Map<string, Map<string, VariantFile[]>>();
  for (const node of Object.values(files)) {
    for (const [res, byFormat] of tiers(node)) {
      for (const fmt of MAP_FORMATS) {
        const f = byFormat[fmt];
        if (!isPhFile(f) || f.include) continue;
        const forRes = byTier.get(res) ?? new Map<string, VariantFile[]>();
        byTier.set(res, forRes);
        const list = forRes.get(fmt) ?? [];
        forRes.set(fmt, list);
        list.push({ path: basename(f.url), url: f.url, bytes: f.size });
      }
    }
  }
  return [...byTier.entries()]
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
    .flatMap(([res, forRes]) => MAP_FORMATS.flatMap((fmt) => {
      const list = forRes.get(fmt);
      if (!list?.length) return [];
      const main = list.find((f) => /_diff_/i.test(f.path)) ?? list[0];
      return [{
        id: `${res}-${fmt}-maps`, label: `${up(res)} ${fmt.toUpperCase()} maps`, format: fmt, resolution: res,
        files: list, totalBytes: list.reduce((s, f) => s + f.bytes, 0), mainUrl: main.url,
      }];
    }));
}

/** The Poly Haven file tree as download variants for the asset's category. */
export function polyHavenVariants(files: PolyHavenFiles, category: string): DownloadVariant[] {
  if (category === 'hdris' || (category !== 'models' && files.hdri)) return hdriVariants(files);
  if (category === 'models') return gltfVariants(files);
  return mapVariants(files);
}

// ── glTF ────────────────────────────────────────────────────────────────────

/**
 * Poly Haven's .gltf references `textures/<name>.jpg` and `<name>.bin`, but those files live
 * under other CDN folders, and a bundle is saved flat. Rewrite each `images[].uri` /
 * `buffers[].uri` that names an include to the saved filename; `data:` and unknown URIs stay.
 */
export function flattenGltfUris(gltf: Record<string, unknown>, include: Record<string, unknown>): Record<string, unknown> {
  const rewrite = (list: unknown) => Array.isArray(list)
    ? list.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const uri = (entry as { uri?: unknown }).uri;
      if (typeof uri !== 'string' || uri.startsWith('data:')) return entry;
      let key = uri;
      try { key = decodeURIComponent(uri); } catch { /* keep as written */ }
      return key in include ? { ...entry, uri: basename(key) } : entry;
    })
    : list;
  const out: Record<string, unknown> = { ...gltf };
  if ('images' in gltf) out.images = rewrite(gltf.images);
  if ('buffers' in gltf) out.buffers = rewrite(gltf.buffers);
  return out;
}

/** A glTF variant's include map, keyed by the URI its .gltf uses — the input of {@link flattenGltfUris}. */
export function gltfIncludeMap(variant: DownloadVariant): Record<string, VariantFile> {
  return Object.fromEntries(variant.files.filter((f) => f.ref).map((f) => [f.ref as string, f]));
}
