import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyNaming,
  groupsPresent,
  missingGroups,
  checkBoneGroups,
  MORPHOLOGY_GROUPS,
  type BoneGroup,
} from '@/lib/visual-gen/skeleton-profiles';
import { RIG_PRESETS } from '@/lib/visual-gen/rig-presets';

/**
 * Bone-group vocabulary.
 *
 * WHERE THE FIXTURES COME FROM — every name below is observed, none invented:
 *
 *  - `ANONYMOUS` is the literal joint list read off `skintokens_cube_rigged.glb`, the real
 *    skin-tokens.cpp output this repo already commits as the rig-gate fixture. Measured
 *    2026-09-07: `["bone_0","bone_1","bone_2","bone_3","bone_4","bone_5"]`. This matters —
 *    PoF's only local rig engine names nothing, so a group check written against imagined
 *    semantic names would pass its own test and never fire on the one path that runs.
 *  - `MIXAMO` is pulled from `RIG_PRESETS` at runtime (below), so the semantic fixture is
 *    the naming this repo already ships and maps, not a guess. It is also exactly what
 *    Tripo returns for `spec: 'mixamo'` — that flag IS a bone-naming spec.
 */
const FIXTURES = join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig');

/** Captured from the committed real SkinTokens rig. */
const ANONYMOUS = ['bone_0', 'bone_1', 'bone_2', 'bone_3', 'bone_4', 'bone_5'];

/** The Mixamo source names this repo already maps in `rig-presets.ts`. */
const MIXAMO = RIG_PRESETS.flatMap((p) => p.mixamoMapping.map((m) => m.sourceBone));

/** The UE5 target names from the same real mapping. */
const UE5 = RIG_PRESETS.flatMap((p) => p.mixamoMapping.map((m) => m.targetBone));

describe('classifyNaming', () => {
  it('calls the real SkinTokens joint list anonymous', () => {
    expect(classifyNaming(ANONYMOUS)).toBe('anonymous');
  });

  it('reads the anonymous names straight out of the committed rig fixture', () => {
    // Re-derives the fixture rather than trusting the constant above, so this test fails
    // loudly if the fixture is ever regenerated with semantic names.
    const buffer = readFileSync(join(FIXTURES, 'skintokens_cube_rigged.glb'));
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let off = 12;
    let json: { nodes?: { name?: string }[]; skins?: { joints: number[] }[] } | undefined;
    while (off + 8 <= buffer.byteLength) {
      const len = view.getUint32(off, true);
      if (view.getUint32(off + 4, true) === 0x4e4f534a) {
        json = JSON.parse(buffer.subarray(off + 8, off + 8 + len).toString('utf8'));
      }
      off = off + 8 + len;
    }
    const names = json!.skins![0].joints.map((i) => json!.nodes![i].name ?? '');
    expect(names).toEqual(ANONYMOUS);
    expect(classifyNaming(names)).toBe('anonymous');
  });

  it('recognizes the mixamorig prefix', () => {
    expect(classifyNaming(MIXAMO)).toBe('mixamo');
  });

  it('recognizes unprefixed semantic names', () => {
    expect(classifyNaming(UE5)).toBe('semantic');
  });

  it('reports an empty joint list as empty rather than guessing', () => {
    expect(classifyNaming([])).toBe('empty');
  });

  it('treats joint_N and unnamed joints as anonymous too', () => {
    expect(classifyNaming(['joint_0', 'joint_1', 'joint_2'])).toBe('anonymous');
    expect(classifyNaming(['', '', ''])).toBe('anonymous');
  });

  it('is not fooled by a single semantic name among positional ones', () => {
    expect(classifyNaming(['bone_0', 'bone_1', 'bone_2', 'bone_3', 'Head'])).toBe('anonymous');
  });
});

