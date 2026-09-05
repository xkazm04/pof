/**
 * Pure helpers for the generated 2D icon library (`generated/icons/`).
 *
 * These images are REAL, already-generated art: `scripts/gap-loop/batch-generate.mjs`
 * writes one file per target with the id `iconFileBase(catalogId, step[, entityId])` — so
 * the filename encodes exactly which pipeline artifact it was generated FOR.
 *
 * **The key is the artifact identity — `(catalog, entity, step)` — never a display slug.**
 * The library used to carry only `(catalogId, step)`, so art generated for ONE ENTITY was
 * structurally unaddressable: `power-icon.mjs` invented `catalog__entity__hero` names that
 * no consumer could ever match, and three such files sit preserved in
 * `generated/icons/_unaddressable/`. A filename now carries an OPTIONAL entity dimension,
 * and both shapes are first-class:
 *
 *  - `catalog__entity__step.*` → `{ catalogId, entityId, step }`, `scope: 'entity'`
 *  - anything else            → `scope: 'step'`, identified ONLY by its flat slug
 *
 * The `__` separator is the structural marker and is read from the RAW basename before
 * normalization (which collapses `__` to `_`). A legacy per-step file therefore resolves
 * byte-identically to how it always has, and is never split on a guess (`character_pipeline`
 * could split three ways).
 *
 * Matching stays RE-ENCODING, never guessing: a step's `(catalogId, label)` — plus the
 * entity id when the caller has one — is re-encoded with the generator's own rule and
 * compared to the file's slug. A file that matches nothing simply never surfaces.
 *
 * Precedence at every read site: an entity-specific icon WINS for that entity; the per-step
 * icon is the fallback; and the resolved entry always DECLARES which scope served it, so
 * "no entity art" is a stated fact rather than a silent substitution.
 *
 * Mirrors `generated-assets.ts` (the proven 3D pattern): a basename allow-list, a served
 * `/api/visual-gen/icon/<name>` url, newest first.
 */

/** Which dimension of the artifact identity a file's name structurally encodes. */
export type IconScope = 'entity' | 'step';

export interface GeneratedIcon {
  /** Basename on disk under `generated/icons/`. */
  name: string;
  /** Normalized identity key this file was generated for. */
  slug: string;
  /** `entity` when the name encodes `catalog__entity__step`, else `step`. */
  scope: IconScope;
  /** Normalized entity id — present only for `scope: 'entity'`. */
  entityId?: string;
  /** Served URL under `/api/visual-gen/icon/…`. */
  url: string;
  mtimeMs: number;
}

/** The structural identity encoded in an icon filename. */
export interface IconIdentity {
  /** The flat normalized slug — the only identity a legacy per-step name carries. */
  slug: string;
  scope: IconScope;
  /** Structural segments, present only for `scope: 'entity'` (a flat name is ambiguous). */
  catalogId?: string;
  entityId?: string;
  step?: string;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$/i;

/** The separator that marks a structural segment boundary in a filename. */
const SEP = '__';

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
 * The on-disk id a generated icon carries — the SAME expression
 * `scripts/gap-loop/power-icon-payload.mjs` uses to name the file. Pure.
 *
 * Two arguments = the per-step id, byte-identical to what it has always returned.
 * Three = the per-entity id for `(catalogId, entityId, step)`.
 */
export function iconSlug(catalogId: string, step: string, entityId?: string): string {
  return normalize(entityId ? `${catalogId}${SEP}${entityId}${SEP}${step}` : `${catalogId}${SEP}${step}`);
}

/**
 * The filename BASE (no extension) a generator must write so the icon is addressable.
 *
 * Entity-scoped names keep the literal `__` separators — they are the structural marker
 * `parseIconFileName` reads. The per-step form deliberately stays the flat, already-collapsed
 * slug: every one of the ~40 files in the library is named that way, and re-spelling it would
 * write a SECOND file for art that already exists. Pure.
 */
export function iconFileBase(catalogId: string, step: string, entityId?: string): string {
  if (!entityId) return iconSlug(catalogId, step);
  return [catalogId, entityId, step].map(normalize).join(SEP);
}

/** The identity slug encoded in an icon filename (extension stripped). Pure, unchanged. */
export function slugOfIconFile(name: string): string {
  return normalize(name.replace(/\.[^.]+$/, ''));
}

/**
 * The structural identity of an icon filename — BOTH shapes. Pure.
 *
 * Only an exact three-segment `__` split counts as entity-scoped; everything else is a
 * per-step file identified by its flat slug alone (a legacy name genuinely cannot be split).
 */
export function parseIconFileName(name: string): IconIdentity {
  const base = name.replace(/\.[^.]+$/, '');
  const slug = normalize(base);
  const seg = base.split(SEP);
  if (seg.length === 3 && seg.every((s) => s.length > 0)) {
    return { slug, scope: 'entity', catalogId: normalize(seg[0]), entityId: normalize(seg[1]), step: normalize(seg[2]) };
  }
  return { slug, scope: 'step' };
}

/** Shape the icon manifest: served url + its identity + scope, newest first. Pure. */
export function buildIconList(files: { name: string; mtimeMs: number }[]): GeneratedIcon[] {
  return files
    .filter((f) => safeIconName(f.name) != null)
    .map((f) => {
      const id = parseIconFileName(f.name);
      return {
        name: f.name,
        slug: id.slug,
        scope: id.scope,
        ...(id.entityId ? { entityId: id.entityId } : {}),
        url: `/api/visual-gen/icon/${encodeURIComponent(f.name)}`,
        mtimeMs: f.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * The icons generated FOR one pipeline step (exact slug match, step scope only). Pure.
 *
 * Entity-scoped art is deliberately excluded: showing one entity's art as the step's art
 * would attribute it to every other entity in the catalog.
 */
export function iconsForStep(icons: GeneratedIcon[], catalogId: string, step: string): GeneratedIcon[] {
  const want = iconSlug(catalogId, step);
  return icons.filter((i) => i.scope === 'step' && i.slug === want);
}

/** The icons generated FOR one entity's step (exact slug match, entity scope only). Pure. */
export function iconsForEntityStep(
  icons: GeneratedIcon[],
  catalogId: string,
  step: string,
  entityId: string,
): GeneratedIcon[] {
  const want = iconSlug(catalogId, step, entityId);
  return icons.filter((i) => i.scope === 'entity' && i.slug === want);
}

/**
 * The icons this artifact may show, in precedence order: the entity's own art when it has
 * any, else the step's. Never both — a mixed list would let a sibling entity's art pad out
 * a gallery as if it belonged here. Pure.
 */
export function iconsFor(
  icons: GeneratedIcon[],
  catalogId: string,
  step: string,
  entityId?: string,
): GeneratedIcon[] {
  if (entityId) {
    const own = iconsForEntityStep(icons, catalogId, step, entityId);
    if (own.length > 0) return own;
  }
  return iconsForStep(icons, catalogId, step);
}

/** The single newest icon for `(catalog, entity, step)` and WHICH scope served it, or null. Pure. */
export function resolveIconFor(
  icons: GeneratedIcon[],
  catalogId: string,
  step: string,
  entityId?: string,
): { name: string; url: string; scope: IconScope } | null {
  const hit = iconsFor(icons, catalogId, step, entityId)[0];
  return hit ? { name: hit.name, url: hit.url, scope: hit.scope } : null;
}
