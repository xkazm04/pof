/**
 * `/api/catalog-entities` — the durable record of a USER-CREATED catalog entity.
 *
 * Why it exists: the one-shot flow created a `draft-<catalog>-<ts>` entity in the browser
 * store (`localStorage`) and wrote its ~11 pipeline artifacts to SQLite. The server could
 * then never resolve the entity again, so `listEntitySummaries` omitted it, the checker
 * context's `has()` said false, and the static-verify resolver returned `null` — a user's
 * content silently exempted itself from every gate. This route is how a client makes an
 * entity RESOLVABLE; the browser store becomes a cache of it, never the record.
 *
 * A client never writes SQLite directly, and it may not claim a code seed's id: an id that
 * collides with a code-seeded entity is refused with the collision named (409), because the
 * union in `seededEntities` resolves the code seed and the row would be silently inert.
 *
 * GET is unguarded (a read); POST/DELETE go through `requireOperator` like every other
 * privileged catalog→UE write (see `src/lib/api-auth.ts`).
 *
 * POST is also the AUTHORED-provenance door (spark gtai-uprising-project): an entity authored for
 * another game carries `{ kind: 'authored', canonProfile, authoredVia }` so `canonProfileOf` /
 * `gameOfEntity` place it in its game instead of silently falling back to PoF's. Ingest provenance
 * has its own path (`src/lib/catalog/ingest/`) and is refused here.
 */
import type { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { listEntities, listAllEntities, getEntity, upsertEntity, deleteEntity, type CatalogEntitySource } from '@/lib/catalog-db';
import { codeSeededEntities, entityCollisions } from '@/lib/catalog/seed';
import type { AuthoredProvenance, EntityProvenance, StoredCatalogEntity } from '@/lib/catalog/types';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';
import type { Result } from '@/types/result';

/**
 * DERIVED from the union, not listed beside it. A hand-written `['user','one-shot']` is a
 * valid `CatalogEntitySource[]` even when the union has grown, so widening the type left
 * this route rejecting the new member with a 400 and TypeScript saw nothing. A
 * `Record<CatalogEntitySource, …>` is exhaustive, so the next member breaks the build here
 * instead of failing at runtime.
 */
const SOURCE_DESCRIPTIONS: Record<CatalogEntitySource, string> = {
  user: 'authored in the app by an operator',
  'one-shot': 'created by the one-shot draft flow',
  ingest: 'parsed from an external game’s data tables; carries `entity.provenance`',
};
const SOURCES = Object.keys(SOURCE_DESCRIPTIONS) as CatalogEntitySource[];

/** Exhaustive over the union for the same reason as `SOURCE_DESCRIPTIONS`. */
const AUTHORED_VIA_KEYS: Record<AuthoredProvenance['authoredVia'], true> = { intake: true, user: true, 'one-shot': true };
const AUTHORED_VIA = Object.keys(AUTHORED_VIA_KEYS) as AuthoredProvenance['authoredVia'][];

/**
 * Validate a POSTed `provenance`. Only `kind: 'authored'` with a REGISTERED canon profile passes;
 * `authoredAt` defaults to now. Pure; not exported (a route file may only export its handlers).
 */
function parseAuthoredProvenance(raw: unknown): Result<AuthoredProvenance, string> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'provenance must be an object' };
  const p = raw as Record<string, unknown>;
  if (p.kind === 'ingest') {
    return { ok: false, error: 'provenance kind "ingest" is not accepted here — ingested rows come through the ingest path (src/lib/catalog/ingest)' };
  }
  if (p.kind !== 'authored') return { ok: false, error: `Unknown provenance kind "${String(p.kind)}" — expected "authored"` };
  const registered = Object.keys(CANON_PROFILES);
  if (typeof p.canonProfile !== 'string' || !registered.includes(p.canonProfile)) {
    return { ok: false, error: `Unregistered canon profile "${String(p.canonProfile)}" — registered: ${registered.join(', ')}` };
  }
  if (!AUTHORED_VIA.includes(p.authoredVia as AuthoredProvenance['authoredVia'])) {
    return { ok: false, error: `Unknown authoredVia "${String(p.authoredVia)}" — expected one of ${AUTHORED_VIA.join(', ')}` };
  }
  if (p.authoredAt !== undefined && (typeof p.authoredAt !== 'string' || Number.isNaN(Date.parse(p.authoredAt)))) {
    return { ok: false, error: 'authoredAt must be an ISO timestamp when given' };
  }
  return {
    ok: true,
    data: {
      kind: 'authored',
      canonProfile: p.canonProfile,
      authoredVia: p.authoredVia as AuthoredProvenance['authoredVia'],
      authoredAt: (p.authoredAt as string | undefined) ?? new Date().toISOString(),
    },
  };
}

