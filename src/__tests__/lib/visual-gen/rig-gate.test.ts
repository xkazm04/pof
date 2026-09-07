import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseGlbRig,
  scoreRig,
  gateRig,
  type RigFacts,
} from '@/lib/visual-gen/rig-gate';

/**
 * Tier-1 rig gate.
 *
 * The fixtures are REAL skin-tokens.cpp output produced on 2026-09-07, not hand-written
 * glTF: `skintokens_cube_rigged.glb` is an actual `rig` result (5 KB), and
 * `unrigged_sphere.glb` is an actual static input of the kind the gate must reject. A
 * guard written against imagined data passes its test and never fires in production,
 * which this repo has shipped before.
 *
 * Captured facts, measured off the real outputs before any of this was written:
 *   cube_rigged  6 joints / 24 verts   sums min=max=mean=1.0  0 zero-weight  0 orphan
 *   grunt_seam  28 joints / 26,788 v   sums min=max=mean=1.0  0 zero-weight  0 orphan
 *   grunt (in)   0 skins, no JOINTS_0/WEIGHTS_0 at all
 */
const FIXTURES = join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig');
const rigged = () => readFileSync(join(FIXTURES, 'skintokens_cube_rigged.glb'));
const unrigged = () => readFileSync(join(FIXTURES, 'unrigged_sphere.glb'));

/** The grunt rig's captured facts — the real creature, too big to commit as a GLB. */
const GRUNT_FACTS: RigFacts = {
  hasSkin: true,
  jointCount: 28,
  referencedJoints: 28,
  hasInverseBindMatrices: true,
  vertexCount: 26788,
  zeroWeightVertices: 0,
  negativeWeights: 0,
  nonFiniteWeights: 0,
  maxInfluences: 4,
  weightSumMin: 1,
  weightSumMax: 1,
  weightSumMean: 1,
};

/**
 * Splice a morph-target declaration into a REAL GLB's JSON chunk, preserving its binary
 * chunk verbatim. Not a hand-written glTF: every accessor, buffer view and skin stays
 * exactly as skin-tokens.cpp emitted it, so the parser meets a real file's structure.
 * `meshCopies` repeats the mesh to model a character split into separated shells.
 */
function withMorphTargets(glb: Buffer, names: string[], meshCopies = 1): Buffer {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));

  const mesh = json.meshes[0];
  // Target accessor indices are never dereferenced by a COUNT, so they point at the
  // mesh's own POSITION accessor rather than at fabricated buffer data.
  const targets = names.map(() => ({ POSITION: mesh.primitives[0].attributes.POSITION }));
  for (const p of mesh.primitives) p.targets = targets;
  mesh.extras = { ...(mesh.extras ?? {}), targetNames: names };
  json.meshes = Array.from({ length: meshCopies }, () => mesh);

  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const padding = jsonBytes.length % 4 === 0 ? 0 : 4 - (jsonBytes.length % 4);
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(padding, 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(jsonChunk.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);

  const out = Buffer.concat([header, chunkHeader, jsonChunk, glb.subarray(20 + jsonLen)]);
  out.writeUInt32LE(out.length, 8);
  return out;
}

