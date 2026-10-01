/**
 * Check a produced rig against EVERY target skeleton at once — the projection the
 * Auto-Rig tab renders.
 *
 * Before this module the tab chose its target skeleton from three static cards
 * (`AutoRigView/index.tsx` defaulted to `ue5-mannequin`) and no UI or API surface ever
 * opened a rigged GLB: `gateRig` had 0 importers under src/app and src/components. These
 * cases pin `summarizeRigCheck`: one row per preset from `bindRigToPreset`, a
 * recommendation only when a remap target binds every required chain endpoint, and the
 * not-rigged / unreadable / anonymous states stated rather than hidden.
 *
 * Two cases read the committed real fixtures; the rest build facts in memory. No
 * Blender, no model, no network.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { summarizeRigCheck, RIG_CHECK_MORPHOLOGIES } from '@/lib/visual-gen/rig-check';
import { RIG_PRESETS, getRigPreset } from '@/lib/visual-gen/rig-presets';
import { gateRig, scoreRig, type RigFacts, type RigGateResult } from '@/lib/visual-gen/rig-gate';

const FIXTURES = join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig');

/** The 20 Mixamo source names the UE5 Mannequin table is authored against. */
const MIXAMO_20 = getRigPreset('ue5-mannequin')!.mixamoMapping.map((m) => m.sourceBone);

/** Semantic biped with no clavicles and no thighs. */
const NO_CLAV_NO_THIGH = [
  'Hips', 'Spine', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot',
];

/** A structurally clean, gated skin over `names` — only the names vary between cases. */
function gated(names: string[]): RigGateResult {
  const facts: RigFacts = {
    hasSkin: true,
    jointCount: names.length,
    jointNames: names,
    referencedJoints: names.length,
    hasInverseBindMatrices: true,
    vertexCount: 1000,
    zeroWeightVertices: 0,
    negativeWeights: 0,
    nonFiniteWeights: 0,
    maxInfluences: 4,
    weightSumMin: 1,
    weightSumMax: 1,
    weightSumMean: 1,
    morphTargetCount: 0,
    morphTargetNames: [],
  };
  return { ok: true, facts, verdict: scoreRig(facts, { morphology: 'biped' }) };
}

const row = (s: ReturnType<typeof summarizeRigCheck>, id: string) => s.rows.find((r) => r.presetId === id);

describe('summarizeRigCheck', () => {
  it('case 1: a Mixamo-named rig binds both remap targets; the first fully-bound one is recommended', () => {
    const s = summarizeRigCheck(gated(MIXAMO_20), RIG_PRESETS);
    expect(s.state).toBe('rigged');
    expect(s.naming).toBe('mixamo');
    expect(s.rows.map((r) => r.presetId)).toEqual(RIG_PRESETS.map((p) => p.id));
    expect(row(s, 'ue5-mannequin')).toMatchObject({ status: 'bound', bound: 10, required: 10, unboundChains: [] });
    expect(row(s, 'minimal-humanoid')).toMatchObject({ status: 'bound', bound: 10, required: 10 });
    expect(row(s, 'metahuman')?.status).toBe('not-applicable');
    expect(s.recommended).toBe('ue5-mannequin');
    expect(s.recommendationReason).toMatch(/ue5-mannequin/);
  });

  it('case 2: a rig missing clavicles and thighs is partial on the mannequin and names the broken chains', () => {
    const s = summarizeRigCheck(gated(NO_CLAV_NO_THIGH), RIG_PRESETS);
    expect(s.state).toBe('rigged');
    const ue5 = row(s, 'ue5-mannequin')!;
    expect(ue5.status).toBe('partial');
    expect(ue5.bound).toBeLessThan(ue5.required);
    expect(ue5.unboundChains).toEqual(expect.arrayContaining(['LeftArm', 'RightArm', 'LeftLeg', 'RightLeg']));
    expect(s.recommended).toBeNull();
    for (const chain of ['LeftArm', 'RightArm', 'LeftLeg', 'RightLeg']) {
      expect(s.recommendationReason).toContain(chain);
    }
  });

  it('case 3: an unrigged mesh is not-rigged with no rows; an unreadable file carries its error — neither recommends', () => {
    const sphere = summarizeRigCheck(gateRig(join(FIXTURES, 'unrigged_sphere.glb')), RIG_PRESETS);
    expect(sphere.state).toBe('not-rigged');
    expect(sphere.rows).toEqual([]);
    expect(sphere.message).toMatch(/no skin/);
    expect(sphere.recommended).toBeNull();

    const bad = summarizeRigCheck({ ok: false, error: 'x' }, RIG_PRESETS);
    expect(bad.state).toBe('unreadable');
    expect(bad.message).toContain('x');
    expect(bad.rows).toEqual([]);
    expect(bad.recommended).toBeNull();
    expect(bad.verdict).toBeNull();
  });

  it('case 4: a SkinTokens rig (bone_0..bone_N) is rigged but every remap row is unverifiable', () => {
    const s = summarizeRigCheck(gateRig(join(FIXTURES, 'skintokens_cube_rigged.glb')), RIG_PRESETS);
    expect(s.state).toBe('rigged');
    expect(s.naming).toBe('anonymous');
    const remap = s.rows.filter((r) => r.kind === 'remap');
    expect(remap.length).toBeGreaterThan(0);
    for (const r of remap) expect(r.status).toBe('unverifiable');
    expect(s.recommended).toBeNull();
    expect(s.recommendationReason).toMatch(/positional/);
  });

  it('exposes the seven morphologies the route validates against', () => {
    expect([...RIG_CHECK_MORPHOLOGIES].sort()).toEqual(
      ['aquatic', 'avian', 'biped', 'hexapod', 'octopod', 'quadruped', 'serpentine'],
    );
  });
});
