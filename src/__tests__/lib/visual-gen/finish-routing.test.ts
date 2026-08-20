/**
 * The critique → mesh-finish edge, and the paid loop that must stop believing a
 * stage-determined verdict is worth another generation.
 *
 * Fixtures are the 2026-08-20 measurement of the operator's real corpus (see
 * `critique-stage.test.ts` for the method — Node glTF parsing, never python).
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreMesh, type MeshMetrics, type CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import { critiqueThresholdsFor } from '@/lib/visual-gen/polycount-presets';
import {
  planFinishFromCritique,
  summarizeRemediation,
  finishOutputPath,
  FINISH_OUTPUT_DIR,
} from '@/lib/visual-gen/finish-routing';
import { generateUntilAcceptable, DEFAULT_MAX_ATTEMPTS } from '@/lib/visual-gen/best-of-n';
import { ASSET_DIRS } from '@/lib/visual-gen/generated-assets';

function metrics(over: Partial<MeshMetrics> = {}): MeshMetrics {
  return {
    verts: 250_000, faces: 501_000, watertight: false, windingConsistent: true,
    components: 1, euler: 0, bbox: [0.6, 1.8, 0.4], volume: null, area: 0,
    degenerateFaces: 0, componentFaces: [501_000], componentFacesOmitted: 0,
    ...over,
  };
}
function critiqueOf(m: MeshMetrics, assetClass = 'prop'): CritiqueResult {
  return { ok: true, metrics: m, ...scoreMesh(m, critiqueThresholdsFor(assetClass)) };
}

/** The live-recorded Tripo chest: ~501k faces, 40 substantial parts against a budget of 6. */
const FRAGMENTED = metrics({
  components: 40,
  componentFaces: Array.from({ length: 40 }, () => Math.floor(501_000 / 40)),
});
/** The real decimated game mesh — 16 specks. Finishing cannot help it. */
const SPECKED = metrics({
  verts: 23_500, faces: 46_791, components: 17,
  componentFaces: [46_527, 30, 22, 20, 20, 18, 18, 17, 16, 16, 15, 15, 14, 14, 13, 13, 3],
});

describe('planFinishFromCritique — path guards (the unreviewed write primitive)', () => {
  it('refuses a traversal / absolute input name', () => {
    for (const bad of ['../../etc/passwd', 'C:/Windows/x.glb', 'a/b.glb', 'x.exe', '']) {
      const p = planFinishFromCritique({ meshName: bad, meshDir: 'tripo3d', critique: critiqueOf(FRAGMENTED), assetClass: 'prop' });
      expect(p.ok, bad).toBe(false);
    }
  });

  it('refuses a dir outside the ASSET_DIRS allow-list', () => {
    const p = planFinishFromCritique({ meshName: 'x.glb', meshDir: '../secrets', critique: critiqueOf(FRAGMENTED), assetClass: 'prop' });
    expect(p.ok).toBe(false);
  });

  it('only ever writes into the allow-listed mesh-finish dir', () => {
    expect(ASSET_DIRS.some((d) => d.dir === FINISH_OUTPUT_DIR)).toBe(true);
    const out = finishOutputPath('jinx_hd.glb', 1_700_000_000_000, '/repo');
    expect(out).toBe('/repo/generated/mesh-finish/jinx_hd_finish_1700000000000.glb');
    expect(finishOutputPath('../evil.glb', 1, '/repo')).toBeNull();
  });
});

describe('planFinishFromCritique — routing decisions', () => {
  it('routes a fail whose criteria the retopo stage exists to satisfy', () => {
    const p = planFinishFromCritique({ meshName: 'chest.glb', meshDir: 'tripo3d', critique: critiqueOf(FRAGMENTED), assetClass: 'prop', now: 1, cwd: '/repo' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.addresses).toContain('parts-over-budget');
    expect(p.spec.targetFaces).toBe(10_000); // the authored prop budget, in triangles
    expect(p.spec.highPolyPath).toBe('/repo/generated/tripo3d/chest.glb');
  });

  it('NEVER sets cullInterior — the loose_shell_count memory bomb has no caller and must not gain one', () => {
    const p = planFinishFromCritique({ meshName: 'chest.glb', meshDir: 'tripo3d', critique: critiqueOf(FRAGMENTED), assetClass: 'prop' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.spec.cullInterior).toBeUndefined();
  });

  it('refuses a floater-only failure — decimation multiplies specks, measured', () => {
    const p = planFinishFromCritique({ meshName: 'jinx_v32_run_game.glb', meshDir: 'tripo3d', critique: critiqueOf(SPECKED, 'character'), assetClass: 'character' });
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.reason).toMatch(/multiply/i);
  });

  it('refuses a passing / warning verdict, an unavailable critic, and an already-finished mesh', () => {
    const clean = critiqueOf(metrics({ faces: 9_000, componentFaces: [9_000] }));
    expect(planFinishFromCritique({ meshName: 'a.glb', meshDir: 'tripo3d', critique: clean, assetClass: 'prop' }).ok).toBe(false);
    expect(planFinishFromCritique({ meshName: 'a.glb', meshDir: 'tripo3d', critique: { ok: false, unavailable: true, error: 'no venv' } }).ok).toBe(false);
    expect(planFinishFromCritique({ meshName: 'a.glb', meshDir: 'tripo3d', critique: undefined }).ok).toBe(false);
    expect(planFinishFromCritique({ meshName: 'a.glb', meshDir: 'tripo3d', critique: critiqueOf(FRAGMENTED), assetClass: 'prop', stage: 'finished' }).ok).toBe(false);
  });

  it('refuses to route on prose when the card carries no defect codes', () => {
    const codeless: CritiqueResult = { ok: true, verdict: 'fail', score: 0, reasons: ['something is wrong'] };
    const p = planFinishFromCritique({ meshName: 'a.glb', meshDir: 'tripo3d', critique: codeless, assetClass: 'prop' });
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.reason).toMatch(/guess/);
  });
});