describe('parseGlbRig — against real skin-tokens.cpp output', () => {
  it('reads the rig facts of a real rigged GLB', () => {
    const f = parseGlbRig(rigged());
    expect(f.hasSkin).toBe(true);
    expect(f.jointCount).toBe(6);
    expect(f.referencedJoints).toBe(6);
    expect(f.hasInverseBindMatrices).toBe(true);
    expect(f.vertexCount).toBe(24);
    expect(f.zeroWeightVertices).toBe(0);
    expect(f.negativeWeights).toBe(0);
    expect(f.nonFiniteWeights).toBe(0);
    expect(f.maxInfluences).toBe(4);
    expect(f.weightSumMin).toBeCloseTo(1, 5);
    expect(f.weightSumMax).toBeCloseTo(1, 5);
    expect(f.weightSumMean).toBeCloseTo(1, 5);
  });

  it('reports a static mesh as having no skin instead of throwing', () => {
    const f = parseGlbRig(unrigged());
    expect(f.hasSkin).toBe(false);
    expect(f.jointCount).toBe(0);
    // Vertex count is still readable — the mesh is fine, it is just not rigged.
    expect(f.vertexCount).toBeGreaterThan(0);
  });

  it('rejects bytes that are not a GLB at all', () => {
    expect(() => parseGlbRig(Buffer.from('not a glb'))).toThrow(/glTF/i);
  });

  /**
   * The facial channel. `0` here is not a fixture convenience — it is the measured state
   * of the whole corpus: a sweep of every `.glb` under `generated/` on 2026-09-07 found
   * **52 of 52 declaring zero morph targets**, rigged and unrigged alike. So the negative
   * case is real captured output, and the positive case cannot be: PoF has never produced
   * a mesh with a facial channel. It is therefore DERIVED from the real rigged fixture —
   * the same bytes, with a morph declaration spliced into its JSON chunk — rather than
   * invented whole, so the parser is exercised against a real GLB's actual structure.
   */
  it('reports zero morph targets on the real fixtures — the measured corpus state', () => {
    expect(parseGlbRig(rigged()).morphTargetCount).toBe(0);
    expect(parseGlbRig(unrigged()).morphTargetCount).toBe(0);
    expect(parseGlbRig(rigged()).morphTargetNames).toEqual([]);
  });

  it('counts morph targets and reads their names when a mesh declares them', () => {
    const f = parseGlbRig(withMorphTargets(rigged(), ['jawOpen', 'mouthClose', 'eyeBlinkLeft']));
    expect(f.morphTargetCount).toBe(3);
    expect(f.morphTargetNames).toEqual(['jawOpen', 'mouthClose', 'eyeBlinkLeft']);
    // The skin facts must survive untouched — this is the same rig, plus a face.
    expect(f.jointCount).toBe(6);
    expect(f.vertexCount).toBe(24);
  });

  it('takes the MAX over meshes, not the sum — separated shells share one channel set', () => {
    // A face-capable character arrives as head + teeth + tongue + brows. Each shell
    // declares the same channels; summing would report 4x the channels that exist.
    const f = parseGlbRig(withMorphTargets(rigged(), ['jawOpen', 'mouthClose'], 4));
    expect(f.morphTargetCount).toBe(2);
  });
});

describe('scoreRig — the pass baseline is the captured rig', () => {
  it('passes the real creature rig', () => {
    const v = scoreRig(GRUNT_FACTS);
    expect(v.pass).toBe(true);
    expect(v.failures).toEqual([]);
    expect(v.score).toBe(100);
  });

  it('passes the real cube rig read straight off disk', () => {
    const v = scoreRig(parseGlbRig(rigged()));
    expect(v.pass).toBe(true);
  });

  it('fails a mesh with no skin, and says so first', () => {
    const v = scoreRig(parseGlbRig(unrigged()));
    expect(v.pass).toBe(false);
    expect(v.failures[0]).toMatch(/no skin/i);
    expect(v.score).toBe(0);
  });

  it('fails when any vertex carries no weight — it cannot follow the skeleton', () => {
    const v = scoreRig({ ...GRUNT_FACTS, zeroWeightVertices: 12 });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/12 .*no weight|no weight.*12/i);
  });

  it('fails on weight sums that are not normalized', () => {
    const v = scoreRig({ ...GRUNT_FACTS, weightSumMin: 0.4, weightSumMean: 0.7 });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/normal/i);
  });

  it('fails on negative or non-finite weights', () => {
    expect(scoreRig({ ...GRUNT_FACTS, negativeWeights: 3 }).pass).toBe(false);
    expect(scoreRig({ ...GRUNT_FACTS, nonFiniteWeights: 1 }).pass).toBe(false);
  });

  it('fails a skin that declares joints but references none', () => {
    const v = scoreRig({ ...GRUNT_FACTS, referencedJoints: 0 });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/no joint/i);
  });

  it('WARNS about orphan joints without failing — a spare bone deforms nothing', () => {
    const v = scoreRig({ ...GRUNT_FACTS, referencedJoints: 25 });
    expect(v.pass).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/3 .*orphan|orphan.*3/i);
    expect(v.score).toBeLessThan(100);
  });

  it('WARNS about a missing inverse-bind matrix rather than failing the rig', () => {
    const v = scoreRig({ ...GRUNT_FACTS, hasInverseBindMatrices: false });
    expect(v.pass).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/inverse bind/i);
  });

  it('WARNS on a suspiciously thin skeleton', () => {
    const v = scoreRig({ ...GRUNT_FACTS, jointCount: 1, referencedJoints: 1 });
    expect(v.warnings.join(' ')).toMatch(/joint/i);
  });

  it('never reports a score outside 0-100', () => {
    const bad = scoreRig({
      ...GRUNT_FACTS,
      zeroWeightVertices: 9999,
      negativeWeights: 5,
      nonFiniteWeights: 5,
      referencedJoints: 0,
      hasInverseBindMatrices: false,
      weightSumMin: 0,
    });
    expect(bad.score).toBeGreaterThanOrEqual(0);
    expect(bad.score).toBeLessThanOrEqual(100);
  });
});

