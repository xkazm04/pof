import { describe, it, expect } from 'vitest';
import {
  ALL_TRACKS,
  TRACK_STATES,
  PIPELINE_BY_CATALOG,
  pipelineForCatalog,
  trackLabel,
} from '@/lib/pipeline/tracks';

describe('pipeline tracks model', () => {
  it('defines the 8 production tracks', () => {
    expect(ALL_TRACKS.map((t) => t.id).sort()).toEqual([
      'ai', 'animation', 'art-2d', 'art-3d', 'audio', 'logic', 'test', 'vfx',
    ]);
  });

  it('every track has a non-empty label', () => {
    for (const t of ALL_TRACKS) expect(t.label.length).toBeGreaterThan(0);
  });

  it('defines the 4 track states', () => {
    expect(TRACK_STATES).toEqual(['not-started', 'in-progress', 'done', 'blocked']);
  });

  it('every catalog pipeline ends with the test gate', () => {
    for (const tracks of Object.values(PIPELINE_BY_CATALOG)) {
      expect(tracks[tracks.length - 1]).toBe('test');
    }
  });

  it('bestiary requires logic, ai, art-3d, animation, audio, test', () => {
    expect(pipelineForCatalog('bestiary')).toEqual(['logic', 'ai', 'art-3d', 'animation', 'audio', 'test']);
  });

  it('spellbook requires logic, art-2d, animation, vfx, audio, test', () => {
    expect(pipelineForCatalog('spellbook')).toEqual(['logic', 'art-2d', 'animation', 'vfx', 'audio', 'test']);
  });

  it('unknown catalog falls back to logic + test', () => {
    expect(pipelineForCatalog('not-a-catalog')).toEqual(['logic', 'test']);
  });

  it('every pipeline track id is a known track', () => {
    const known = new Set(ALL_TRACKS.map((t) => t.id));
    for (const tracks of Object.values(PIPELINE_BY_CATALOG)) {
      for (const t of tracks) expect(known.has(t)).toBe(true);
    }
  });

  it('trackLabel resolves a known id', () => {
    expect(trackLabel('art-3d')).toBe('3D Art');
    expect(trackLabel('logic')).toBe('Logic');
  });
});
