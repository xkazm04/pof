/**
 * asset-viewer-and-browser/A (scan-sweep --challenge run challenge-2026-09-29c): the /3d
 * inspector paints each row with the Tier-1 gate's own severity, shows orientation, and
 * states what only the gate (trimesh) can measure instead of implying a bare PASS.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StudioInspector } from '@/components/studio-3d/StudioInspector';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';

const statsOf = (triangles: number, bbox: readonly number[]): AssetStats =>
  ({
    triangles, vertices: Math.round(triangles / 2), meshes: 1, drawCalls: 1,
    materials: [], textures: [], animations: [],
    boundingBox: { width: bbox[0], height: bbox[1], depth: bbox[2] },
  }) as unknown as AssetStats;

function loaded(stats: AssetStats, cls: 'character' | 'prop', target: number | null = null) {
  const s = useViewerStore.getState();
  s.setModel('/api/visual-gen/asset/m.glb', 'm.glb');
  s.reportLoaded('/api/visual-gen/asset/m.glb', stats);
  s.setAssetClass(cls);
  s.setTargetExtentM(target);
}

afterEach(() => { cleanup(); useViewerStore.getState().reset(); });

describe('case 3: a lying character shows its orientation row', () => {
  it('renders verdict-lying with the orientation line, severity warn', () => {
    loaded(statsOf(30000, [1.8, 0.5, 0.6]), 'character', 1.8);
    render(<StudioInspector modelName="m.glb" />);
    const row = screen.getByTestId('verdict-lying');
    expect(row.textContent).toMatch(/lying on its side/);
    expect(row.getAttribute('data-severity')).toBe('warn');
    expect(screen.getByTestId('geometry-rollup').textContent).toContain('orientation-lying');
  });
});

describe('case 4: over-ceiling is the gate WARN, never painted as a failure', () => {
  it('chair as a prop -> verdict-over carries data-severity=warn and the --lab-warn tone', () => {
    loaded(statsOf(83728, [1.069, 0.569, 0.599]), 'prop');
    render(<StudioInspector modelName="chair.glb" />);
    fireEvent.change(screen.getByLabelText('Asset class'), { target: { value: 'prop' } });
    const row = screen.getByTestId('verdict-over');
    expect(row.getAttribute('data-severity')).toBe('warn');
    expect(row.innerHTML).toContain('var(--lab-warn)');
    expect(row.innerHTML).not.toContain('var(--lab-bad)');
    expect(row.textContent).toContain('83,728');
    expect(row.textContent).toContain('15,000');
  });
});

describe('case 6: the roll-up is geometry-only and names what only the gate measures', () => {
  it('a clean standing character reads a geometry pass, never a bare PASS', () => {
    loaded(statsOf(20000, [0.5, 1.8, 0.6]), 'character', 1.8);
    render(<StudioInspector modelName="m.glb" />);
    const rollup = screen.getByTestId('geometry-rollup');
    expect(rollup.getAttribute('data-verdict')).toBe('pass');
    expect(rollup.textContent).toMatch(/geometry/i);
    expect(rollup.textContent).toMatch(/only by the Tier-1 gate/i);
    for (const code of ['not-watertight', 'winding', 'degenerate-faces', 'floaters', 'parts-over-budget', 'components-over-budget']) {
      expect(rollup.textContent).toContain(code);
    }
    expect(screen.queryByText(/^\s*✓?\s*PASS\s*$/)).toBeNull();
  });
});
