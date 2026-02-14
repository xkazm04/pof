import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getAllDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  getSummary,
} from '@/lib/level-design-db';

// GET /api/level-design
// ?id=<number> → single doc
// (no params) → all docs + summary
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
    const summary = getSummary();
    return apiSuccess({ docs, summary });
  } catch (err) {
    console.error('GET /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}

// POST /api/level-design
// Body: CreateDocPayload
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return apiError('name is required', 400);
    }
    const doc = createDoc(body);
    return apiSuccess({ doc }, 201);
  } catch (err) {
    console.error('POST /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}

// PUT /api/level-design
// Body: UpdateDocPayload
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return apiError('id is required', 400);
    }
    const doc = updateDoc(body);
    if (!doc) return apiError('Not found', 404);
    return apiSuccess({ doc });
  } catch (err) {
    console.error('PUT /api/level-design error:', err);
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
    console.error('DELETE /api/level-design error:', err);
    return apiError('Internal error', 500);
  }
}
