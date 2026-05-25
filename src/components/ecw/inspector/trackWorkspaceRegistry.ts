import type { ComponentType } from 'react';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { DefaultTrackWorkspace } from '@/components/ecw/pipeline/workspaces/DefaultTrackWorkspace';

export interface TrackWorkspaceProps {
  entity: StoredCatalogEntity;
  trackId: PipelineTrackId;
}
export type TrackWorkspace = ComponentType<TrackWorkspaceProps>;

const registry = new Map<string, TrackWorkspace>();
const key = (catalogId: string, trackId: string) => `${catalogId}::${trackId}`;

/**
 * Register a track workspace for a catalog (or `'*'` for any catalog). Mirrors
 * the facetRegistry pattern — workspaces self-register via side-effect imports.
 */
export function registerTrackWorkspace(catalogId: string, trackId: PipelineTrackId, Component: TrackWorkspace): void {
  registry.set(key(catalogId, trackId), Component);
}

/** Resolve: exact `(catalogId,trackId)` → wildcard `('*',trackId)` → DefaultTrackWorkspace. */
export function getTrackWorkspace(catalogId: string, trackId: PipelineTrackId): TrackWorkspace {
  return registry.get(key(catalogId, trackId)) ?? registry.get(key('*', trackId)) ?? DefaultTrackWorkspace;
}
