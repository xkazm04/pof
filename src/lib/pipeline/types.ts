import type { PipelineTrackId, TrackState } from './tracks';

/** A persisted production-track state for one (entity, track). */
export interface PipelineTrackRecord {
  catalogId: string;
  entityId: string;
  trackId: PipelineTrackId;
  state: TrackState;
  note?: string;
  updatedAt?: string;
}
