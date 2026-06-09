/**
 * PATCH  /api/visual-gen/library/:id  → toggle favorite ({ favorite: boolean })
 * DELETE /api/visual-gen/library/:id  → remove an asset from the library
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { setAssetFavorite, deleteLibraryAsset } from '@/lib/visual-gen/asset-library-db';

interface RouteCtx { params: Promise<{ id: string }> }

export const PATCH = withRoute(async (request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const body = (await request.json()) as { favorite?: boolean };
  if (typeof body.favorite !== 'boolean') {
    return apiError('favorite (boolean) is required', 400);
  }
  const asset = setAssetFavorite(getLibraryDb(), id, body.favorite);
  if (!asset) return apiError(`Asset not found: ${id}`, 404);
  return apiSuccess(asset);
}, 'Failed to update asset');

export const DELETE = withRoute(async (_request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const removed = deleteLibraryAsset(getLibraryDb(), id);
  if (!removed) return apiError(`Asset not found: ${id}`, 404);
  return apiSuccess({ deleted: id });
}, 'Failed to delete asset');
