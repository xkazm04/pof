/**
 * asset-viewer-and-browser/A (scan-sweep --challenge run challenge-2026-09-29c):
 * the viewer grades through the Tier-1 gate — one request (`gateRequestFor`), one severity
 * (the gate's own `scoreMesh`), so the inspection screen and the job verdict cannot
 * disagree on a fact both can measure (a triangle count and a bounding box).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gradeViewerAsset } from '@/components/modules/visual-gen/asset-viewer/assetGrade';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';
import * as critique from '@/lib/visual-gen/mesh-critique';
import { scoreMesh, type MeshMetrics, type Finding } from '@/lib/visual-gen/mesh-critique';
import { gateRequestFor } from '@/lib/visual-gen/gate-request';

const statsOf = (faces: number, bbox: readonly number[], vertices = faces): AssetStats =>
  ({
    triangles: faces, vertices, meshes: 1, drawCalls: 1, materials: [], textures: [], animations: [],
    boundingBox: { width: bbox[0], height: bbox[1], depth: bbox[2] },
  }) as unknown as AssetStats;

/** A mesh the viewer cannot see the topology of, stated as clean — only faces + bbox differ. */
const clean = (faces: number, bbox: readonly number[], verts = faces): MeshMetrics => ({
  verts, faces, watertight: true, windingConsistent: true, components: 1, euler: 2,
  bbox: [bbox[0], bbox[1], bbox[2]], volume: null, area: 0, degenerateFaces: 0,
});

const GEOMETRY = new Set(['empty-mesh', 'degenerate-bbox', 'face-count', 'budget-over', 'scale-off', 'orientation-lying']);
const brief = (fs: readonly Finding[]) => fs.map((f) => `${f.code}:${f.severity}:${f.reason}`);
const CHAIR_BBOX = [1.069, 0.569, 0.599];

describe('case 1: the chair holds the class ceiling as the gate does — a WARN', () => {
  it('83,728 tris as a prop -> exactly one face-count:warn, verdict warn', () => {
    const g = gradeViewerAsset(statsOf(83728, CHAIR_BBOX), 'prop')!;
    expect(g.findings.map((f) => `${f.code}:${f.severity}`)).toEqual(['face-count:warn']);
    expect(g.verdict).toBe('warn');
  });
});

describe('case 2: parity sweep against scoreMesh + gateRequestFor', () => {
  it('0 mismatches over class x target x bbox x faces', () => {
    const mismatches: string[] = [];
    let cells = 0;
    for (const cls of ['character', 'prop', 'weapon', 'Character', 'hero', undefined]) {
      for (const target of [undefined, 0, 1.0, 1.8]) {
        for (const bbox of [[1.8, 0.5, 0.6], [0.5, 1.8, 0.6], CHAIR_BBOX]) {
          for (const faces of [9000, 83728]) {
            cells += 1;
            const viewer = gradeViewerAsset(statsOf(faces, bbox), cls, target)!;
            const { deps } = gateRequestFor({ assetClass: cls, stage: 'raw', targetExtentM: target });
            const gate = scoreMesh(clean(faces, bbox), deps.thresholds, deps.budget, deps.size, deps.orientation)
              .findings.filter((f) => GEOMETRY.has(f.code));
            if (JSON.stringify(brief(viewer.findings)) !== JSON.stringify(brief(gate))) {
              mismatches.push(`${cls}/${target}/${bbox.join('x')}/${faces}: viewer ${brief(viewer.findings)} gate ${brief(gate)}`);
            }
          }
        }
      }
    }
    expect(cells).toBe(144);
    expect(mismatches).toEqual([]);
  });
});

describe('case 5 (coordinator revision): class-blind is never graded green, never less severe', () => {
  it('class undefined + target 1.8 on the chair box -> scale-off:warn, verdict warn', () => {
    const g = gradeViewerAsset(statsOf(9000, CHAIR_BBOX), undefined, 1.8)!;
    expect(g.findings.map((f) => `${f.code}:${f.severity}`)).toContain('scale-off:warn');
    expect(g.verdict).toBe('warn');
  });

  it('0 triangles -> empty-mesh:fail, verdict fail', () => {
    for (const cls of [undefined, 'hero']) {
      const g = gradeViewerAsset(statsOf(0, [0.5, 1.8, 0.6], 0), cls)!;
      expect(g.findings.map((f) => `${f.code}:${f.severity}`)).toContain('empty-mesh:fail');
      expect(g.verdict).toBe('fail');
    }
  });

  it('no findings -> unmeasured, never pass (5,000 tris standing upright)', () => {
    for (const cls of [undefined, 'hero']) {
      const g = gradeViewerAsset(statsOf(5000, [0.5, 1.8, 0.6]), cls)!;
      expect(g.findings).toEqual([]);
      expect(g.verdict).toBe('unmeasured');
    }
  });
});

describe('case 6: a clean character passes on geometry, and says what it cannot see', () => {
  it('standing 20k-tri character at 1.8 m -> pass + the six trimesh-only codes', () => {
    const g = gradeViewerAsset(statsOf(20000, [0.5, 1.8, 0.6], 10000), 'character', 1.8)!;
    expect(g.findings).toEqual([]);
    expect(g.verdict).toBe('pass');
    expect(g.gateOnly).toEqual([
      'not-watertight', 'winding', 'degenerate-faces', 'floaters', 'parts-over-budget', 'components-over-budget',
    ]);
  });
});

