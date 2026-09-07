import { describe, it, expect } from 'vitest';
import {
  TRIPO_RIG_MODELS,
  TRIPO_RIG_TYPES,
  TRIPO_RIG_SILENT_DEFAULT,
  tripoRigModelFor,
  presetsFor,
  validateRigRequest,
} from '@/lib/visual-gen/tripo-rig-models';

/**
 * Every value asserted here was read off Tripo's own auto-rig and retarget API docs on
 * 2026-09-07 (developers.tripo3d.ai/en/docs/animations-rig and .../animations-retarget),
 * not inferred from the marketing pages or from a UI walkthrough.
 */
describe('the silent default', () => {
  it('names the biped-only model that an unpinned rig request lands on', () => {
    expect(TRIPO_RIG_SILENT_DEFAULT).toBe('v1.0-20240301');
    expect(TRIPO_RIG_MODELS[TRIPO_RIG_SILENT_DEFAULT].morphologies).toEqual(['biped']);
  });

  it('records that the multi-morphology model is NOT the default', () => {
    expect(TRIPO_RIG_MODELS['v2.5-20260210'].isApiDefault).toBe(false);
    expect(TRIPO_RIG_MODELS[TRIPO_RIG_SILENT_DEFAULT].isApiDefault).toBe(true);
  });
});

describe('tripoRigModelFor', () => {
  it('keeps biped on the model PoF has actually proven live', () => {
    // The proven end-to-end Jinx chain ran on the API default. Pinning it EXPLICITLY is
    // the fix; moving it to v2.5 would discard a proven recipe and shrink the preset
    // library from 90+ clips to 11.
    const pin = tripoRigModelFor('biped');
    expect(pin.modelVersion).toBe('v1.0-20240301');
  });

  it('pins every non-biped morphology to the model that supports it', () => {
    for (const t of TRIPO_RIG_TYPES.filter((t) => t !== 'biped')) {
      expect(tripoRigModelFor(t).modelVersion, t).toBe('v2.5-20260210');
    }
  });

  it('explains itself — a rationale a future session can act on', () => {
    expect(tripoRigModelFor('quadruped').rationale).toMatch(/v1\.0|biped[- ]only|default/i);
  });

  it('treats an unknown rig type as non-biped rather than silently rigging a human', () => {
    // @ts-expect-error — deliberately outside the union, as a stale caller would be.
    expect(tripoRigModelFor('chimera').modelVersion).toBe('v2.5-20260210');
  });
});

describe('presetsFor', () => {
  it('lists the v2.5 quadruped preset exactly as the API documents it', () => {
    expect(presetsFor('v2.5-20260210', 'quadruped')).toContain('preset:quadruped:walk');
  });

  it('gives every non-biped morphology a locomotion preset on v2.5 EXCEPT avian', () => {
    // Not an omission in this table: the retarget docs name a walk/march preset for
    // quadruped, hexapod, octopod, serpentine and aquatic, and none for avian — which is
    // riggable but has no stock clip. A bird therefore needs an external clip library or
    // authored motion after rigging, and `validateRigRequest` says exactly that.
    for (const t of TRIPO_RIG_TYPES.filter((t) => t !== 'biped' && t !== 'avian')) {
      expect(presetsFor('v2.5-20260210', t).length, t).toBeGreaterThan(0);
    }
    expect(presetsFor('v2.5-20260210', 'avian')).toEqual([]);
  });

  it('tells a caller that an avian rig has no stock clip, rather than a bare rejection', () => {
    const v = validateRigRequest({ rigType: 'avian', modelVersion: 'v2.5-20260210', animation: 'preset:fly' });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/none documented/i);
    expect(v.error).toMatch(/external clip library|authored motion/i);
  });

  it('gives a non-biped morphology NO presets on the biped-only model', () => {
    expect(presetsFor('v1.0-20240301', 'quadruped')).toEqual([]);
    expect(presetsFor('v1.0-20240301', 'avian')).toEqual([]);
  });

  it('carries the biped presets PoF has run on v1.0', () => {
    const biped = presetsFor('v1.0-20240301', 'biped');
    expect(biped).toContain('preset:run');
    expect(biped).toContain('preset:idle');
  });
});

describe('validateRigRequest — the check that makes the anatomy gate reachable', () => {
  it('accepts a correctly-paired request', () => {
    const v = validateRigRequest({ rigType: 'quadruped', modelVersion: 'v2.5-20260210' });
    expect(v.ok).toBe(true);
    expect(v.error).toBeUndefined();
  });

  it('REJECTS a quadruped rig on the biped-only model — the defeated-gate defect', () => {
    // This is the whole finding: with no model_version the API uses v1.0, which is
    // biped-only, so `animate_prerigcheck` can only ever answer "biped". The existing
    // mismatch refusal then compares biped to biped, passes, and a human skeleton is
    // fitted to a dog.
    const v = validateRigRequest({ rigType: 'quadruped', modelVersion: 'v1.0-20240301' });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/biped/i);
    expect(v.error).toMatch(/v2\.5-20260210/);
  });

  it('REJECTS an unpinned non-biped request, because unpinned means v1.0', () => {
    const v = validateRigRequest({ rigType: 'serpentine' });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/default/i);
  });

  it('accepts an unpinned biped request but says the version is implicit', () => {
    const v = validateRigRequest({ rigType: 'biped' });
    expect(v.ok).toBe(true);
    expect(v.warning).toMatch(/pin|implicit|explicit/i);
  });

  it('REJECTS an animation preset the paired model cannot play', () => {
    const v = validateRigRequest({
      rigType: 'quadruped',
      modelVersion: 'v2.5-20260210',
      animation: 'preset:run',
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/preset:quadruped:walk/);
  });

  it('accepts the quadruped preset on the quadruped pairing', () => {
    expect(
      validateRigRequest({
        rigType: 'quadruped',
        modelVersion: 'v2.5-20260210',
        animation: 'preset:quadruped:walk',
      }).ok,
    ).toBe(true);
  });

  it('does not police an unknown biped preset on v1.0 — the library is 90+ and not enumerated here', () => {
    // Honesty about the limits of this table: the v1.0 biped library is documented as
    // "90+ presets" and only the ones PoF has used are recorded, so an unrecognized
    // biped preset must not be refused on the strength of an incomplete list.
    const v = validateRigRequest({
      rigType: 'biped',
      modelVersion: 'v1.0-20240301',
      animation: 'preset:basketball_shot',
    });
    expect(v.ok).toBe(true);
  });

  it('REJECTS a biped preset for a non-biped rig even on v2.5, where the list IS complete', () => {
    expect(validateRigRequest({ rigType: 'avian', modelVersion: 'v2.5-20260210', animation: 'preset:slash' }).ok).toBe(
      false,
    );
  });
});
