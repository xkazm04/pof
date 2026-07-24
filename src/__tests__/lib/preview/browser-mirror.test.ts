import { describe, it, expect } from 'vitest';
import {
  MIRROR_BY_DELIVERABLE,
  mirrorSupport,
  isBrowserMirrorable,
  isPreviewHydratable,
  PREVIEW_HYDRATABLE_CATALOGS,
} from '@/lib/preview/browser-mirror';
import stepFacts from '@/lib/status/step-facts.json';

describe('browser-mirror capability map', () => {
  it('classifies the moat as never mirrorable', () => {
    expect(mirrorSupport('ue-runtime')).toBe('none');
    expect(isBrowserMirrorable('ue-runtime')).toBe(false);
  });

  it('classifies data deliverables as direct', () => {
    for (const d of ['text-config', 'graph-data', '2d-art', 'audio']) {
      expect(mirrorSupport(d)).toBe('direct');
    }
  });

  it('classifies media approximations as partial', () => {
    for (const d of ['3d-mesh', 'animation', 'vfx-particles']) {
      expect(mirrorSupport(d)).toBe('partial');
    }
  });

  it('unknown deliverable degrades to none, never a false capability', () => {
    expect(mirrorSupport('quantum-hologram')).toBe('none');
  });

  it('UE-realization steps stay moat-side even when audited as data deliverables', () => {
    expect(mirrorSupport('text-config', 'UE Packaging')).toBe('none');
    expect(mirrorSupport('text-config', 'Test Gate')).toBe('none');
    expect(mirrorSupport('audio', 'Test Gate')).toBe('none');
    expect(mirrorSupport('text-config', 'Effect Logic')).toBe('direct');
  });

  it('covers every deliverable class present in step-facts.json', () => {
    const seen = new Set(
      (stepFacts as { steps: Array<{ deliverable: string }> }).steps.map(s => s.deliverable),
    );
    for (const d of seen) {
      expect(MIRROR_BY_DELIVERABLE, `deliverable "${d}" missing from map`).toHaveProperty(d);
    }
  });

  it('hydratable catalogs are a known subset', () => {
    expect(PREVIEW_HYDRATABLE_CATALOGS).toContain('spellbook');
    expect(isPreviewHydratable('spellbook')).toBe(true);
    expect(isPreviewHydratable('combat-map')).toBe(true);
    // Group B — Characters & Motion (reviewed 2026-07-23)
    expect(isPreviewHydratable('characters')).toBe(true);
    expect(isPreviewHydratable('state-graph')).toBe(true);
    expect(isPreviewHydratable('vfx')).toBe(true);
    expect(isPreviewHydratable('player-movement')).toBe(true);
    // Still no browser path: character-pipeline's deliverables are generated meshes the
    // duel has no loader for — deliberately NOT claimed (see realization-facts.json).
    expect(isPreviewHydratable('character-pipeline')).toBe(false);
  });
});
