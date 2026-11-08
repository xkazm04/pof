import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { listMaterials, createMaterial, updateMaterial, deleteMaterial } from '@/lib/visual-gen/material-db';

/**
 * Saved Material Lab presets. Backs `useMaterialStore`'s preset list — the lab
 * loads through GET on mount, writes through POST and drops through DELETE, so
 * a preset survives a reload.
 *
 * Every failure path reports the REAL reason (a swallowed message would surface
 * in the lab as a blank preset list, which reads as "no presets" rather than
 * "the save failed").
 */

function reason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isParamsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * GET /api/visual-gen/materials
 * List all saved material presets.
 */
export async function GET() {
  try {
    const materials = listMaterials();
    return apiSuccess(materials);
  } catch (error) {
    return apiError(reason(error, 'Failed to list materials'));
  }
}

/**
 * POST /api/visual-gen/materials
 * Create a new material preset.
 * Body: { id, name, params }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { id, name, params } = body;

    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name || !params) {
      return apiError('Missing required fields: id, name, params', 400);
    }
    if (!isParamsObject(params)) {
      return apiError('params must be an object of material parameters', 400);
    }

    const material = createMaterial(id, name, params);
    return apiSuccess(material, 201);
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return apiError(reason(error, 'A material with this id already exists'), 409);
    }
    return apiError(reason(error, 'Failed to create material'));
  }
}

/**
 * PUT /api/visual-gen/materials
 * Update an existing material preset.
 * Body: { id, name?, params? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { id, name, params } = body;

    if (typeof id !== 'string' || !id) {
      return apiError('Missing required field: id', 400);
    }
    if (name !== undefined && typeof name !== 'string') {
      return apiError('name must be a string', 400);
    }
    if (params !== undefined && !isParamsObject(params)) {
      return apiError('params must be an object of material parameters', 400);
    }

    const material = updateMaterial(id, { name, params });
    if (!material) {
      return apiError('Material not found', 404);
    }

    return apiSuccess(material);
  } catch (error) {
    return apiError(reason(error, 'Failed to update material'));
  }
}

/**
 * DELETE /api/visual-gen/materials
 * Delete a material preset.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { id } = body;

    if (typeof id !== 'string' || !id) {
      return apiError('Missing required field: id', 400);
    }

    const deleted = deleteMaterial(id);
    if (!deleted) {
      return apiError('Material not found', 404);
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(reason(error, 'Failed to delete material'));
  }
}
