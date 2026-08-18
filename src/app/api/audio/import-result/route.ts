import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getLatestAudioImport,
  getLatestAudioImportForSet,
  listLatestAudioImportsBySet,
  recordAudioImport,
} from '@/lib/audio-import-db';
import { checkAudioImportPreflight } from '@/lib/audio-import-preflight';

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

/**
 * What the system actually recorded about audio imports — the Library reads this
 * to state each set's last outcome instead of implying success from a cleared
 * spinner. `bySet` omits sets that were never imported (absence IS the verdict);
 * `preflight` reports whether the UE-side importer script exists, so the panel
 * can refuse the dispatch with a reason instead of burning a CLI session.
 *
 * `?setName=` narrows to one set (`record` is that set's latest, or null).
 */
export async function GET(request: NextRequest) {
  const setName = new URL(request.url).searchParams.get('setName');
  if (setName) {
    return apiSuccess({
      record: getLatestAudioImportForSet(setName),
      preflight: checkAudioImportPreflight(),
    });
  }
  return apiSuccess({
    latest: getLatestAudioImport(),
    bySet: listLatestAudioImportsBySet(),
    preflight: checkAudioImportPreflight(),
  });
}
