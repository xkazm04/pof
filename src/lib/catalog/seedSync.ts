/**
 * Seed drift for the browser's `pof-catalog` blob — the pure classifier between the SHIPPED code
 * seeds (`seedAllCatalogs()`) and the entity copies a browser persisted.
 *
 * The server's precedence is non-negotiable (`seed.ts`): a persisted row can never shadow a code
 * seed. The browser blob used to be the one place that did exactly that — every persisted copy
 * won forever, so a seed correction (Vael crit ×2.5, bestiary loot links 5→14) never reached a
 * returning browser and the lab previewed/graded content the server no longer holds.
 *
 * Provenance makes it decidable, exactly as `canon/canonSync.ts` does for laws: every persisted
 * copy records the content hash of the seed it was written against (`seedHashes`). A copy whose
 * content still equals that hash is provably untouched and FOLLOWS the code; a copy that moved
 * is an edit and is kept, asking only when the code moved too. Content excludes the server
 * overlays (`SEED_OVERLAY_KEYS`), which always survive a follow.
 *
 * Closed vocabulary:
 * - fresh       content equals the shipped seed — code content, overlays kept
 * - follow      untouched since its recorded hash, shipped moved — takes the code, no human step
 * - edited      moved from its recorded hash, shipped did not — kept, no finding
 * - conflict    edited AND shipped moved — kept, asks
 * - unrecorded  legacy copy (no recorded hash) that differs from shipped — kept, asks
 * - local       not a seed id and never recorded (e.g. CatalogGearTab's `user-<slug>`) — kept
 * - orphaned    recorded as a seed that no longer ships — an untouched copy is removed, an edited
 *               one kept; both reported
 */
import { contentHash, stableStringify } from '@/lib/catalog/reference/hash';
import type { CatalogEntityBase } from './types';

export type EntitiesByCatalog = Record<string, Record<string, CatalogEntityBase>>;
export type SeedVerdict = 'fresh' | 'follow' | 'edited' | 'conflict' | 'unrecorded' | 'local' | 'orphaned';
export type SeedFindingVerdict = Extract<SeedVerdict, 'conflict' | 'unrecorded' | 'orphaned'>;

/** Written by the server's lifecycle derivation, never by a seed — excluded from content. */
export const SEED_OVERLAY_KEYS = ['lifecycle', 'ueAssets', 'lastTestResult', 'lastVerifiedAt'] as const;

export interface SeedRef { catalogId: string; entityId: string }
export interface SeedPlanEntry extends SeedRef { verdict: SeedVerdict }
export interface SeedFinding extends SeedRef {
  verdict: SeedFindingVerdict;
  name: string;
  /** The browser's copy as persisted — what Keep mine restores for a removed orphan. */
  mine: CatalogEntityBase;
  /** True when the plan dropped it (an untouched copy of a retired seed). */
  removed: boolean;
}
export interface SeedMergePlan {
  entities: EntitiesByCatalog;
  /** The next `seedHashes` for every persisted copy that has provenance. */
  recorded: Record<string, string>;
  entries: SeedPlanEntry[];
  findings: SeedFinding[];
}

export const seedKey = (catalogId: string, entityId: string): string => `${catalogId}/${entityId}`;

// Entities are immutable by convention (every store action spreads), so both serializations
// are memoized per object: a partialize after a one-entity set re-serializes one entity.
const contentMemo = new WeakMap<object, string>();
const fullMemo = new WeakMap<object, string>();

/** The hash of an entity's CONTENT — every field but the server overlays. */
export function seedContentHash(entity: CatalogEntityBase): string {
  let h = contentMemo.get(entity);
  if (h === undefined) {
    const content: Record<string, unknown> = { ...entity };
    for (const k of SEED_OVERLAY_KEYS) delete content[k];
    h = contentHash(content);
    contentMemo.set(entity, h);
  }
  return h;
}

function fullText(entity: CatalogEntityBase): string {
  let s = fullMemo.get(entity);
  if (s === undefined) { s = stableStringify(entity); fullMemo.set(entity, s); }
  return s;
}

/** The shipped content with the copy's overlays laid back on. */
export function withOverlays(shipped: CatalogEntityBase, mine: CatalogEntityBase): CatalogEntityBase {
  const out: Record<string, unknown> = { ...shipped };
  for (const k of SEED_OVERLAY_KEYS) if (mine[k] !== undefined) out[k] = mine[k];
  return out as unknown as CatalogEntityBase;
}

const isFinding = (v: SeedVerdict): v is SeedFindingVerdict => v === 'conflict' || v === 'unrecorded' || v === 'orphaned';

