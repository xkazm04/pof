/**
 * One rig-binding verdict — a gated rig is checked against the skeleton it will be
 * retargeted onto.
 *
 * Measured on the base tree before this module existed: a 14-bone biped named
 * Hips/Spine/Neck/Head/Left|Right Arm/ForeArm/Hand/Leg/Foot scored
 * `scoreRig(..., { morphology: 'biped' })` = 100/pass, while 4 of the UE5 Mannequin's 10
 * required IK chain endpoints (clavicle_l, clavicle_r, thigh_l, thigh_r) had no bone in
 * the rig — both arm chains and both leg chains could not be retargeted. Nothing asked
 * the binding question, although every input to it was already in the tree.
 *
 * Pure throughout: no GLB, no Blender, no model — facts are built in memory.
 */
import { describe, it, expect } from 'vitest';
import { bindRigToPreset, requiredChainBones } from '@/lib/visual-gen/rig-binding';
import { RIG_PRESETS, checkPresetBinding, getRigPreset } from '@/lib/visual-gen/rig-presets';
import { scoreRig, type RigFacts } from '@/lib/visual-gen/rig-gate';

const UE5 = getRigPreset('ue5-mannequin')!;
const METAHUMAN = getRigPreset('metahuman')!;

/** Semantic biped with no clavicles and no thighs. */
const NO_CLAV_NO_THIGH = [
  'Hips', 'Spine', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot',
];

/** The 20 Mixamo source names the UE5 Mannequin table is authored against. */
const MIXAMO_20 = UE5.mixamoMapping.map((m) => m.sourceBone);

