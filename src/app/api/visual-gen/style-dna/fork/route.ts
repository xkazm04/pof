import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { forkStyleDna, getStyleDna } from '@/lib/visual-gen/style-dna-db';
import { validateStyleDna } from '@/lib/visual-gen/style-dna-edit';

const MAX_NAME_CHARS = 80;

/**
 * POST { fromId, name?, dna } → 201 { profile } — save an edited Style DNA as a COPY.
 *
 * Synchronous and $0: it writes one SQLite row and runs no vision call and no distillation job
 * (contrast POST /api/visual-gen/style-dna, which reads a whole mood board). The parent is kept,
 * so "Use “parent”" undoes the edit. Refusals, each with the reason:
 *   400 — no fromId, an invalid/empty dna, or a `shipped:` id (shipped canon styles are edited in code)
 *   404 — no profile with that id
 *   409 — the parent is bound to a canon profile (bound styles are edited in the canon)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { fromId?: unknown; name?: unknown; dna?: unknown };
    if (typeof body.fromId !== 'string' || !body.fromId) return apiError('Missing required field: fromId', 400);
    if (body.fromId.startsWith('shipped:')) {
      return apiError(`${body.fromId} is a shipped style — shipped canon styles are edited in code`, 400);
    }
    const dna = validateStyleDna(body.dna);
    if (!dna.ok) return apiError(dna.error, 400);

    const db = getDb();
    const parent = getStyleDna(db, body.fromId);
    if (!parent) return apiError(`no style-dna profile with id ${body.fromId}`, 404);
    if (parent.canonProfile) {
      return apiError(`“${parent.name}” is bound to canon profile ${parent.canonProfile} — bound styles are edited in the canon`, 409);
    }
    const name = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, MAX_NAME_CHARS) || `${parent.name} (edited)`;
    const profile = forkStyleDna(db, parent.id, { name, dna: dna.data });
    if (!profile) return apiError(`could not fork style-dna profile ${parent.id}`, 409);
    return apiSuccess({ profile }, 201);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to fork style-dna profile', 500);
  }
}
