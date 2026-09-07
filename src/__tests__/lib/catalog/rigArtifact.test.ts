import { describe, it, expect } from 'vitest';
import {
  rigCandidatePayload,
  gradeRiggedSelection,
  riggedMeshSelected,
  type RigCandidateRecord,
} from '@/lib/catalog/acceptance/rigArtifact';
import { gallerySeed } from '@/lib/catalog/acceptance/galleryArtifact';
import {
  appendBatch,
  emptyHistory,
  historyData,
  makeBatch,
} from '@/components/layout-lab/steps/shared/genHistory';

/**
 * The rig record used throughout is the REAL gate output for `bestiary_grunt.glb`,
 * measured 2026-09-07 through `runSkintokens` on the GPU — not invented numbers.
 */
const GRUNT_RIG: RigCandidateRecord = {
  pass: true,
  score: 100,
  jointCount: 28,
  referencedJoints: 28,
  vertexCount: 26788,
  zeroWeightVertices: 0,
  failures: [],
  warnings: [],
};

/** A gallery artifact whose selected candidate carries a real .glb (+ optional rig record). */
function meshArtifact(field: string, rig?: RigCandidateRecord): Record<string, unknown> {
  const batch = makeBatch({
    seq: 0,
    at: '2026-01-01T00:00:00.000Z',
    direction: 'rig the creature',
    prompt: 'skintokens rig',
    candidates: [
      {
        swatch: 'linear-gradient(#111,#222)',
        caption: 'grunt',
        payload: {
          [field]: 0,
          glbUrl: '/api/visual-gen/asset/grunt_rigged.glb',
          ...(rig ? { rig } : {}),
        },
      },
    ],
  });
  const h = appendBatch(emptyHistory(), batch);
  // `makeBatch` assigns the candidate ids; select whichever it produced.
  return historyData({ ...h, selectedId: batch.candidates[0].id });
}

describe('rigCandidatePayload — the writer half of the contract', () => {
  it('projects a passing runSkintokens result onto a candidate payload', () => {
    const p = rigCandidatePayload({
      rig: { pass: true, score: 100, failures: [], warnings: [] },
      facts: {
        hasSkin: true, jointCount: 28, referencedJoints: 28, hasInverseBindMatrices: true,
        vertexCount: 26788, zeroWeightVertices: 0, negativeWeights: 0, nonFiniteWeights: 0,
        maxInfluences: 4, weightSumMin: 0.99999982, weightSumMax: 1.00000018, weightSumMean: 1,
      },
    });
    expect(p).toEqual({ rig: GRUNT_RIG });
  });

  it('projects a FAILING result honestly rather than dropping it', () => {
    const p = rigCandidatePayload({
      rig: { pass: false, score: 0, failures: ['900 of 26788 vertices carry no weight'], warnings: [] },
      facts: {
        hasSkin: true, jointCount: 28, referencedJoints: 28, hasInverseBindMatrices: true,
        vertexCount: 26788, zeroWeightVertices: 900, negativeWeights: 0, nonFiniteWeights: 0,
        maxInfluences: 4, weightSumMin: 0, weightSumMax: 1, weightSumMean: 0.9,
      },
    });
    expect((p.rig as RigCandidateRecord).pass).toBe(false);
    expect((p.rig as RigCandidateRecord).failures[0]).toMatch(/carry no weight/);
  });

  it('records NOTHING when the gate did not run — absent must not read as passed', () => {
    expect(rigCandidatePayload({})).toEqual({});
    expect(rigCandidatePayload({ rig: undefined, facts: undefined })).toEqual({});
  });
});

