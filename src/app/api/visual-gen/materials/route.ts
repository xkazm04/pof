import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listMaterials, createMaterial, updateMaterial, deleteMaterial } from '@/lib/visual-gen/material-db';

/**
 * GET /api/visual-gen/materials
 * List all saved material presets.
 */
export async function GET() {
  try {
    const materials = listMaterials();
    return apiSuccess(materials);
  } catch {
    return apiError('Failed to list materials');
  }
}

/**
 * POST /api/visual-gen/materials
 * Create a new material preset.
 * Body: { id, name, params }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, params } = body;

    if (!id || !name || !params) {
      return apiError('Missing required fields: id, name, params', 400);
    }

    const material = createMaterial(id, name, params);
    return apiSuccess(material, 201);
  } catch {
    return apiError('Failed to create material');
  }
}

/**
 * PUT /api/visual-gen/materials
 * Update an existing material preset.
 * Body: { id, name?, params? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return apiError('Missing required field: id', 400);
    }

    const material = updateMaterial(id, updates);
    if (!material) {
      return apiError('Material not found', 404);
    }

    return apiSuccess(material);
  } catch {
    return apiError('Failed to update material');
  }
}

/**
 * DELETE /api/visual-gen/materials
 * Delete a material preset.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return apiError('Missing required field: id', 400);
    }

    const deleted = deleteMaterial(id);
    if (!deleted) {
      return apiError('Material not found', 404);
    }

    return apiSuccess({ deleted: true });
  } catch {
    return apiError('Failed to delete material');
  }
}
