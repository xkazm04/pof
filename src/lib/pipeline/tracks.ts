/**
 * Production pipeline model (ECW addendum 13.2). An entity is "playable" only
 * when every production track its catalog requires is `done`. Tracks are the
 * parallel dimensions of work (gameplay logic, AI, art, animation, audio, vfx)
 * plus the functional-test gate. Pure module — no React, no icons (the UI maps
 * track ids → icons).
 */

export type PipelineTrackId =
  | 'logic'
  | 'ai'
  | 'art-2d'
  | 'art-3d'
  | 'animation'
  | 'audio'
  | 'vfx'
  | 'test';

export type TrackState = 'not-started' | 'in-progress' | 'done' | 'blocked';

export const TRACK_STATES: TrackState[] = ['not-started', 'in-progress', 'done', 'blocked'];

export interface PipelineTrackDef {
  id: PipelineTrackId;
  label: string;
  /** One-line description of what this track delivers. */
  hint: string;
}

export const ALL_TRACKS: PipelineTrackDef[] = [
  { id: 'logic', label: 'Logic', hint: 'Gameplay C++/Blueprint — the ability, item, loot roll, or widget code.' },
  { id: 'ai', label: 'AI', hint: 'Behavior tree, perception, decision logic.' },
  { id: 'art-2d', label: '2D Art', hint: 'Icons, UI textures, portraits.' },
  { id: 'art-3d', label: '3D Art', hint: 'Meshes, materials, world geometry.' },
  { id: 'animation', label: 'Animation', hint: 'Montages, state machines, retargeting.' },
  { id: 'audio', label: 'Audio', hint: 'SFX, music cues, footsteps.' },
  { id: 'vfx', label: 'VFX', hint: 'Niagara particle effects, hit/impact FX.' },
  { id: 'test', label: 'Test Gate', hint: 'Functional test proves it works in-engine.' },
];

/** Which production tracks each catalog's entities require, in delivery order. */
export const PIPELINE_BY_CATALOG: Record<string, PipelineTrackId[]> = {
  spellbook: ['logic', 'art-2d', 'animation', 'vfx', 'audio', 'test'],
  items: ['logic', 'art-2d', 'art-3d', 'test'],
  'loot-tables': ['logic', 'test'],
  bestiary: ['logic', 'ai', 'art-3d', 'animation', 'audio', 'test'],
  'combat-map': ['logic', 'animation', 'test'],
  'screen-flow': ['logic', 'art-2d', 'test'],
  'zone-map': ['logic', 'art-3d', 'test'],
  'state-graph': ['animation', 'test'],
  materials: ['art-3d', 'test'],
  audio: ['audio', 'test'],
  'animation-assets': ['animation', 'test'],
};

const DEFAULT_PIPELINE: PipelineTrackId[] = ['logic', 'test'];

/** The track sequence a catalog's entities must complete. Unknown → logic+test. */
export function pipelineForCatalog(catalogId: string): PipelineTrackId[] {
  return PIPELINE_BY_CATALOG[catalogId] ?? DEFAULT_PIPELINE;
}

const LABEL_BY_ID = new Map(ALL_TRACKS.map((t) => [t.id, t.label]));
const HINT_BY_ID = new Map(ALL_TRACKS.map((t) => [t.id, t.hint]));

export function trackLabel(id: PipelineTrackId): string {
  return LABEL_BY_ID.get(id) ?? id;
}

export function trackHint(id: PipelineTrackId): string {
  return HINT_BY_ID.get(id) ?? '';
}
