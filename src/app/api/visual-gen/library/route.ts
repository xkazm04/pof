/**
 * GET  /api/visual-gen/library  → list tracked assets (with filters)
 * POST /api/visual-gen/library  → record a downloaded asset (upsert)
 *
 * Query params for GET: q, source, category, favorites=1, collectionId.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { getLibraryDb } from '@/lib/visual-gen/library-db-conn';
import { listLibraryAssets, recordAsset, type RecordAssetInput } from '@/lib/visual-gen/asset-library-db';
import type { LibraryFilter, AssetSource, AssetCategory } from '@/types/asset-library';

// Keyed by the unions, so a new member fails typecheck until it is listed here.
const SOURCES: Record<AssetSource, true> = { polyhaven: true, ambientcg: true };
const CATEGORIES: Record<AssetCategory, true> = { hdris: true, textures: true, models: true, materials: true };
const isSource = (v: unknown) => typeof v === 'string' && Object.hasOwn(SOURCES, v);
const isCategory = (v: unknown) => typeof v === 'string' && Object.hasOwn(CATEGORIES, v);

export const GET = withRoute(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get('source');
  const category = searchParams.get('category');
  if (source !== null && source !== 'all' && !isSource(source)) return apiError(`Unknown source: ${source}`, 400);
  if (category !== null && category !== 'all' && !isCategory(category)) return apiError(`Unknown category: ${category}`, 400);
  const filter: LibraryFilter = {
    query: searchParams.get('q') ?? undefined,
    source: (source as AssetSource | 'all' | null) ?? undefined,
    category: (category as AssetCategory | 'all' | null) ?? undefined,
    favoritesOnly: searchParams.get('favorites') === '1',
    collectionId: searchParams.get('collectionId') ?? undefined,
  };
  return apiSuccess(listLibraryAssets(getLibraryDb(), filter));
}, 'Failed to list library assets');

export const POST = withRoute(async (request: NextRequest) => {
  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as Partial<RecordAssetInput>;
  if (!body.assetId || !body.name || !body.source || !body.category) {
    return apiError('assetId, name, source, and category are required', 400);
  }
  if (typeof body.assetId !== 'string' || typeof body.name !== 'string') {
    return apiError('assetId and name must be strings', 400);
  }
  if (!isSource(body.source)) return apiError(`Unknown source: ${String(body.source)}`, 400);
  if (!isCategory(body.category)) return apiError(`Unknown category: ${String(body.category)}`, 400);
  for (const key of ['license', 'thumbnailUrl', 'downloadUrl'] as const) {
    if (body[key] !== undefined && typeof body[key] !== 'string') return apiError(`${key} must be a string`, 400);
  }
  if (body.tags !== undefined && !(Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string'))) {
    return apiError('tags must be an array of strings', 400);
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
