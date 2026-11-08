import { NextRequest } from 'next/server';
import { saveZonePin, listZonePins, deleteZonePin } from '@/lib/procgen-db';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

export async function GET() {
  try {
    return apiSuccess(listZonePins());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list zone pins');
  }
}

export async function POST(req: NextRequest) {
  // A malformed or non-object body is a 400, not the catch-all's default 500.
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return apiError('Body must be a JSON object', 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError('Body must be valid JSON', 400);
  }
  try {
    const { seed, params, label, zoneCount, topology } = body as {
      seed?: unknown; params?: ZoneGraphParams;
      label?: string; zoneCount?: unknown; topology?: unknown;
    };
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
    // Number(null) and Number('') are 0: a missing id used to "delete" pin 0 and report it.
    const raw = req.nextUrl.searchParams.get('id')?.trim() ?? '';
    const id = Number(raw);
    if (!raw || !Number.isInteger(id)) return apiError('id query param is required', 400);
    deleteZonePin(id);
    return apiSuccess({ deleted: id });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to delete zone pin');
  }
}
