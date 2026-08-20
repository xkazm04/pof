/**
 * The Tier-1 gate must be honest about WHAT it graded.
 *
 * Everything asserted here is pinned to a measurement taken on 2026-08-20 over the
 * operator's real corpus — all 52 `.glb` under `generated/`, metrics re-derived in Node
 * from the glTF buffers (never python: `scripts/visual-gen/pof_mesh_critique.py` calling
 * `trimesh.split()` consumed 211 GB and crashed the host on 2026-08-18) and graded by this
 * repo's own `scoreMesh`. The fixtures below are the REAL numbers from that corpus, not
 * invented shapes.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreMesh,
  summarizeGate,
  CRITIQUE_CALIBRATION_CAVEAT,
  type MeshMetrics,
  type CritiqueResult,
} from '@/lib/visual-gen/mesh-critique';
import { assessStage, FINISH_RESOLVES, REROLL_RESOLVES } from '@/lib/visual-gen/critique-stage';
import { critiqueThresholdsFor, POLYCOUNT_PRESETS } from '@/lib/visual-gen/polycount-presets';

/** Real measurements — file, faces, components, per-component face histogram. */
const CORPUS: Record<string, { verts: number; faces: number; components: number; componentFaces: number[] }> = {
  /** generated/tripo3d/jinx_hd.glb — the densest raw Tripo delivery on disk. */
  jinxHd: { verts: 748_142, faces: 1_492_072, components: 1, componentFaces: [1_492_072] },
  /** generated/tripo3d/jinx_v32_run.glb — raw, 2 components, 1 speck. */
  v32Run: { verts: 743_000, faces: 1_482_446, components: 2, componentFaces: [1_475_898, 6_548] },
  /** generated/tripo3d/jinx_v32_run_game.glb — the DECIMATED game mesh of the above. */
  v32RunGame: {
    verts: 23_500,
    faces: 46_791,
    components: 17,
    componentFaces: [46_527, 30, 22, 20, 20, 18, 18, 17, 16, 16, 15, 15, 14, 14, 13, 13, 3],
  },
};

function metrics(m: { verts: number; faces: number; components: number; componentFaces: number[] }): MeshMetrics {
  return {
    verts: m.verts,
    faces: m.faces,
    watertight: false,
    windingConsistent: true,
    components: m.components,
    euler: 0,
    bbox: [0.6, 1.8, 0.4],
    volume: null,
    area: 0,
    degenerateFaces: 0,
    componentFaces: [...m.componentFaces],
    componentFacesOmitted: 0,
  };
}

describe('the shipped calibration caveat named a mechanism the code does not have', () => {
  it('face count can NEVER fail a mesh — at any class threshold', () => {
    // 1,492,072 faces is the real jinx_hd delivery. The tightest ceiling in the table is
    // modular-part at 12,000 — 124x over. If face count could fail anything, it is this.
    for (const preset of POLYCOUNT_PRESETS) {
      const card = scoreMesh(metrics(CORPUS.jinxHd), critiqueThresholdsFor(preset.assetClass));
      expect(card.verdict, `${preset.assetClass} @ ${preset.warnAbove}`).not.toBe('fail');
      const faceFinding = card.findings.find((f) => f.code === 'face-count');
      expect(faceFinding?.severity, `${preset.assetClass}`).toBe('warn');
    }
  });

  it('the fallback caveat no longer blames face count', () => {
    // The previous value was:
    //   'gate calibrated for finished meshes; raw provider output may fail on face count alone'
    // which is false about `scoreMesh` and was printed beside every failing verdict.
    expect(CRITIQUE_CALIBRATION_CAVEAT).not.toMatch(/face count/i);
  });
});

describe('findings carry a stable defect class, not prose', () => {
  it('grades the real decimated game mesh as a floater failure, not a face-count one', () => {
    const card = scoreMesh(metrics(CORPUS.v32RunGame), critiqueThresholdsFor('character'));
    expect(card.verdict).toBe('fail');
    const fails = card.findings.filter((f) => f.severity === 'fail').map((f) => f.code);
    expect(fails).toEqual(['floaters']);
  });

  it('`reasons` stays byte-identical to the findings in the same order', () => {
    const card = scoreMesh(metrics(CORPUS.v32RunGame), critiqueThresholdsFor('character'));
    expect(card.reasons).toEqual(card.findings.map((f) => f.reason));
    // fails always precede warns — `failureShape` depends on reasons[0] being the
    // verdict-driving defect.
    const severities = card.findings.map((f) => f.severity);
    expect(severities.indexOf('warn') === -1 || severities.lastIndexOf('fail') < severities.indexOf('warn')).toBe(true);
  });
});

