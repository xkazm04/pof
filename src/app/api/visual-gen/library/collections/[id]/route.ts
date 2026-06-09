/**
 * PATCH  /api/visual-gen/library/collections/:id  → rename ({ name })
 * DELETE /api/visual-gen/library/collections/:id  → delete the collection
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { renameCollection, deleteCollection } from '@/lib/visual-gen/asset-library-db';

interface RouteCtx { params: Promise<{ id: string }> }

export const PATCH = withRoute(async (request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return apiError('name is required', 400);
  const collection = renameCollection(getLibraryDb(), id, name);
  if (!collection) return apiError(`Collection not found: ${id}`, 404);
  return apiSuccess(collection);
}, 'Failed to rename collection');

export const DELETE = withRoute(async (_request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const removed = deleteCollection(getLibraryDb(), id);
  if (!removed) return apiError(`Collection not found: ${id}`, 404);
  return apiSuccess({ deleted: id });
}, 'Failed to delete collection');
