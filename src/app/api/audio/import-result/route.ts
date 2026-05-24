import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getLatestAudioImport, recordAudioImport } from '@/lib/audio-import-db';

export async function POST(request: NextRequest) {
  let body: { setName?: string; eventKey?: string | null; surface?: string | null; assetsImported?: number; cuePath?: string | null; wiredEvent?: string | null };
  try { body = await request.json(); } catch { return apiError('Invalid JSON body', 400); }
  if (!body.setName || typeof body.assetsImported !== 'number') {
    return apiError('Missing setName or assetsImported', 400);
  }
  const r = recordAudioImport({
    setName: body.setName,
    eventKey: body.eventKey ?? null,
    surface: body.surface ?? null,
    assetsImported: body.assetsImported,
    cuePath: body.cuePath ?? null,
    wiredEvent: body.wiredEvent ?? null,
  });
  return apiSuccess(r);
}

export async function GET() {
  return apiSuccess(getLatestAudioImport());
}
