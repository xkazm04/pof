import { describe, it, expect } from 'vitest';
import {
  UV_STRETCH_CLEAN_P95,
  UV_STRETCH_CLEAN_BAD_FRAC,
  UV_STRETCH_POOR_BAD_FRAC,
  gradeUvStretch,
  parseMeshFinishOutput,
} from '@/lib/visual-gen/mesh-finish';

/**
 * Every number below is CAPTURED from Blender 4.2.1 headless on 2026-09-07, not invented:
 * `pof_mesh_finish.py` run over two real Tripo characters already in `generated/`.
 * The two unwrap modes separate into non-overlapping bands, and a 13x change in the face
 * budget barely moves either — the metric tracks the LAYOUT, not the density.
 *
 *   jinx_hd.glb        40000  smart          p95 1.1206  bad 0.0000
 *   jinx_v32_idle.glb  40000  smart          p95 1.1262  bad 0.0000
 *   jinx_hd.glb        40000  pack-existing  p95 1.7202  bad 0.0266
 *   jinx_v32_idle.glb  40000  pack-existing  p95 1.6591  bad 0.0232
 *   jinx_hd.glb         3000  pack-existing  p95 1.7303  bad 0.0240
 */
const SMART_HD = `POF_MESHFINISH_FACES_IN=1492072
POF_MESHFINISH_RETOPO=collapse
POF_MESHFINISH_FACES_OUT=40000
POF_MESHFINISH_UV_MODE=smart
POF_MESHFINISH_UV=1
POF_MESHFINISH_UV_STRETCH_P95=1.1206
POF_MESHFINISH_UV_STRETCH_BAD_FRAC=0.0000
POF_MESHFINISH_UV_STRETCH_DEGENERATE=0
POF_MESHFINISH_SIZE_MB=4.26
POF_MESHFINISH_DONE=C:/gen/jinx_smart.glb`;

const PACK_HD = `POF_MESHFINISH_FACES_IN=1492072
POF_MESHFINISH_FACES_OUT=40000
POF_MESHFINISH_UV_MODE=pack-existing
POF_MESHFINISH_UV=1
POF_MESHFINISH_UV_STRETCH_P95=1.7202
POF_MESHFINISH_UV_STRETCH_BAD_FRAC=0.0266
POF_MESHFINISH_UV_STRETCH_DEGENERATE=0
POF_MESHFINISH_SIZE_MB=3.59
POF_MESHFINISH_DONE=C:/gen/jinx_pack.glb`;

describe('parseMeshFinishOutput — UV stretch', () => {
  it('reads the three captured stretch markers off a real smart-project run', () => {
    const p = parseMeshFinishOutput(SMART_HD);
    expect(p.ok).toBe(true);
    expect(p.uvUnwrapped).toBe(true);
    expect(p.uvStretchP95).toBeCloseTo(1.1206, 4);
    expect(p.uvStretchBadFraction).toBe(0);
    expect(p.uvStretchDegenerate).toBe(0);
  });

  it('grades the captured smart run clean and the captured pack-existing run uneven', () => {
    expect(parseMeshFinishOutput(SMART_HD).uvStretch).toBe('clean');
    expect(parseMeshFinishOutput(PACK_HD).uvStretch).toBe('uneven');
  });

  it('names WHY an uneven layout is uneven, in the unit that was measured', () => {
    const reason = parseMeshFinishOutput(PACK_HD).uvStretchReason;
    expect(reason).toBeDefined();
    expect(reason).toContain('2.7%');
    expect(reason).toContain('1.72');
  });

  it('says nothing about stretch when the run never unwrapped', () => {
    const p = parseMeshFinishOutput('POF_MESHFINISH_UV=0\nPOF_MESHFINISH_DONE=C:/gen/x.glb');
    expect(p.uvStretch).toBeUndefined();
    expect(p.uvStretchReason).toBeUndefined();
    expect(p.uvStretchP95).toBeUndefined();
  });

  it('surfaces the script\'s own refusal to measure rather than inventing a grade', () => {
    const p = parseMeshFinishOutput(
      'POF_MESHFINISH_UV=1\nPOF_MESHFINISH_UV_STRETCH_UNMEASURED=no active UV layer or no triangles to measure\nPOF_MESHFINISH_DONE=C:/gen/x.glb',
    );
    expect(p.uvStretch).toBe('unmeasured');
    expect(p.uvStretchReason).toContain('no active UV layer');
  });
});

describe('gradeUvStretch', () => {
  it('holds the measured smart band clean and the measured pack band uneven', () => {
    expect(gradeUvStretch(1.1206, 0.0, 0)?.verdict).toBe('clean');
    expect(gradeUvStretch(1.1262, 0.0, 0)?.verdict).toBe('clean');
    expect(gradeUvStretch(1.7202, 0.0266, 0)?.verdict).toBe('uneven');
    expect(gradeUvStretch(1.6591, 0.0232, 0)?.verdict).toBe('uneven');
    expect(gradeUvStretch(1.7303, 0.024, 0)?.verdict).toBe('uneven');
  });

  it('leaves the clean thresholds strictly between the two observed bands', () => {
    // The widest observed clean run must pass, the tightest observed pack run must not.
    expect(UV_STRETCH_CLEAN_P95).toBeGreaterThan(1.1262);
    expect(UV_STRETCH_CLEAN_P95).toBeLessThan(1.6591);
    expect(UV_STRETCH_CLEAN_BAD_FRAC).toBeLessThan(0.0232);
  });

  it('calls any degenerate face poor — a zero-area island is unbakeable, not merely uneven', () => {
    const g = gradeUvStretch(1.05, 0, 1);
    expect(g?.verdict).toBe('poor');
    expect(g?.reason).toContain('zero UV area');
  });

  it('calls a layout poor once the bad fraction passes the argued ceiling', () => {
    expect(gradeUvStretch(3.0, UV_STRETCH_POOR_BAD_FRAC + 0.01, 0)?.verdict).toBe('poor');
  });

  it('never grades on numbers it does not have', () => {
    expect(gradeUvStretch(undefined, undefined, undefined)).toBeUndefined();
    expect(gradeUvStretch(1.1, undefined, 0)).toBeUndefined();
  });
});

describe('runMeshFinish — the grade must survive the result copy', () => {
  it('carries the stretch grade all the way onto MeshFinishResult', async () => {
    const { runMeshFinish } = await import('@/lib/visual-gen/mesh-finish');
    const res = await runMeshFinish(
      { highPolyPath: 'C:/gen/hi.glb', outputPath: 'C:/gen/jinx_pack.glb', targetFaces: 40_000, unwrap: true },
      {
        env: { POF_BLENDER: 'C:/blender.exe' },
        fileExists: () => true,
        run: async () => ({ stdout: PACK_HD, code: 0 }),
      },
    );
    expect(res.ok).toBe(true);
    expect(res.uvStretch).toBe('uneven');
    expect(res.uvStretchP95).toBeCloseTo(1.7202, 4);
    expect(res.uvStretchReason).toContain('2.7%');
  });
});
