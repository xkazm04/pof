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
 * collides with a code-seeded entity is refused with the collision named (400), because the
 * union in `seededEntities` resolves the code seed and the row would be silently inert.
 *
 * GET is unguarded (a read); POST/DELETE go through `requireOperator` like every other
 * privileged catalog→UE write (see `src/lib/api-auth.ts`).
 */
import type { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { listEntities, getEntity, upsertEntity, deleteEntity, type CatalogEntitySource } from '@/lib/catalog-db';
import { codeSeededEntities, entityCollisions } from '@/lib/catalog/seed';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const SOURCES: CatalogEntitySource[] = ['user', 'one-shot'];

/** GET /api/catalog-entities?catalogId=bestiary → the persisted rows + any id collisions. */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    if (!catalogId) return apiError('catalogId is required', 400);
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
 * body: { catalogId, entityId, name, source?, tags?, categoryPath?, data? }
 *
 * Idempotent on `(catalogId, entityId)`.
 */
export async function POST(req: NextRequest) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;

    const body = (await req.json()) as {
      catalogId?: string;
      entityId?: string;
      name?: string;
      source?: string;
      tags?: string[];
      categoryPath?: string[];
      data?: unknown;
    };
    const { catalogId, entityId, name } = body;
    if (!catalogId || !entityId || !name) {
      return apiError('catalogId, entityId and name are required', 400);
    }
    const source = (body.source ?? 'user') as CatalogEntitySource;
    if (!SOURCES.includes(source)) {
      return apiError(`Unknown source "${body.source}" — expected one of ${SOURCES.join(', ')}`, 400);
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
