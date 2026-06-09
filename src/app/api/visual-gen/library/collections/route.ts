/**
 * GET  /api/visual-gen/library/collections  → list collections (with counts)
 * POST /api/visual-gen/library/collections  → create a collection ({ name })
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { listCollections, createCollection } from '@/lib/visual-gen/asset-library-db';

export const GET = withRoute(async () => {
  return apiSuccess(listCollections(getLibraryDb()));
}, 'Failed to list collections');

export const POST = withRoute(async (request: NextRequest) => {
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return apiError('name is required', 400);
  return apiSuccess(createCollection(getLibraryDb(), name), 201);
}, 'Failed to create collection');
