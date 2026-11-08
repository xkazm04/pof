import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gateRig, parseGlbRig, scoreRig } from '@/lib/visual-gen/rig-gate';
import { assembleMetaHuman, buildAssemblePython, buildConformPython, conformMeshToMetaHuman } from '@/lib/visual-gen/metahuman-conform';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';
import { routePromptShape } from '@/lib/visual-gen/linear-prop-routing';
import { planConform } from '@/lib/visual-gen/bone-conform';
import { bindRigToPreset } from '@/lib/visual-gen/rig-binding';
import { getRigPreset } from '@/lib/visual-gen/rig-presets';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VisionImage } from '@/lib/anim-critique/critique';
import type { RenderedView } from '@/lib/visual-gen/mesh-views';
import {
  critiqueReferenceConformance,
  parseConformanceReply,
  scoreConformance,
} from '@/lib/visual-gen/reference-conformance';

describe('reference conformance: a reply outside the scale is not a verdict', () => {
  it('refuses a severity below the scale rather than reading it as a match', () => {
    const reply = parseConformanceReply('DIVERGENCES=none; SEVERITY=-1');
    expect(reply.ok).toBe(false);
    expect(scoreConformance(reply).verdict).toBe('unmeasured');
  });

  it('still reads every value on the scale', () => {
    for (const s of [0, 1, 2, 3]) {
      expect(parseConformanceReply(`DIVERGENCES=none; SEVERITY=${s}`).severity).toBe(s);
    }
  });
});

describe('reference conformance: the "none" sentinel', () => {
  it('reads a punctuated none as no divergences, so severity 0 is a match', () => {
    const reply = parseConformanceReply('DIVERGENCES=None.; SEVERITY=0');
    expect(reply.divergences).toEqual([]);
    expect(scoreConformance(reply).verdict).toBe('match');
  });
});

