import { NextRequest } from 'next/server';
import { apiSuccess, apiError, readJsonObject } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import {
  getAllDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  getSummary,
} from '@/lib/level-design-db';
import type { CreateDocPayload, UpdateDocPayload } from '@/types/level-design';

// GET /api/level-design
// ?id=<number> → single doc
// (no params) → all docs (the client derives its own summary)
// ?summary=1 → all docs + the server-side summary
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = getDoc(Number(id));
      if (!doc) return apiError('Not found', 404);
      return apiSuccess({ doc });
    }

    const docs = getAllDocs();
    // The summary is a second full-table read + JSON parse; the only client re-derives
    // it locally, so it is computed only when asked for.
    if (searchParams.get('summary') === '1') return apiSuccess({ docs, summary: getSummary() });
    return apiSuccess({ docs });
  } catch (err) {
    logger.error('GET /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}

/** The JSON-blob columns: a non-array stored here is read back as [] and the doc renamed broken. */
const ARRAY_FIELDS = ['rooms', 'connections', 'difficultyArc', 'syncReport'] as const;

// POST /api/level-design
// Body: CreateDocPayload
export async function POST(req: NextRequest) {
  const parsedBody = await readJsonObject(req);
  if (!parsedBody.ok) return parsedBody.error;
  const body = parsedBody.data;
  try {
    if (!body.name || typeof body.name !== 'string') {
      return apiError('name is required', 400);
    }
    const doc = createDoc(body as unknown as CreateDocPayload);
    return apiSuccess({ doc }, 201);
  } catch (err) {
    logger.error('POST /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}

// PUT /api/level-design
// Body: UpdateDocPayload
export async function PUT(req: NextRequest) {
  const parsedBody = await readJsonObject(req);
  if (!parsedBody.ok) return parsedBody.error;
  const body = parsedBody.data;
  try {
    if (!body.id) {
      return apiError('id is required', 400);
    }
    for (const field of ARRAY_FIELDS) {
      if (field in body && !Array.isArray(body[field])) {
        return apiError(`${field} must be an array`, 400);
      }
    }
    const doc = updateDoc(body as unknown as UpdateDocPayload);
    if (!doc) return apiError('Not found', 404);
    return apiSuccess({ doc });
  } catch (err) {
    logger.error('PUT /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}

// DELETE /api/level-design?id=<number>
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return apiError('id is required', 400);

    const deleted = deleteDoc(Number(id));
    if (!deleted) return apiError('Not found', 404);
    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}
