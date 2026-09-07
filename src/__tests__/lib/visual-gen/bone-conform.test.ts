import { describe, it, expect } from 'vitest';
import { canonicalize, planConform, effectiveRenames } from '@/lib/visual-gen/bone-conform';
import { RIG_PRESETS } from '@/lib/visual-gen/rig-presets';

/**
 * Fixtures are the two REAL vocabularies this repo already carries: the Mixamo source
 * names and the UE5 Mannequin target names from `rig-presets.ts`. They are a genuine
 * cross-convention pair — the exact shape a conform has to solve — and their correct
 * pairing is already recorded in that file, so the mapping can be checked against a known
 * answer rather than against this module's own opinion.
 */
const mannequin = RIG_PRESETS.find((p) => p.id === 'ue5-mannequin')!;
const MIXAMO = mannequin.mixamoMapping.map((m) => m.sourceBone);
const UE5 = mannequin.mixamoMapping.map((m) => m.targetBone);
/** The ground truth, straight out of the shipped preset. */
const EXPECTED = new Map(mannequin.mixamoMapping.map((m) => [m.sourceBone, m.targetBone]));

describe('canonicalize', () => {
  it('strips the vendor prefix and normalizes the side', () => {
    const c = canonicalize('mixamorig:LeftUpLeg');
    expect(c.side).toBe('left');
    expect(c.stem).toBe('thigh');
  });

  it('reads UE5 suffix sides', () => {
    expect(canonicalize('thigh_l').side).toBe('left');
    expect(canonicalize('thigh_r').side).toBe('right');
    expect(canonicalize('pelvis').side).toBe('center');
  });

  it('maps the three spellings of the same joint onto one stem', () => {
    const keys = ['mixamorig:LeftUpLeg', 'thigh_l', 'LeftThigh'].map((n) => canonicalize(n).key);
    expect(new Set(keys).size).toBe(1);
  });

  it('extracts a chain index in either spelling', () => {
    expect(canonicalize('Spine1').index).toBe(1);
    expect(canonicalize('spine_02').index).toBe(2);
    expect(canonicalize('spine').index).toBeUndefined();
  });

  it('does not confuse a right-side marker with a stem letter', () => {
    // "root" begins with r — a naive side regex reads it as right.
    expect(canonicalize('root').side).toBe('center');
    expect(canonicalize('LeftForeArm').side).toBe('left');
  });
});

describe('planConform — Mixamo onto the UE5 Mannequin', () => {
  const plan = planConform(MIXAMO, UE5);

  it('has no blockers on two real, semantically-named vocabularies', () => {
    expect(plan.blockers).toEqual([]);
  });

  it('reproduces the mapping rig-presets.ts already ships, without being told it', () => {
    // The strong assertion: every rename this module derives from names alone must agree
    // with the hand-authored mapping. A conform that disagrees with the known answer is
    // worse than no conform, because it silently drives the wrong bone.
    for (const r of plan.renames) {
      expect(EXPECTED.get(r.from), `${r.from} → ${r.to}`).toBe(r.to);
    }
  });

  it('covers the whole clip skeleton', () => {
    expect(plan.coverage).toBe(1);
    expect(plan.unmatchedClip).toEqual([]);
  });

  it('reports every match as a real rename, since the vocabularies share no spelling', () => {
    expect(effectiveRenames(plan).length).toBe(plan.renames.length);
    expect(plan.renames.length).toBe(MIXAMO.length);
  });
});

describe('planConform — match strength', () => {
  it('prefers an exact name over a canonical guess', () => {
    const plan = planConform(['Head', 'mixamorig:Head'], ['Head']);
    expect(plan.renames).toHaveLength(1);
    expect(plan.renames[0]).toEqual({ from: 'Head', to: 'Head', via: 'exact' });
    expect(plan.unmatchedRig).toEqual(['mixamorig:Head']);
    // An exact match is not a rename anything needs to apply.
    expect(effectiveRenames(plan)).toEqual([]);
  });

  it('flags an index-mismatched spine as the weaker match it is', () => {
    const plan = planConform(['Spine1', 'Spine2'], ['spine_01', 'spine_04']);
    expect(plan.renames.find((r) => r.from === 'Spine1')?.via).toBe('canonical');
    expect(plan.renames.find((r) => r.from === 'Spine2')?.via).toBe('chain-order');
  });

  it('bridges the chain-index ORIGIN offset the two conventions disagree on', () => {
    // Mixamo starts a spine at Spine (no index); UE5 starts at spine_01. The same three
    // bones therefore carry 0,1,2 and 1,2,3, and only order can pair them. This is the
    // exact mapping rig-presets.ts hand-authored.
    const plan = planConform(['Spine', 'Spine1', 'Spine2'], ['spine_01', 'spine_02', 'spine_03']);
    expect(plan.renames.map((r) => [r.from, r.to])).toEqual([
      ['Spine', 'spine_01'],
      ['Spine1', 'spine_02'],
      ['Spine2', 'spine_03'],
    ]);
  });

  it('never claims one clip bone twice', () => {
    const plan = planConform(['Spine1', 'Spine2', 'Spine3'], ['spine_01']);
    expect(plan.renames).toHaveLength(1);
    expect(plan.unmatchedRig).toHaveLength(2);
  });

  it('reports lost clip motion when the rig is missing bones — the dog/fox case', () => {
    // A rig with no tail against a clip that animates one: the tail motion has nowhere to
    // go, and coverage must say so rather than reporting a clean conform.
    const dogRig = ['Spine1', 'Neck', 'Head', 'LeftThigh', 'LeftFoot'];
    const foxClip = ['spine_01', 'neck_01', 'head', 'thigh_l', 'foot_l', 'tail_01', 'tail_02'];
    const plan = planConform(dogRig, foxClip);
    expect(plan.unmatchedClip).toEqual(['tail_01', 'tail_02']);
    expect(plan.coverage).toBeCloseTo(5 / 7, 5);
  });
});

describe('planConform — the hard limit', () => {
  it('BLOCKS on an anonymous rig instead of reporting 0% coverage', () => {
    const plan = planConform(['bone_0', 'bone_1', 'bone_2'], UE5);
    expect(plan.naming).toBe('anonymous');
    expect(plan.renames).toEqual([]);
    expect(plan.blockers).toHaveLength(1);
    // The distinction that matters: this needs a geometric identification pass, not a
    // better name matcher.
    expect(plan.blockers[0]).toMatch(/position/i);
  });

  it('blocks on an empty rig or an empty clip', () => {
    expect(planConform([], UE5).blockers.length).toBeGreaterThan(0);
    expect(planConform(MIXAMO, []).blockers.length).toBeGreaterThan(0);
  });
});