describe('summarizeRemediation — a finish that ran is not a finish that fixed it', () => {
  it('reports a completed finish that left the mesh failing as NOT improved', () => {
    const out = summarizeRemediation(critiqueOf(FRAGMENTED), critiqueOf(SPECKED, 'character'));
    expect(out.improved).toBe(false);
    expect(out.summary).toMatch(/fail .* -> fail/);
  });

  it('names codes the finish INTRODUCED, not only the ones it resolved', () => {
    const before = critiqueOf(FRAGMENTED, 'prop');           // parts-over-budget
    const after = critiqueOf(SPECKED, 'character');           // floaters
    const out = summarizeRemediation(before, after);
    expect(out.summary).toMatch(/INTRODUCED: floaters/);
    expect(out.summary).toMatch(/resolved: parts-over-budget/);
  });

  it('an ungraded finished mesh is never treated as an improvement', () => {
    const out = summarizeRemediation(critiqueOf(FRAGMENTED), { ok: false, unavailable: true, error: 'no venv' });
    expect(out.improved).toBe(false);
    expect(out.after).toBeUndefined();
    expect(out.summary).toMatch(/NOT re-graded/);
  });

  it('reports a real improvement when the finished mesh clears the failure', () => {
    const after = critiqueOf(metrics({ faces: 9_800, componentFaces: [9_800] }));
    const out = summarizeRemediation(critiqueOf(FRAGMENTED), after);
    expect(out.improved).toBe(true);
  });
});

describe('the paid retry loop stops at ONE roll on a stage-determined verdict', () => {
  it('does not buy a second generation for a part-budget failure', async () => {
    const roll = vi.fn(async (n: number) => ({ ok: true, meshPath: `/m_a${n}.glb` }));
    const out = await generateUntilAcceptable(roll, {
      critic: async () => critiqueOf(FRAGMENTED, 'prop'),
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });
    expect(roll).toHaveBeenCalledTimes(1); // was 2 before: attempt 2 existed only to prove the repeat
    expect(out.accepted).toBe(false);
    expect(out.stageStop?.rollsAvoided).toBe(2);
    expect(out.stageStop?.finishResolvable).toContain('parts-over-budget');
    expect(out.note).toMatch(/PRE-FINISH/);
  });

  it('still pays for a second roll when the failure is a genuinely bad draw', async () => {
    const empty = critiqueOf(metrics({ verts: 3, faces: 0, componentFaces: [] }));
    const roll = vi.fn(async (n: number) => ({ ok: true, meshPath: `/m_a${n}.glb` }));
    const out = await generateUntilAcceptable(roll, { critic: async () => empty, maxAttempts: 3 });
    expect(roll.mock.calls.length).toBeGreaterThan(1);
    expect(out.stageStop).toBeUndefined();
  });

  it('a card with no defect codes falls back to reproduce-then-stop, never to a guess', async () => {
    const codeless: CritiqueResult = { ok: true, verdict: 'fail', score: 0, reasons: ['33 floater fragments'] };
    const roll = vi.fn(async (n: number) => ({ ok: true, meshPath: `/m_a${n}.glb` }));
    const out = await generateUntilAcceptable(roll, { critic: async () => codeless, maxAttempts: 3 });
    expect(roll).toHaveBeenCalledTimes(2);
    expect(out.stageStop).toBeUndefined();
  });

  it('an accepted first roll is unaffected', async () => {
    const clean = critiqueOf(metrics({ faces: 9_000, watertight: true, componentFaces: [9_000], bbox: [0.6, 0.6, 0.6] }));
    const roll = vi.fn(async () => ({ ok: true, meshPath: '/m.glb' }));
    const out = await generateUntilAcceptable(roll, { critic: async () => clean, maxAttempts: 3 });
    expect(out.accepted).toBe(true);
    expect(roll).toHaveBeenCalledTimes(1);
  });
});