describe('groupsPresent', () => {
  it('finds the groups the real Mixamo mapping covers', () => {
    const found = groupsPresent(MIXAMO);
    for (const g of ['spine', 'head', 'arms', 'hands', 'legs', 'feet'] as BoneGroup[]) {
      expect(found.has(g)).toBe(true);
    }
  });

  it('finds NO fingers in the mapping PoF actually ships — the gap this closes', () => {
    // `rig-presets.ts` is 39 mappings and stops at hand_l/hand_r on every preset. A
    // character retargeted through this mapping cannot close a hand around a prop.
    expect(groupsPresent(MIXAMO).has('fingers')).toBe(false);
    expect(groupsPresent(UE5).has('fingers')).toBe(false);
  });

  it("contradicts ue5-mannequin's own hasFingers claim — the metadata is not the mapping", () => {
    // The preset advertises `hasFingers: true` over a 67-bone target skeleton that really
    // does have finger bones, but its `mixamoMapping` never names one, so nothing drives
    // them. The declared capability and the shipped data disagree; the data wins at
    // runtime. Pinned here so the claim cannot quietly stay wrong.
    const mannequin = RIG_PRESETS.find((p) => p.id === 'ue5-mannequin')!;
    expect(mannequin.hasFingers).toBe(true);
    expect(groupsPresent(mannequin.mixamoMapping.map((m) => m.targetBone)).has('fingers')).toBe(false);
  });

  it('finds fingers when finger bones are actually named', () => {
    const withFingers = [...MIXAMO, 'mixamorig:LeftHandThumb1', 'mixamorig:LeftHandIndex1'];
    expect(groupsPresent(withFingers).has('fingers')).toBe(true);
  });

  it('finds nothing in an anonymous skeleton', () => {
    expect(groupsPresent(ANONYMOUS).size).toBe(0);
  });

  it('classifies quadruped and avian anatomy', () => {
    const dog = ['Root', 'Spine1', 'Neck', 'Head', 'FrontLeftThigh', 'FrontLeftPaw', 'Tail1', 'Tail2'];
    const found = groupsPresent(dog);
    expect(found.has('tail')).toBe(true);
    expect(found.has('legs')).toBe(true);
    expect(found.has('feet')).toBe(true);
    expect(found.has('head')).toBe(true);
    expect(groupsPresent(['Spine', 'Head', 'LeftWing1', 'RightWing1']).has('wings')).toBe(true);
  });

  it('does not read "hips" as a leg or "chest" as a head', () => {
    const found = groupsPresent(['Hips', 'Chest']);
    expect(found.has('spine')).toBe(true);
    expect(found.has('legs')).toBe(false);
    expect(found.has('head')).toBe(false);
  });
});

describe('missingGroups', () => {
  it('reports nothing missing for a complete biped', () => {
    expect(missingGroups(MIXAMO, 'biped')).toEqual([]);
  });

  it('reports fingers missing only when the caller requires them', () => {
    expect(missingGroups(MIXAMO, 'biped')).not.toContain('fingers');
    expect(missingGroups(MIXAMO, 'biped', ['fingers'])).toEqual(['fingers']);
  });

  it('reports a biped skeleton handed a quadruped expectation as missing a tail', () => {
    expect(missingGroups(MIXAMO, 'quadruped', ['tail'])).toEqual(['tail']);
  });

  it('every morphology declares at least a spine and a head', () => {
    for (const [morph, spec] of Object.entries(MORPHOLOGY_GROUPS)) {
      expect(spec.required, morph).toContain('spine');
      expect(spec.required, morph).toContain('head');
    }
  });
});

describe('checkBoneGroups — the honest verdict', () => {
  it('is unverifiable, never a pass, on an anonymous skeleton', () => {
    const v = checkBoneGroups(ANONYMOUS, { morphology: 'biped' });
    expect(v.verifiable).toBe(false);
    expect(v.naming).toBe('anonymous');
    expect(v.missing).toEqual([]);
    expect(v.reasons.join(' ')).toMatch(/positional|anonymous/i);
    // The reason must name the consequence, not just the symptom.
    expect(v.reasons.join(' ')).toMatch(/retarget/i);
  });

  it('verifies a semantic skeleton and names what is absent', () => {
    const v = checkBoneGroups(MIXAMO, { morphology: 'biped', require: ['fingers'] });
    expect(v.verifiable).toBe(true);
    expect(v.missing).toEqual(['fingers']);
    expect(v.reasons.join(' ')).toMatch(/finger/i);
    // The reason should say why it matters — a rig with no fingers cannot hold a prop.
    expect(v.reasons.join(' ')).toMatch(/grip|hold|prop/i);
  });

  it('is clean on a semantic skeleton that has everything asked of it', () => {
    const v = checkBoneGroups([...MIXAMO, 'mixamorig:LeftHandThumb1'], {
      morphology: 'biped',
      require: ['fingers'],
    });
    expect(v.verifiable).toBe(true);
    expect(v.missing).toEqual([]);
    expect(v.reasons).toEqual([]);
  });

  it('reports an empty joint list as unverifiable', () => {
    expect(checkBoneGroups([], { morphology: 'biped' }).verifiable).toBe(false);
  });
});