/** GET /api/catalog-entities?catalogId=bestiary → the persisted rows + any id collisions; `?all=1` → every row. */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    // `?all=1` — every persisted row, for the lab's one-shot hydration of its draft cache.
    if (!catalogId && req.nextUrl.searchParams.get('all') === '1') {
      return apiSuccess({ entities: listAllEntities() });
    }
    if (!catalogId) return apiError('catalogId is required (or all=1)', 400);
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (entityId) {
      const row = getEntity(catalogId, entityId);
      return row ? apiSuccess(row) : apiError(`No persisted entity ${catalogId}/${entityId}`, 404);
    }
    return apiSuccess({ entities: listEntities(catalogId), collisions: entityCollisions(catalogId) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'catalog-entities GET failed', 500);
  }
}

/**
 * POST /api/catalog-entities
 * body: { catalogId, entityId, name, source?, tags?, categoryPath?, data?, provenance? }
 *
 * Idempotent on `(catalogId, entityId)`. `provenance` (optional) must be authored with a registered
 * canon profile (400 otherwise). A re-POST WITHOUT provenance keeps the stored one: an edit from a
 * client that does not know about games must not silently move the entity back to PoF's world.
 */
export async function POST(req: NextRequest) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;

    const body = (await req.json().catch(() => undefined)) as {
      catalogId?: string;
      entityId?: string;
      name?: string;
      source?: string;
      tags?: string[];
      categoryPath?: string[];
      data?: unknown;
      provenance?: unknown;
    } | null | undefined;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const { catalogId, entityId, name } = body;
    if (!catalogId || !entityId || !name) {
      return apiError('catalogId, entityId and name are required', 400);
    }
    // The cast above is a claim, not a check: a numeric id or a `tags: "undead"` string was
    // persisted verbatim and every reader that maps the arrays then threw on the row.
    if (typeof catalogId !== 'string' || typeof entityId !== 'string' || typeof name !== 'string') {
      return apiError('catalogId, entityId and name must be strings', 400);
    }
    for (const key of ['tags', 'categoryPath'] as const) {
      const v: unknown = body[key];
      if (v !== undefined && (!Array.isArray(v) || !v.every((s) => typeof s === 'string'))) {
        return apiError(`${key} must be an array of strings`, 400);
      }
    }
    const source = (body.source ?? 'user') as CatalogEntitySource;
    if (!SOURCES.includes(source)) {
      return apiError(`Unknown source "${body.source}" — expected one of ${SOURCES.join(', ')}`, 400);
    }
    let provenance: EntityProvenance | undefined;
    if (body.provenance !== undefined) {
      const parsed = parseAuthoredProvenance(body.provenance);
      if (!parsed.ok) return apiError(parsed.error, 400);
      provenance = parsed.data;
    } else {
      provenance = getEntity(catalogId, entityId)?.entity.provenance;
    }
    const shadowed = codeSeededEntities(catalogId).find((e) => e.id === entityId);
    if (shadowed) {
      return apiError(
        `Entity id "${entityId}" is already a code seed in catalog "${catalogId}" (“${shadowed.name}”). `
        + 'The code seed always wins, so a persisted row with this id would be inert — choose another id.',
        409,
      );
    }

    const entity: StoredCatalogEntity = {
      id: entityId,
      catalogId,
      name,
      categoryPath: body.categoryPath ?? [],
      tags: body.tags ?? [],
      lifecycle: 'planned',
      data: body.data,
      ...(provenance ? { provenance } : {}),
    };
    return apiSuccess(upsertEntity({ catalogId, entityId, source, entity }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'catalog-entities POST failed', 500);
  }
}

/**
 * DELETE /api/catalog-entities?catalogId=…&entityId=…
 *
 * Removes the entity ROW only, and reports the real `changes()` count. Its pipeline
 * artifacts are a separate, already-existing purge (`DELETE /api/pipeline-artifacts`,
 * which removes the live row, its revisions and the judge verdicts in one transaction) —
 * the discard flow calls both so a discarded entity leaves nothing orphaned.
 */
export async function DELETE(req: NextRequest) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    return apiSuccess({ deleted: deleteEntity(catalogId, entityId) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'catalog-entities DELETE failed', 500);
  }
}