describe('case 7: source check — one request rule, a client-safe scorer', () => {
  const live = (path: string) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');

  it('assetGrade.ts imports gateRequestFor and re-derives none of its rules', () => {
    const src = live('src/components/modules/visual-gen/asset-viewer/assetGrade.ts');
    expect(src).toMatch(/import\s*\{[^}]*\bgateRequestFor\b[^}]*\}\s*from\s*'@\/lib\/visual-gen\/gate-request'/);
    expect(src).not.toMatch(/\bresolveAssetClass\b/);
    expect(src).not.toMatch(/\bnominalExtentFor\b/);
    expect(src).not.toMatch(/\bexpectsUprightFor\b/);
  });

  it('mesh-score.ts has no node:* import, and mesh-critique re-exports its scorer', async () => {
    const src = readFileSync('src/lib/visual-gen/mesh-score.ts', 'utf8');
    expect(src).not.toMatch(/from\s*'node:/);
    const spec = '@/lib/visual-gen/mesh-score';
    const score = await import(/* @vite-ignore */ spec);
    expect(critique.scoreMesh).toBe(score.scoreMesh);
    expect(critique.DEFAULT_THRESHOLDS).toBe(score.DEFAULT_THRESHOLDS);
  });
});

// ── [guard] green before the move by design: the gate's scorer is byte-identical ─────────
const BASE: MeshMetrics = {
  verts: 50, faces: 300_000, watertight: false, windingConsistent: false, components: 20, euler: 0,
  bbox: [1.8, 0.5, 0], volume: null, area: 1, degenerateFaces: 3,
};
const W = (code: string, reason: string) => ({ code, severity: 'warn', reason });
const F = (code: string, reason: string) => ({ code, severity: 'fail', reason });
const LYING = 'the subject should stand, but its longest extent (1.80 m) is on the x axis while the up axis measures only 0.50 m — the asset is lying on its side. Rotate 90° about Z before import. Until it is stood up, the world-scale grade above is comparing its sideways length to the intended height';

describe('case 8 [guard]: scoreMesh (via mesh-critique) is unchanged over every FindingCode', () => {
  const pick = (s: ReturnType<typeof scoreMesh>) => ({ verdict: s.verdict, score: s.score, reasons: s.reasons, findings: s.findings });

  it('fixtures together exercise all 12 codes, fails-then-warns, byte-identical', () => {
    const a = pick(scoreMesh(
      { ...BASE, componentFaces: [5000, 4000, 3000, 2000, 1500, 1400, 1300, 1200, 1100, 1000, 3, 2, 2, 1, 1], componentFacesOmitted: 0 },
      {}, { triangleBudget: 1000, topology: 'triangles' }, { targetExtentM: 0.5 }, { expectUpright: true },
    ));
    const aFindings = [
      F('empty-mesh', 'empty/degenerate mesh (50 verts, 300000 faces)'),
      F('degenerate-bbox', 'degenerate bounding box (flat: 1.80×0.50×0.00)'),
      F('floaters', '5 floater fragments (9 faces of specks)'),
      F('parts-over-budget', '10 substantial disconnected parts (above the 8 budget for this class)'),
      W('not-watertight', 'not watertight (open boundary / holes)'),
      W('winding', 'inconsistent face winding (normals may flip)'),
      W('degenerate-faces', '3 degenerate faces'),
      W('face-count', 'high face count (300000) — needs decimation for game use'),
      W('budget-over', 'delivered 300000 triangles against a 1000-triangles budget (300.0x) — the provider did not honour the requested budget; re-request with an explicit face limit or decimate before shipping'),
      W('scale-off', 'delivered 1.80 m longest extent against a 0.50 m target (3.60x); import with ImportUniformScale 0.28 or rescale before shipping'),
      W('orientation-lying', LYING),
    ];
    expect(a).toEqual({ verdict: 'fail', score: 0, reasons: aFindings.map((f) => f.reason), findings: aFindings });

    const b = pick(scoreMesh({ ...BASE, verts: 5000, faces: 0, bbox: [1, 1, 1] }, {}));
    const bFindings = [
      F('empty-mesh', 'empty/degenerate mesh (5000 verts, 0 faces)'),
      F('components-over-budget', '20 disconnected components (fragmented / floaters)'),
      W('not-watertight', 'not watertight (open boundary / holes)'),
      W('winding', 'inconsistent face winding (normals may flip)'),
      W('degenerate-faces', '3 degenerate faces'),
    ];
    expect(b).toEqual({ verdict: 'fail', score: 0, reasons: bFindings.map((f) => f.reason), findings: bFindings });

    const c = pick(scoreMesh({
      ...BASE, verts: 5000, faces: 10000, bbox: [0.5, 1.8, 0.6], watertight: true, windingConsistent: true,
      degenerateFaces: 0, components: 3, componentFaces: [9000, 900, 2],
    }, {}));
    expect(c).toEqual({
      verdict: 'warn', score: 85, reasons: ['1 floater fragments (2 faces of specks)'],
      findings: [W('floaters', '1 floater fragments (2 faces of specks)')],
    });

    const codes = new Set([...a.findings, ...b.findings, ...c.findings].map((f) => f.code));
    expect(codes.size).toBe(12);
  });
});
