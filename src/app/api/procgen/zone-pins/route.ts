import { NextRequest } from 'next/server';
import { saveZonePin, listZonePins, deleteZonePin } from '@/lib/procgen-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    return apiSuccess(listZonePins());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list zone pins');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seed, params, label, zoneCount, topology } = body;
    if (typeof seed !== 'number' || !params) return apiError('seed and params are required', 400);
    const pin = saveZonePin({
      seed,
      params,
      label,
      zoneCount: typeof zoneCount === 'number' ? zoneCount : (params.zoneCount ?? 0),
      topology: typeof topology === 'string' ? topology : (params.topology ?? ''),
    });
    return apiSuccess(pin);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save zone pin');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return apiError('id query param is required', 400);
    deleteZonePin(id);
    return apiSuccess({ deleted: id });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to delete zone pin');
  }
}