describe('gradeRiggedSelection — the grader half', () => {
  const field = 'mesh';
  const label = 'A rigged mesh candidate is selected';

  it('passes a real mesh whose rig gate passed, naming the skeleton', () => {
    const r = gradeRiggedSelection(meshArtifact(field, GRUNT_RIG), field, label);
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L2');
    expect(r.detail).toMatch(/28 joints/);
  });

  it('DEFERS a real mesh with no rig record — a static mesh cannot pass a rig step', () => {
    // This is the defect being closed: `selected()` graded asset PRESENCE only, so an
    // unrigged .glb passed a step whose own label claims a rigged mesh.
    const r = gradeRiggedSelection(meshArtifact(field), field, label);
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/no rig gate/i);
    expect(r.reason).toMatch(/skintokens|rig/i);
  });

  it('FAILS a mesh whose rig gate failed, quoting the gate', () => {
    const bad: RigCandidateRecord = {
      ...GRUNT_RIG, pass: false, score: 0, zeroWeightVertices: 900,
      failures: ['900 of 26788 vertices carry no weight'],
    };
    const r = gradeRiggedSelection(meshArtifact(field, bad), field, label);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/carry no weight/);
  });

  it('surfaces gate warnings on an otherwise passing rig', () => {
    const warned: RigCandidateRecord = { ...GRUNT_RIG, score: 90, warnings: ['3 orphan joint(s)'] };
    const r = gradeRiggedSelection(meshArtifact(field, warned), field, label);
    expect(r.status).toBe('pass');
    expect(r.detail).toMatch(/orphan/);
  });

  it('defers the produce STUB exactly as the gallery grader does — no manufactured pass', () => {
    // The stub is swatches only; the asset problem outranks the rig question.
    const r = gradeRiggedSelection(gallerySeed(field, 3), field, label);
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/swatch/i);
  });

  it('reports a missing selection as pending, delegating to the gallery rules', () => {
    const r = gradeRiggedSelection({}, field, label);
    expect(r.status).toBe('pending');
  });

  it('never claims a rig when the asset itself is unresolved', () => {
    const broken = historyData({ ...emptyHistory(), selectedId: 'nope' });
    const r = gradeRiggedSelection({ ...broken, [field]: 0 }, field, label);
    expect(r.status).not.toBe('pass');
  });
});

describe('riggedMeshSelected — the Checker the pipeline registers', () => {
  it('is a Checker over the step data', () => {
    const c = riggedMeshSelected('mesh', 'A rigged mesh candidate is selected');
    expect(c(meshArtifact('mesh', GRUNT_RIG)).status).toBe('pass');
    expect(c(meshArtifact('mesh')).status).toBe('deferred');
  });
});

describe('ROUND TRIP — real GLB → real gate → payload → grader', () => {
  // The whole contract, end to end, with no stubbed verdict anywhere: the committed
  // fixture is genuine skin-tokens.cpp output, `gateRig` is the real Tier-1 gate, and the
  // grader is what the bestiary step registers. This is what proves a producer that calls
  // `rigCandidatePayload` will actually turn the step green — a grader tested only against
  // hand-made records could pass while the writer emitted a shape it cannot read.
  it('turns a genuinely rigged mesh into a passing bestiary verdict', async () => {
    const { gateRig } = await import('@/lib/visual-gen/rig-gate');
    const { join } = await import('node:path');

    const gated = gateRig(
      join(process.cwd(), 'src', '__tests__', 'fixtures', 'rig', 'skintokens_cube_rigged.glb'),
    );
    expect(gated.ok).toBe(true);

    const payload = rigCandidatePayload({ rig: gated.verdict, facts: gated.facts });
    expect(payload.rig).toBeTruthy();

    const batch = makeBatch({
      seq: 0,
      at: '2026-01-01T00:00:00.000Z',
      direction: 'rig the creature',
      prompt: 'skintokens rig',
      candidates: [{
        swatch: 'linear-gradient(#111,#222)',
        caption: 'grunt',
        payload: { mesh: 0, glbUrl: '/api/visual-gen/asset/grunt.glb', ...payload },
      }],
    });
    const h = appendBatch(emptyHistory(), batch);
    const data = historyData({ ...h, selectedId: batch.candidates[0].id });

    const verdict = riggedMeshSelected('mesh', 'A rigged mesh candidate is selected')(data);
    expect(verdict.status).toBe('pass');
    expect(verdict.tier).toBe('L2');
    expect(verdict.detail).toMatch(/6 joints/); // the fixture's real skeleton
  });

  it('leaves the same artifact DEFERRED when the gate was never run', () => {
    // Identical candidate, minus the rig record: the step must not pass on the mesh alone.
    const batch = makeBatch({
      seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'd', prompt: 'p',
      candidates: [{
        swatch: 'linear-gradient(#111,#222)',
        caption: 'grunt',
        payload: { mesh: 0, glbUrl: '/api/visual-gen/asset/grunt.glb' },
      }],
    });
    const h = appendBatch(emptyHistory(), batch);
    const data = historyData({ ...h, selectedId: batch.candidates[0].id });
    expect(riggedMeshSelected('mesh', 'x')(data).status).toBe('deferred');
  });
});