describe('retopo is not a cure for the dominant fail class — measured', () => {
  it('decimation multiplied the specks 1 -> 16 and turned a warn into a fail', () => {
    const before = scoreMesh(metrics(CORPUS.v32Run), critiqueThresholdsFor('character'));
    const after = scoreMesh(metrics(CORPUS.v32RunGame), critiqueThresholdsFor('character'));
    expect(before.verdict).toBe('warn');
    expect(after.verdict).toBe('fail');
  });

  it('so `floaters` is NOT listed as finish-resolvable', () => {
    expect(FINISH_RESOLVES).not.toContain('floaters');
    expect(FINISH_RESOLVES).toContain('face-count');
    expect(FINISH_RESOLVES).toContain('parts-over-budget');
  });

  it('and re-rolling is only ever worthwhile for a genuinely bad draw', () => {
    expect([...REROLL_RESOLVES].sort()).toEqual(['degenerate-bbox', 'empty-mesh']);
  });
});

function critiqueOf(m: MeshMetrics, assetClass: string): CritiqueResult {
  return { ok: true, metrics: m, ...scoreMesh(m, critiqueThresholdsFor(assetClass)) };
}

describe('assessStage', () => {
  it('names a raw mesh condemned only by post-finish criteria as MIS-TIERED', () => {
    // A raw delivery whose only FAIL is the part budget — exactly what the finish stage
    // (join → decimate) exists to satisfy.
    const fragmented = metrics({
      verts: 250_000,
      faces: 501_000,
      components: 40,
      componentFaces: Array.from({ length: 40 }, () => Math.floor(501_000 / 40)),
    });
    const a = assessStage(critiqueOf(fragmented, 'prop'), 'raw');
    expect(a.misTiered).toBe(true);
    expect(a.finishResolvable).toContain('parts-over-budget');
    expect(a.unaddressed).toEqual([]);
    expect(a.rerollWorthwhile).toBe(false);
    expect(a.caveat).toMatch(/PRE-FINISH/);
  });

  it('refuses to call a floater failure mis-tiered — finishing would not clear it', () => {
    const a = assessStage(critiqueOf(metrics(CORPUS.v32RunGame), 'character'), 'raw');
    expect(a.misTiered).toBe(false);
    expect(a.unaddressed).toContain('floaters');
    expect(a.finishWorthwhile).toBe(false);
    expect(a.caveat).toMatch(/not/i);
  });

  it('reports an undeclared stage as undeclared rather than guessing', () => {
    const a = assessStage(critiqueOf(metrics(CORPUS.v32RunGame), 'character'));
    expect(a.stage).toBe('unknown');
    expect(a.caveat).toMatch(/stage not declared/i);
  });

  it('cannot soften a verdict: nothing it returns is a pass, and a pass has no caveat', () => {
    const clean = metrics({ verts: 20_000, faces: 39_000, components: 1, componentFaces: [39_000] });
    const card = { ok: true, metrics: clean, ...scoreMesh(clean, critiqueThresholdsFor('character')) };
    const a = assessStage(card, 'raw');
    expect(a.caveat).toBeUndefined();
    expect(a.misTiered).toBe(false);
  });

  it('an UNAVAILABLE critic is never dressed up as a calibration problem', () => {
    const a = assessStage({ ok: false, unavailable: true, error: 'no venv' }, 'raw');
    expect(a.caveat).toBeUndefined();
    expect(a.misTiered).toBe(false);
  });
});

describe('summarizeGate carries the derived caveat, not a blanket one', () => {
  it('a raw fail on the part budget says the verdict is about the stage', () => {
    const fragmented = metrics({
      verts: 250_000,
      faces: 501_000,
      components: 40,
      componentFaces: Array.from({ length: 40 }, () => Math.floor(501_000 / 40)),
    });
    const s = summarizeGate(critiqueOf(fragmented, 'prop'), 'raw');
    expect(s.accepted).toBe(false);
    expect(s.ungated).toBe(false);
    expect(s.note).toMatch(/PRE-FINISH/);
    expect(s.note).not.toBe(CRITIQUE_CALIBRATION_CAVEAT);
  });

  it('a floater fail does NOT get the mis-tiered excuse', () => {
    const s = summarizeGate(critiqueOf(metrics(CORPUS.v32RunGame), 'character'), 'raw');
    expect(s.note).not.toMatch(/PRE-FINISH/);
    expect(s.note).toMatch(/floaters/);
  });
});
