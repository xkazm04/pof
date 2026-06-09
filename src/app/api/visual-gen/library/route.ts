/**
 * GET  /api/visual-gen/library  → list tracked assets (with filters)
 * POST /api/visual-gen/library  → record a downloaded asset (upsert)
 *
 * Query params for GET: q, source, category, favorites=1, collectionId.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { listLibraryAssets, recordAsset, type RecordAssetInput } from '@/lib/visual-gen/asset-library-db';
import type { LibraryFilter, AssetSource, AssetCategory } from '@/types/asset-library';

export const GET = withRoute(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const filter: LibraryFilter = {
    query: searchParams.get('q') ?? undefined,
    source: (searchParams.get('source') as AssetSource | 'all' | null) ?? undefined,
    category: (searchParams.get('category') as AssetCategory | 'all' | null) ?? undefined,
    favoritesOnly: searchParams.get('favorites') === '1',
    collectionId: searchParams.get('collectionId') ?? undefined,
  };
  return apiSuccess(listLibraryAssets(getLibraryDb(), filter));
}, 'Failed to list library assets');

export const POST = withRoute(async (request: NextRequest) => {
  const body = (await request.json()) as Partial<RecordAssetInput>;
  if (!body.assetId || !body.name || !body.source || !body.category) {
    return apiError('assetId, name, source, and category are required', 400);
  }
  const asset = recordAsset(getLibraryDb(), {
    assetId: body.assetId,
    name: body.name,
    source: body.source,
    category: body.category,
    license: body.license ?? '',
    thumbnailUrl: body.thumbnailUrl ?? '',
    downloadUrl: body.downloadUrl ?? '',
    tags: body.tags ?? [],
  });
  return apiSuccess(asset, 201);
}, 'Failed to record asset');
