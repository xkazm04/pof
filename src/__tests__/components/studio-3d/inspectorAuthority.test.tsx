/**
 * Direction: studio-inspector-numbers-have-no-authority.
 *
 * The viewer printed six stats and a bounding box and graded none of them, under a
 * heading reading "Bounding Box (m)" — so `jinx.glb` read as a 1.00 m hero beside a
 * 180 cm Mannequin. Its only grader was a dead 494-LOC panel keyed to a rival constant
 * table (`UE5_PRESETS`: prop 100,000 tris) that contradicted the project's authored
 * budgets (`polycount-presets`: prop faceLimit 10,000 / warnAbove 15,000) by up to 10x.
 *
 * Numbers below are MEASURED off the served meshes on 2026-08-19 by parsing the GLB
 * headers (node transforms applied, glTF metres): all 51 files sit at longest extent
 * 0.950-1.069; `chair.glb` = 83,728 triangles; `jinx_hd.glb` = 1,492,072.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { StudioInspector } from '@/components/studio-3d/StudioInspector';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { gradeViewerAsset } from '@/components/modules/visual-gen/asset-viewer/assetGrade';
import * as assetStats from '@/components/modules/visual-gen/asset-viewer/assetStats';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';
import { polycountFor } from '@/lib/visual-gen/polycount-presets';

// chair.glb, measured: 83,728 triangles, extents [1.069, 0.569, 0.599].
const CHAIR = {
  triangles: 83728, vertices: 41864, meshes: 1, drawCalls: 1,
  materials: [], textures: [], animations: [],
  boundingBox: { width: 1.069, height: 0.569, depth: 0.599 },
} as unknown as AssetStats;

// jinx_hd.glb, measured: 1,492,072 triangles, extents [0.213, 1.000, 0.453].
const JINX_HD = {
  triangles: 1492072, vertices: 746036, meshes: 1, drawCalls: 1,
  materials: [], textures: [], animations: [],
  boundingBox: { width: 0.213, height: 1.0, depth: 0.453 },
} as unknown as AssetStats;

function loaded(stats: AssetStats) {
  const s = useViewerStore.getState();
  s.setModel('/api/visual-gen/asset/chair.glb', 'chair.glb');
  s.reportLoaded('/api/visual-gen/asset/chair.glb', stats);
}

afterEach(() => { cleanup(); useViewerStore.getState().reset(); });

describe('no second triangle-budget table survives', () => {
  it('assetStats.ts exports no budget constants or grader', () => {
    const mod = assetStats as unknown as Record<string, unknown>;
    expect(mod.UE5_PRESETS).toBeUndefined();
    expect(mod.DEFAULT_UE5_PROP_BUDGET).toBeUndefined();
    expect(mod.findBudgetViolations).toBeUndefined();
  });

  it('the source file holds no rival threshold numbers', () => {
    const src = readFileSync('src/components/modules/visual-gen/asset-viewer/assetStats.ts', 'utf8');
    // The rival table's four ceilings. They may only appear inside the comment that
    // records why they were removed, never as live code.
    const live = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .join('\n');
    expect(live).not.toMatch(/maxTriangles/);
    expect(live).not.toMatch(/100_000|200_000|500_000/);
  });

  it('the dead AssetInspector panel is gone', () => {
    expect(() => readFileSync('src/components/modules/visual-gen/asset-viewer/AssetInspector/index.tsx', 'utf8'))
      .toThrow();
    expect(() => readFileSync('src/components/modules/visual-gen/asset-viewer/AssetInspector/BudgetSection.tsx', 'utf8'))
      .toThrow();
  });

  it('feature-definitions no longer declares UE5_PRESETS or the AssetInspector panel', () => {
    const src = readFileSync('src/lib/feature-definitions.ts', 'utf8');
    const row = src.split('\n').find((l) => l.includes("featureName: 'Asset stats and budget inspector'"));
    expect(row).toBeTruthy();
    expect(row).not.toMatch(/UE5_PRESETS/);
    expect(row).not.toMatch(/AssetInspector/);
    expect(row).toMatch(/polycount-presets/);
  });
});

describe('gradeViewerAsset — the budget resolves through polycountFor', () => {
  it('grades unmeasured, never "within budget", with no class stated', () => {
    const g = gradeViewerAsset(CHAIR, undefined)!;
    expect(g.budget.verdict).toBe('unmeasured');
    expect(g.assetClass).toBeUndefined();
    expect(g.budgetLine.toLowerCase()).not.toContain('within budget');
  });

  it('grades chair.glb 83,728 tris OVER the authored prop ceiling', () => {
    const g = gradeViewerAsset(CHAIR, 'prop')!;
    expect(polycountFor('prop')!.warnAbove).toBe(15_000); // the authored number, not 100k
    expect(g.ceilingTriangles).toBe(15_000);
    expect(g.budget.verdict).toBe('over');
    expect(g.budget.ratio).toBeCloseTo(83728 / 15000, 3); // 5.58x
    expect(g.budgetLine).toContain('83,728');
  });

  it('grades jinx_hd.glb 1,492,072 tris OVER the character ceiling', () => {
    const g = gradeViewerAsset(JINX_HD, 'character')!;
    expect(g.ceilingTriangles).toBe(60_000);
    expect(g.budget.verdict).toBe('over');
    expect(g.budget.ratio).toBeCloseTo(1492072 / 60000, 2); // 24.87x
  });

  it('an unrecognised class is not silently promoted', () => {
    const g = gradeViewerAsset(CHAIR, 'hero')!; // the rival table had a "hero" preset
    expect(g.assetClass).toBeUndefined();
    expect(g.budget.verdict).toBe('unmeasured');
    expect(g.gradedAs).toContain('unrecognised');
  });

  it('does not grade the draw-call proxy', () => {
    const g = gradeViewerAsset({ ...CHAIR, drawCalls: 9999 } as AssetStats, 'prop')!;
    expect(JSON.stringify(g)).not.toContain('9999');
  });
});

describe('gradeViewerAsset — the size resolves through world-scale', () => {
  it('flags every served mesh as generator-normalised', () => {
    // The measured band across all 51 files: 0.950 - 1.069.
    for (const longest of [0.95, 1.0, 1.069]) {
      const g = gradeViewerAsset(
        { ...CHAIR, boundingBox: { width: longest, height: 0.5, depth: 0.5 } } as AssetStats,
        'prop',
      )!;
      expect(g.generatorNormalized).toBe(true);
      expect(g.longestExtentM).toBeCloseTo(longest, 3);
    }
  });

  it('holds a character to the 1.8 m Mannequin and reports the import scale', () => {
    const g = gradeViewerAsset(JINX_HD, 'character')!;
    expect(g.targetExtentM).toBe(1.8);
    expect(g.scale.verdict).toBe('off');
    expect(g.scale.importUniformScale).toBeCloseTo(1.8, 5);
    expect(g.scaleLine).toMatch(/generator-normalised/i);
  });

  it('invents no nominal size for a prop — unmeasured, with the reason', () => {
    const g = gradeViewerAsset(CHAIR, 'prop')!;
    expect(g.targetExtentM).toBeUndefined();
    expect(g.scale.verdict).toBe('unmeasured');
    expect(g.scaleLine).toMatch(/no target size was requested/i);
  });

  it('uses a stated target for any class', () => {
    // A 0.45 m chair against a 1.069 m delivery: 2.4x off, import at x0.42.
    const off = gradeViewerAsset(CHAIR, 'prop', 0.45)!;
    expect(off.targetExtentM).toBe(0.45);
    expect(off.scale.verdict).toBe('off');
    expect(off.scale.importUniformScale).toBeCloseTo(0.45 / 1.069, 4);

    const near = gradeViewerAsset(CHAIR, 'prop', 1.0)!;
    expect(near.scale.verdict).toBe('matches'); // 1.069 / 1.0 is inside SCALE_TOLERANCE
  });

  it('a stated target overrides the class nominal', () => {
    const g = gradeViewerAsset(JINX_HD, 'character', 1.0)!;
    expect(g.targetExtentM).toBe(1.0);
    expect(g.scale.verdict).toBe('matches');
  });
});

describe('StudioInspector renders the grades, not bare numbers', () => {
  it('never prints a bare extent under a metres heading', () => {
    loaded(CHAIR);
    render(<StudioInspector modelName="chair.glb" />);
    expect(screen.queryByText('Bounding Box (m)')).toBeNull();
    expect(screen.getByText(/glTF units/i)).toBeTruthy();
    // The heading says it, and world-scale's own reason says it again.
    expect(screen.getAllByText(/generator-normalised/i).length).toBeGreaterThan(0);
  });

  it('says UNMEASURED with no class stated, never "within budget"', () => {
    loaded(CHAIR);
    render(<StudioInspector modelName="chair.glb" />);
    expect(screen.getAllByTestId('verdict-unmeasured').length).toBeGreaterThan(0);
    expect(screen.queryByText(/within budget/i)).toBeNull();
  });

  it('grades chair.glb over the ceiling once the class is stated', () => {
    loaded(CHAIR);
    render(<StudioInspector modelName="chair.glb" />);
    fireEvent.change(screen.getByLabelText('Asset class'), { target: { value: 'prop' } });
    expect(screen.getByTestId('verdict-over')).toBeTruthy();
    expect(screen.getByTestId('verdict-over').textContent).toContain('83,728');
    expect(screen.getByTestId('verdict-over').textContent).toContain('15,000');
  });

  it('reports the import uniform scale for a character', () => {
    loaded(JINX_HD);
    render(<StudioInspector modelName="jinx_hd.glb" />);
    fireEvent.change(screen.getByLabelText('Asset class'), { target: { value: 'character' } });
    expect(screen.getByText(/Import uniform scale ×1\.80/)).toBeTruthy();
  });

  it('labels the material-slot count as a proxy instead of grading it', () => {
    loaded(CHAIR);
    render(<StudioInspector modelName="chair.glb" />);
    expect(screen.getByText(/proxy for draw calls, not a measured draw count/i)).toBeTruthy();
    expect(screen.queryByText('Draw Calls')).toBeNull();
  });
});