describe('reference conformance: the image the vision call is told about', () => {
  it('announces a webp reference as webp', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pof-ref-'));
    try {
      const reference = join(dir, 'concept.webp');
      const render = join(dir, 'front.png');
      writeFileSync(reference, 'x');
      writeFileSync(render, 'x');
      let seen: VisionImage[] = [];
      await critiqueReferenceConformance(reference, [{ yawDeg: 0, imagePath: render } as RenderedView], {
        vision: async (images) => { seen = images; return 'DIVERGENCES=none; SEVERITY=0'; },
      });
      expect(seen[0].mime).toBe('image/webp');
      expect(seen[1].mime).toBe('image/png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('bone conform: the numbered Mixamo namespace', () => {
  const names = ['Hips', 'Spine', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot',
    'RightUpLeg', 'RightLeg', 'RightFoot'];

  it('reads mixamorig1: as the same vendor prefix as mixamorig:', () => {
    const plan = planConform(['mixamorig1:Hips', 'mixamorig1:LeftHand'], ['pelvis', 'hand_l']);
    expect(plan.coverage).toBe(1);
  });

  it('binds a mixamorig1 rig to the mannequin chains', () => {
    const binding = bindRigToPreset(names.map((n) => `mixamorig1:${n}`), getRigPreset('ue5-mannequin')!);
    expect(binding.unboundRequired).toEqual([]);
    expect(binding.status).toBe('bound');
  });
});

describe('linear-prop routing: a hyphenated compound names something else', () => {
  it('does not refuse chain-mail as a chain', () => {
    const route = routePromptShape('chain-mail shirt');
    expect(route.route).toBe('generate');
    expect(route.keyword).toBeUndefined();
    expect(route.reason).not.toContain('chain');
  });

  it('still recognises a rope the hyphen only describes', () => {
    expect(routePromptShape('steel-cable').route).toBe('procedural');
    expect(routePromptShape('barbed-wire coil').route).toBe('procedural');
  });
});

const experiment = (markers: Record<string, string>): (() => Promise<ExperimentResult>) => async () => ({
  ok: true, logs: [], markers, durationMs: 1, binary: 'b', args: [],
});

describe('metahuman conform: a failure names what actually failed', () => {
  it('does not blame the conform call when no character was ever created', async () => {
    const res = await conformMeshToMetaHuman('C:/gen/x.glb', {
      runExperimentFn: experiment({ POF_MH_IMPORT: '/Game/X/T.T', POF_MH_VERTS: '0', POF_MH_CHAR: 'NONE', POF_MH_CONFORMED: 'False' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain('returned False');
    expect(res.error).toContain('no MetaHumanCharacter');
  });

  it('does not send the operator to the Launcher for a character that did not load', async () => {
    const res = await assembleMetaHuman('/Game/X/Missing', {
      runExperimentFn: experiment({ POF_MH_CHAR: 'NONE', POF_MH_ASSEMBLED: 'False' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain('Optional Content');
    expect(res.error).toContain('/Game/X/Missing');
  });
});

describe('metahuman conform: the editor Python', () => {
  it('commits and saves the body only when the conform succeeded, and always releases the edit', () => {
    const lines = buildConformPython('C:/gen/x.glb').split('\n');
    const guard = lines.indexOf('    if _ok:');
    expect(guard).toBeGreaterThan(lines.findIndex((l) => l.includes('conform_body_to_target')));
    expect(lines[guard + 1]).toBe('        _sub.commit_body_state(_char)');
    expect(lines[guard + 2]).toBe('        unreal.EditorAssetLibrary.save_loaded_asset(_char)');
    expect(lines[guard + 3]).toBe('    _sub.remove_object_to_edit(_char)');
  });
});

describe('metahuman conform: values embedded in editor Python', () => {
  it('keeps an apostrophe in a path inside the string literal', () => {
    const py = buildConformPython("C:/Users/O'Brien/x.glb", { charName: "MH_O'Neil" });
    expect(py).toContain("task.filename = 'C:/Users/O\\'Brien/x.glb'");
    expect(py).toContain("create_asset('MH_O\\'Neil'");
  });

  it('escapes the assemble path and name override', () => {
    const py = buildAssemblePython("/Game/O'X", { nameOverride: "It's" });
    expect(py).toContain("unreal.load_asset('/Game/O\\'X')");
    expect(py).toContain("'name_override', 'It\\'s'");
  });
});

describe('rig gate: a damaged file is not an unrigged asset', () => {
  const real = readFileSync(join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig', 'skintokens_cube_rigged.glb'));

  it('reports a GLB cut inside its binary chunk as unreadable', () => {
    const cut = real.subarray(0, real.byteLength - 8);
    const res = gateRig('x.glb', undefined, () => Buffer.from(cut));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('truncated');
    expect(res.verdict).toBeUndefined();
  });
});

interface TestPrim { weights: number[][]; joints: number[][]; weights1?: number[][]; joints1?: number[][] }

/** A minimal, spec-shaped skinned GLB: float weights, uint16 joints, three named joints. */
function skinnedGlb(meshes: TestPrim[][], nodeSkins?: (number | undefined)[]): Buffer {
  const chunks: Buffer[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const add = (rows: number[][], componentType: number, type: string, bytes: (r: number[]) => Buffer): number => {
    const data = Buffer.concat(rows.map(bytes));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    accessors.push({ bufferView: bufferViews.length - 1, componentType, count: rows.length, type });
    chunks.push(data);
    offset += data.length;
    return accessors.length - 1;
  };
  const floats = (r: number[]) => Buffer.from(new Float32Array(r).buffer);
  const shorts = (r: number[]) => Buffer.from(new Uint16Array(r).buffer);
  const jsonMeshes = meshes.map((prims) => ({
    primitives: prims.map((p) => ({
      attributes: {
        POSITION: add(p.weights.map(() => [0, 0, 0]), 5126, 'VEC3', floats),
        WEIGHTS_0: add(p.weights, 5126, 'VEC4', floats),
        JOINTS_0: add(p.joints, 5123, 'VEC4', shorts),
        ...(p.weights1 ? { WEIGHTS_1: add(p.weights1, 5126, 'VEC4', floats), JOINTS_1: add(p.joints1!, 5123, 'VEC4', shorts) } : {}),
      },
    })),
  }));
  const json = {
    asset: { version: '2.0' },
    meshes: jsonMeshes,
    nodes: [
      { name: 'a' }, { name: 'b' }, { name: 'c' },
      ...jsonMeshes.map((_, mesh) => ({ mesh, ...(nodeSkins?.[mesh] !== undefined ? { skin: nodeSkins[mesh] } : {}) })),
    ],
    skins: [{ joints: [0, 1, 2] }, { joints: [0, 1] }],
    accessors,
    bufferViews,
  };
  const pad = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(Buffer.concat(chunks), 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunk = (type: number, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(body.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, jsonChunk), chunk(0x004e4942, binChunk)]);
}

const good: TestPrim = { weights: [[1, 0, 0, 0], [1, 0, 0, 0]], joints: [[0, 0, 0, 0], [1, 0, 0, 0]] };
const unweighted: TestPrim = { weights: [[0, 0, 0, 0]], joints: [[2, 0, 0, 0]] };

describe('rig gate: every skinned primitive is graded', () => {
  it('sees an unweighted vertex on a second primitive', () => {
    const facts = parseGlbRig(skinnedGlb([[good, unweighted]]));
    expect(facts.zeroWeightVertices).toBe(1);
    expect(facts.vertexCount).toBe(3);
    expect(scoreRig(facts).pass).toBe(false);
  });

  it('sees an unweighted vertex on a second mesh', () => {
    expect(parseGlbRig(skinnedGlb([[good], [unweighted]])).zeroWeightVertices).toBe(1);
  });

  it('counts joints referenced from any primitive, so none reads as an orphan', () => {
    const third: TestPrim = { weights: [[1, 0, 0, 0]], joints: [[2, 0, 0, 0]] };
    expect(parseGlbRig(skinnedGlb([[good, third]])).referencedJoints).toBe(3);
  });

  it('does not grade a mesh bound to a different skin against this one', () => {
    expect(parseGlbRig(skinnedGlb([[good], [unweighted]], [0, 1])).zeroWeightVertices).toBe(0);
  });
});

describe('rig gate: a joint index the skin does not declare', () => {
  const stray: TestPrim = { weights: [[1, 0, 0, 0]], joints: [[9, 0, 0, 0]] };

  it('fails the rig and names the count', () => {
    const facts = parseGlbRig(skinnedGlb([[good, stray]]));
    expect(facts.outOfRangeJointRefs).toBe(1);
    expect(facts.referencedJoints).toBe(2);
    const verdict = scoreRig(facts);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures.join(' ')).toContain('outside the skin');
  });

  it('reports zero on a clean rig', () => {
    expect(parseGlbRig(skinnedGlb([[good]])).outOfRangeJointRefs).toBe(0);
  });
});

describe('rig gate: WEIGHTS_1 / JOINTS_1', () => {
  it('adds the second influence set to the vertex', () => {
    const prim: TestPrim = {
      weights: [[0.2, 0.1, 0.1, 0.1]],
      joints: [[0, 1, 0, 1]],
      weights1: [[0.5, 0, 0, 0]],
      joints1: [[2, 0, 0, 0]],
    };
    const facts = parseGlbRig(skinnedGlb([[prim]]));
    expect(facts.weightSumMin).toBeCloseTo(1, 5);
    expect(facts.maxInfluences).toBe(5);
    expect(facts.referencedJoints).toBe(3);
    expect(scoreRig(facts).failures).toEqual([]);
  });
});