/** A structurally clean skin over `names` — only the names vary between cases. */
function facts(names: string[]): RigFacts {
  return {
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
}

describe('bindRigToPreset', () => {
  it('case 1: a semantic rig missing clavicles and thighs binds 6 of 10 endpoints (derived)', () => {
    const b = bindRigToPreset(NO_CLAV_NO_THIGH, UE5);
    expect(b.status).toBe('partial');
    expect(b.source).toBe('derived');
    expect(new Set(b.unboundRequired)).toEqual(new Set(['clavicle_l', 'clavicle_r', 'thigh_l', 'thigh_r']));
    expect(new Set(b.unboundChains)).toEqual(new Set(['LeftArm', 'RightArm', 'LeftLeg', 'RightLeg']));
    expect(b.required).toHaveLength(10);
    expect(b.boundRequired).toHaveLength(6);
    // The derived rows keep the planner's audit labels.
    for (const row of b.mapping) expect(['exact', 'canonical', 'chain-order']).toContain(row.via);
  });

  it('case 2: a Mixamo rig binds through the table, read against the rig\'s ACTUAL names', () => {
    const full = bindRigToPreset(MIXAMO_20, UE5);
    expect(full.status).toBe('bound');
    expect(full.source).toBe('table');
    expect(full.required).toHaveLength(10);
    expect(full.boundRequired).toHaveLength(10);
    expect(full.unboundRequired).toEqual([]);
    expect(full.mapping).toHaveLength(20);
    for (const row of full.mapping) expect(row.via).toBe('table');

    // The table is total over its own chains; that is not the question. The rig lacks
    // one source bone, so the row that would bind clavicle_l maps from nothing.
    const missing = bindRigToPreset(MIXAMO_20.filter((n) => n !== 'mixamorig:LeftShoulder'), UE5);
    expect(missing.status).toBe('partial');
    expect(missing.source).toBe('table');
    expect(missing.unboundRequired).toEqual(['clavicle_l']);
    expect(missing.unboundChains).toEqual(['LeftArm']);
  });

  it('case 3: an anonymous or uncaptured rig is unverifiable, never bound', () => {
    const anon = bindRigToPreset(['bone_0', 'bone_1', 'bone_2', 'bone_3', 'bone_4', 'bone_5'], UE5);
    expect(anon.status).toBe('unverifiable');
    expect(anon.reason).toMatch(/positional/);

    const uncaptured = bindRigToPreset(undefined, UE5);
    expect(uncaptured.status).toBe('unverifiable');
    expect(uncaptured.reason).toMatch(/not (captured|read)/);

    expect(bindRigToPreset([], UE5).status).toBe('unverifiable');
  });

  it('case 4: a conform target has no mapping to be total over', () => {
    const b = bindRigToPreset(NO_CLAV_NO_THIGH, METAHUMAN);
    expect(b.status).toBe('not-applicable');
    expect(b.reason).toMatch(/conform/);
    expect(bindRigToPreset(MIXAMO_20, METAHUMAN).status).toBe('not-applicable');
  });
});

describe('scoreRig with a target skeleton', () => {
  it('[guard] case 5: no target is today\'s verdict, unchanged', () => {
    const v = scoreRig(facts(NO_CLAV_NO_THIGH), { morphology: 'biped' });
    expect(v.pass).toBe(true);
    expect(v.score).toBe(100);
    expect('binding' in v).toBe(false);
  });

  it('case 6: unbound chain endpoints fail the gate; a fully bound rig passes', () => {
    const partial = scoreRig(facts(NO_CLAV_NO_THIGH), { morphology: 'biped', target: 'ue5-mannequin' });
    expect(partial.pass).toBe(false);
    expect(partial.score).toBe(0);
    expect(partial.failures.some((f) => f.includes('clavicle_l') && f.includes('LeftArm'))).toBe(true);
    expect(partial.binding?.status).toBe('partial');

    const bound = scoreRig(facts(MIXAMO_20), { morphology: 'biped', target: 'ue5-mannequin' });
    expect(bound.failures).toEqual([]);
    expect(bound.pass).toBe(true);
    expect(bound.score).toBe(100);
    expect(bound.binding?.status).toBe('bound');
  });

  it('case 7: an unreadable target never passes', () => {
    const v = scoreRig(facts(MIXAMO_20), { morphology: 'biped', target: 'no-such-preset' });
    expect(v.pass).toBe(false);
    expect(v.failures.some((f) => /unknown target/.test(f))).toBe(true);
  });
});

describe('[guard] case 8: one required-bone rule', () => {
  it('checkPresetBinding is unchanged for every preset and reads requiredChainBones', () => {
    const base: Record<string, { ok: boolean; requiredChainBones: string[]; unmappedChainBones: string[] | null }> = {
      'ue5-mannequin': {
        ok: true,
        requiredChainBones: ['pelvis', 'head', 'clavicle_l', 'hand_l', 'clavicle_r', 'hand_r', 'thigh_l', 'foot_l', 'thigh_r', 'foot_r'],
        unmappedChainBones: [],
      },
      metahuman: {
        ok: true,
        requiredChainBones: ['pelvis', 'head', 'clavicle_l', 'hand_l', 'clavicle_r', 'hand_r', 'thigh_l', 'foot_l', 'thigh_r', 'foot_r'],
        unmappedChainBones: null,
      },
      'minimal-humanoid': {
        ok: true,
        requiredChainBones: ['Pelvis', 'Head', 'LeftShoulder', 'LeftHand', 'RightShoulder', 'RightHand', 'LeftThigh', 'LeftFoot', 'RightThigh', 'RightFoot'],
        unmappedChainBones: [],
      },
    };
    expect(RIG_PRESETS).toHaveLength(3);
    for (const p of RIG_PRESETS) {
      const { ok, requiredChainBones: req, unmappedChainBones } = checkPresetBinding(p);
      expect({ ok, requiredChainBones: req, unmappedChainBones }).toEqual(base[p.id]);
      expect(req).toEqual(requiredChainBones(p));
      expect(bindRigToPreset(MIXAMO_20, p).required).toEqual(requiredChainBones(p));
    }
  });
});