describe('gateRig', () => {
  it('gates a real rigged file end to end', () => {
    const r = gateRig(join(FIXTURES, 'skintokens_cube_rigged.glb'));
    expect(r.ok).toBe(true);
    expect(r.verdict?.pass).toBe(true);
    expect(r.facts?.jointCount).toBe(6);
  });

  it('gates the unrigged file to a clean fail, not an error', () => {
    const r = gateRig(join(FIXTURES, 'unrigged_sphere.glb'));
    expect(r.ok).toBe(true);
    expect(r.verdict?.pass).toBe(false);
  });

  it('reports a missing file as ok:false — unreadable is not the same as ungated', () => {
    const r = gateRig(join(FIXTURES, 'does_not_exist.glb'));
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.verdict).toBeUndefined();
  });
});

/**
 * Bone-group awareness — added 2026-09-07 after a research run found the gate scored a
 * finger-less rig 100/pass. See `skeleton-profiles.ts` for the vocabulary and for the
 * measurement that shaped it: real SkinTokens output names its joints `bone_0…bone_N`,
 * so on PoF's own local rig engine the honest answer is UNVERIFIABLE, not "no fingers".
 */
describe('parseGlbRig — joint names', () => {
  it('reads the real fixture joint names off the glTF nodes', () => {
    const f = parseGlbRig(rigged());
    expect(f.jointNames).toEqual(['bone_0', 'bone_1', 'bone_2', 'bone_3', 'bone_4', 'bone_5']);
  });

  it('reports no joint names for an unrigged mesh', () => {
    expect(parseGlbRig(unrigged()).jointNames).toEqual([]);
  });
});

