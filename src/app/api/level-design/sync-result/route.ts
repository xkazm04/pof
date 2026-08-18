import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { updateDoc, getDoc } from '@/lib/level-design-db';
import { parseSyncCallback } from '@/lib/level-design/sync-report';

/**
 * POST /api/level-design/sync-result
 *
 * The landing pad for the `level-sync` CLI task's `@@CALLBACK`. Body:
 *   { docId, status, codeHash, divergences: SyncDivergence[] }
 * (`docId` arrives via the callback's staticFields, so a prompt cannot retarget
 * another document.)
 *
 * Everything is validated by `parseSyncCallback` BEFORE it reaches the database:
 * an empty or malformed body is refused with the reason, never stored. Only a
 * report that names the document, the verdict, and the code fingerprint it
 * compared against is written — which is also what makes `lastCodeHash` the
 * honest "has this ever been checked?" marker the UI reads.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Body must be valid JSON', 400);
  }

  const parsed = parseSyncCallback(body);
  if (!parsed.ok) return apiError(`Sync report rejected: ${parsed.error}`, 400);

  const { docId, status, codeHash, divergences } = parsed.data;

  try {
    if (!getDoc(docId)) return apiError(`No level design document with id ${docId}`, 404);

    const doc = updateDoc({
      id: docId,
      syncStatus: status,
      syncReport: divergences,
      lastCodeHash: codeHash,
    });
    if (!doc) return apiError(`No level design document with id ${docId}`, 404);

    return apiSuccess({ doc, divergenceCount: divergences.length }, 201);
  } catch (err) {
    logger.error('POST /api/level-design/sync-result error:', err);
    return apiError('Internal error', 500);
  }
}
