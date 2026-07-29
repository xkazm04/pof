/**
 * Pure helpers for the per-step generated 2D icon library (`generated/icons/`).
 *
 * These images are REAL, already-generated art: `scripts/gap-loop/batch-generate.mjs`
 * writes one file per `(catalogId, step)` target with the id
 * `` `${catalogId}__${step}`.replace(/[^a-z0-9]+/gi, '_') `` — so the filename encodes
 * exactly which pipeline step it was generated FOR. Until now nothing under `src/app`
 * read that directory, so the art was unreachable and the one 2D gallery fell back to
 * TripoSR *mesh* turntables captioned as icon art.
 *
 * Matching is done by RE-ENCODING a step's `(catalogId, label)` with the generator's own
 * rule and comparing to the file's normalized basename — never by guessing where the
 * catalog id ends inside the filename (which is genuinely ambiguous: `character_pipeline`
 * could split three ways). A file that matches no step simply never surfaces.
 *
 * Mirrors `generated-assets.ts` (the proven 3D pattern): a basename allow-list, a served
 * `/api/visual-gen/icon/<name>` url, newest first.
 */

export interface GeneratedIcon {
  /** Basename on disk under `generated/icons/`. */
  name: string;
  /** Normalized `(catalog, step)` key this file was generated for. */
  slug: string;
  /** Served URL under `/api/visual-gen/icon/…`. */
  url: string;
  mtimeMs: number;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$/i;

/** A safe basename to read from the whitelisted icon dir, or null. Pure. */
export function safeIconName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return NAME_RE.test(name) ? name : null;
}

/** Collapse to the generator's id alphabet: runs of non-alphanumerics → one `_`, lowercased. */
function normalize(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

/**
 * The on-disk id a generated icon for `(catalogId, step)` carries — the SAME expression
 * `scripts/gap-loop/batch-generate.mjs` uses to name the file. Pure.
 */
export function iconSlug(catalogId: string, step: string): string {
  return normalize(`${catalogId}__${step}`);
}

/** The `(catalog, step)` slug encoded in an icon filename (extension stripped). Pure. */
export function slugOfIconFile(name: string): string {
  return normalize(name.replace(/\.[^.]+$/, ''));
}

/** Shape the icon manifest: served url + its step slug, newest first. Pure. */
export function buildIconList(files: { name: string; mtimeMs: number }[]): GeneratedIcon[] {
  return files
    .filter((f) => safeIconName(f.name) != null)
    .map((f) => ({
      name: f.name,
      slug: slugOfIconFile(f.name),
      url: `/api/visual-gen/icon/${encodeURIComponent(f.name)}`,
      mtimeMs: f.mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** The icons generated FOR one pipeline step (exact slug match). Pure. */
export function iconsForStep(icons: GeneratedIcon[], catalogId: string, step: string): GeneratedIcon[] {
  const want = iconSlug(catalogId, step);
  return icons.filter((i) => i.slug === want);
}