describe('scoreRig — bone groups', () => {
  /** The captured grunt facts plus the naming its engine actually produces. */
  const named = (names: string[]): RigFacts => ({ ...GRUNT_FACTS, jointNames: names });

  const MIXAMO_BIPED = [
    'mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Neck', 'mixamorig:Head',
    'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
    'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot',
    'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot',
  ];

  it('leaves the existing verdict untouched when no expectation is given', () => {
    // Backwards compatibility is load-bearing: every current caller passes one argument.
    const before = scoreRig(GRUNT_FACTS);
    expect(before.pass).toBe(true);
    expect(before.score).toBe(100);
  });

  it('WARNS on an anonymous skeleton even with no expectation — the wired SkinTokens path', () => {
    const v = scoreRig(named(['bone_0', 'bone_1', 'bone_2', 'bone_3']));
    expect(v.pass).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/positional|anonymous/i);
    expect(v.warnings.join(' ')).toMatch(/retarget/i);
    expect(v.score).toBeLessThan(100);
  });

  it('does not warn about naming when the names are semantic', () => {
    const v = scoreRig(named(MIXAMO_BIPED));
    expect(v.warnings.join(' ')).not.toMatch(/positional/i);
    expect(v.pass).toBe(true);
  });

  it('FAILS when a required bone group is absent from a readable skeleton', () => {
    const v = scoreRig(named(MIXAMO_BIPED), { morphology: 'biped', require: ['fingers'] });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/finger/i);
    expect(v.failures.join(' ')).toMatch(/grip|hold|prop/i);
  });

  it('PASSES when the required groups are all evidenced', () => {
    const v = scoreRig(named([...MIXAMO_BIPED, 'mixamorig:LeftHandThumb1']), {
      morphology: 'biped',
      require: ['fingers'],
    });
    expect(v.pass).toBe(true);
  });

  it('FAILS an expectation it cannot verify rather than fabricating a pass', () => {
    const v = scoreRig(named(['bone_0', 'bone_1', 'bone_2']), { morphology: 'quadruped' });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/cannot be verified|unverifiable/i);
  });

  it('FAILS an expectation when joint names were never captured', () => {
    // `jointNames: undefined` means the facts predate name reading — not "no names".
    const v = scoreRig(GRUNT_FACTS, { morphology: 'biped' });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/not captured|no joint names/i);
  });

  it('catches a biped rigger applied to a quadruped — the silent Tripo failure', () => {
    // A human skeleton fitted to a dog returns a rig and imports fine; the only local
    // evidence is that a quadruped expectation finds no tail and nothing four-legged.
    const v = scoreRig(named(MIXAMO_BIPED), { morphology: 'quadruped', require: ['tail'] });
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/tail/i);
  });
});

describe('scoreRig — the facial channel', () => {
  const facial = { morphology: 'biped' as const, facialDeformation: true };
  // A named biped, so the anatomy check passes and the face is the only thing under test.
  const MIXAMO_BIPED = [
    'mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Neck', 'mixamorig:Head',
    'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
    'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot',
    'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot',
  ];

  it('fails a speaking character whose mesh declares no morph targets', () => {
    // The whole corpus is this case: clean weights, zero facial channel.
    const v = scoreRig({ ...GRUNT_FACTS, jointNames: MIXAMO_BIPED, morphTargetCount: 0 }, facial);
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/0 morph targets/);
    expect(v.failures.join(' ')).toMatch(/blink, speak or change expression/);
  });

  it('passes the same rig once it carries a facial channel', () => {
    const v = scoreRig(
      { ...GRUNT_FACTS, jointNames: MIXAMO_BIPED, morphTargetCount: 52 },
      facial,
    );
    expect(v.pass).toBe(true);
  });

  it('refuses to pass an UNREAD morph count rather than assuming a face', () => {
    // `undefined` is a facts record captured before the field existed — not "no face".
    const v = scoreRig({ ...GRUNT_FACTS, jointNames: MIXAMO_BIPED }, facial);
    expect(v.pass).toBe(false);
    expect(v.failures.join(' ')).toMatch(/could not be checked/);
  });

  it('says nothing about faces when no facial expectation was set', () => {
    // A crate, a mount and a silent creature all legitimately have no morph targets.
    const v = scoreRig({ ...GRUNT_FACTS, jointNames: MIXAMO_BIPED, morphTargetCount: 0 }, {
      morphology: 'biped',
    });
    expect(v.pass).toBe(true);
    expect([...v.failures, ...v.warnings].join(' ')).not.toMatch(/morph/i);
  });
});

describe('gateRig — with an expectation', () => {
  it('threads the expectation through to the verdict', () => {
    const r = gateRig(join(FIXTURES, 'skintokens_cube_rigged.glb'), { morphology: 'biped' });
    expect(r.ok).toBe(true);
    // Real SkinTokens output: anonymous, so a biped claim is unverifiable and must not pass.
    expect(r.verdict?.pass).toBe(false);
    expect(r.verdict?.failures.join(' ')).toMatch(/cannot be verified/i);
  });

  it('still passes the same file with no expectation', () => {
    const r = gateRig(join(FIXTURES, 'skintokens_cube_rigged.glb'));
    expect(r.verdict?.pass).toBe(true);
  });
});