/** Classify every persisted copy against the code seeds; code seeds not persisted ship as-is. */
export function planSeedMerge(code: EntitiesByCatalog, persisted: EntitiesByCatalog, recorded: Record<string, string>): SeedMergePlan {
  const entities: EntitiesByCatalog = {};
  for (const [catalogId, rows] of Object.entries(code)) entities[catalogId] = { ...rows };
  const next: Record<string, string> = {};
  const entries: SeedPlanEntry[] = [];
  const findings: SeedFinding[] = [];

  for (const [catalogId, rows] of Object.entries(persisted ?? {})) {
    for (const [entityId, mine] of Object.entries(rows ?? {})) {
      if (!mine || typeof mine !== 'object') continue;
      const key = seedKey(catalogId, entityId);
      const shipped = code[catalogId]?.[entityId];
      const had = recorded[key] ?? null;
      const mineHash = seedContentHash(mine);
      let verdict: SeedVerdict;
      let keep: CatalogEntityBase | null = mine;
      let nextHash: string | null = had;
      if (shipped) {
        const shippedHash = seedContentHash(shipped);
        if (mineHash === shippedHash) { verdict = 'fresh'; keep = withOverlays(shipped, mine); nextHash = shippedHash; }
        else if (had === null) verdict = 'unrecorded';
        else if (mineHash === had) { verdict = 'follow'; keep = withOverlays(shipped, mine); nextHash = shippedHash; }
        else verdict = shippedHash === had ? 'edited' : 'conflict';
      } else if (had === null) {
        verdict = 'local';
      } else {
        verdict = 'orphaned';
        if (mineHash === had) { keep = null; nextHash = null; }
      }
      if (keep) (entities[catalogId] ??= {})[entityId] = keep;
      if (nextHash) next[key] = nextHash;
      entries.push({ catalogId, entityId, verdict });
      if (isFinding(verdict)) findings.push({ catalogId, entityId, verdict, name: mine.name, mine, removed: keep === null });
    }
  }
  return { entities, recorded: next, entries, findings };
}

/**
 * What `partialize` writes: every entity that is NOT byte-equal to its code seed (overlaid
 * seeds, edits, local rows), each with the hash of the seed it was written against where that
 * is known. A pristine seed is not mirrored — it re-seeds from code on every load.
 */
export function persistableSeedState(state: EntitiesByCatalog, code: EntitiesByCatalog, recorded: Record<string, string>) {
  const entitiesByCatalog: EntitiesByCatalog = {};
  const seedHashes: Record<string, string> = {};
  for (const [catalogId, rows] of Object.entries(state)) {
    for (const [entityId, entity] of Object.entries(rows)) {
      const shipped = code[catalogId]?.[entityId];
      if (shipped && (entity === shipped || fullText(entity) === fullText(shipped))) continue;
      (entitiesByCatalog[catalogId] ??= {})[entityId] = entity;
      const key = seedKey(catalogId, entityId);
      if (shipped && seedContentHash(entity) === seedContentHash(shipped)) seedHashes[key] = seedContentHash(shipped);
      else if (recorded[key]) seedHashes[key] = recorded[key];
    }
  }
  return { entitiesByCatalog, seedHashes };
}

export interface SeedSyncSlice { entitiesByCatalog: EntitiesByCatalog; seedHashes: Record<string, string>; seedDrift: SeedFinding[] }

/**
 * Answer findings. `adopt`: the shipped seed wins (overlays kept) and its hash is recorded; an
 * orphan is removed. `keep`: the copy stays and the CURRENT seed hash is recorded, so it reads
 * `edited` until the code moves again; a kept orphan becomes a local row (a removed one is
 * restored). Refs that name no finding are ignored.
 */
export function resolveSeedFindings(s: SeedSyncSlice, refs: SeedRef[], choice: 'adopt' | 'keep', code: EntitiesByCatalog): SeedSyncSlice {
  const wanted = new Set(refs.map((r) => seedKey(r.catalogId, r.entityId)));
  const hit = s.seedDrift.filter((f) => wanted.has(seedKey(f.catalogId, f.entityId)));
  if (hit.length === 0) return s;
  const entitiesByCatalog = { ...s.entitiesByCatalog };
  const seedHashes = { ...s.seedHashes };
  for (const f of hit) {
    const key = seedKey(f.catalogId, f.entityId);
    const shipped = code[f.catalogId]?.[f.entityId];
    const rows = { ...(entitiesByCatalog[f.catalogId] ?? {}) };
    const cur = rows[f.entityId] ?? f.mine;
    if (shipped) {
      if (choice === 'adopt') rows[f.entityId] = withOverlays(shipped, cur);
      seedHashes[key] = seedContentHash(shipped);
    } else {
      if (choice === 'adopt') delete rows[f.entityId];
      else rows[f.entityId] = cur;
      delete seedHashes[key];
    }
    entitiesByCatalog[f.catalogId] = rows;
  }
  const done = new Set(hit.map((f) => seedKey(f.catalogId, f.entityId)));
  return { entitiesByCatalog, seedHashes, seedDrift: s.seedDrift.filter((f) => !done.has(seedKey(f.catalogId, f.entityId))) };
}
