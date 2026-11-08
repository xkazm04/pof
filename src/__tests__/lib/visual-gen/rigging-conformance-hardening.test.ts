import { describe, it, expect } from 'vitest';
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
