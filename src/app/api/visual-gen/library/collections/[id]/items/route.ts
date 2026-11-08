/**
 * POST   /api/visual-gen/library/collections/:id/items  → add an asset ({ assetId })
 * DELETE /api/visual-gen/library/collections/:id/items?assetId=…  → remove an asset
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { addAssetToCollection, removeAssetFromCollection } from '@/lib/visual-gen/asset-library-db';

interface RouteCtx { params: Promise<{ id: string }> }

export const POST = withRoute(async (request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const body = await readJsonObject(request);
  if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
  const { assetId } = body;
  if (typeof assetId !== 'string' || !assetId) return apiError('assetId is required', 400);
  const added = addAssetToCollection(getLibraryDb(), id, assetId);
  return apiSuccess({ collectionId: id, assetId, added });
}, 'Failed to add asset to collection');

export const DELETE = withRoute(async (request: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const assetId = request.nextUrl.searchParams.get('assetId');
  if (!assetId) return apiError('assetId is required', 400);
  const removed = removeAssetFromCollection(getLibraryDb(), id, assetId);
  return apiSuccess({ collectionId: id, assetId, removed });
}, 'Failed to remove asset from collection');
