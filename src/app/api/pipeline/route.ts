import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listTracks, upsertTrack } from '@/lib/pipeline-db';
import { TRACK_STATES, ALL_TRACKS } from '@/lib/pipeline/tracks';
import type { PipelineTrackId, TrackState } from '@/lib/pipeline/tracks';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';

const KNOWN_TRACK_IDS = new Set(ALL_TRACKS.map((t) => t.id));

/** GET /api/pipeline?catalogId=bestiary&entityId=brute → PipelineTrackRecord[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    return apiSuccess(listTracks(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Pipeline GET failed', 500);
  }
}

/** POST /api/pipeline { catalogId, entityId, trackId, state, note? } → upsert */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    const trackId = body.trackId as PipelineTrackId;
    const state = body.state as TrackState;

    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    if (!KNOWN_TRACK_IDS.has(trackId)) return apiError(`Unknown trackId: ${trackId}`, 400);
    if (!TRACK_STATES.includes(state)) return apiError(`Invalid track state: ${state}`, 400);

    const record: PipelineTrackRecord = {
      catalogId,
      entityId,
      trackId,
      state,
      ...(typeof body.note === 'string' ? { note: body.note } : {}),
    };
    return apiSuccess(upsertTrack(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Pipeline POST failed', 500);
  }
}
