import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StudioInspector } from '@/components/studio-3d/StudioInspector';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';

afterEach(() => { cleanup(); useViewerStore.setState({ stats: null }); });

const STATS = {
  triangles: 84000, vertices: 42000, meshes: 1, drawCalls: 1,
  materials: [], textures: [], animations: [],
  boundingBox: { width: 1, height: 1.2, depth: 0.9 },
} as unknown as AssetStats;

describe('StudioInspector', () => {
  it('renders stat tiles from the store stats', () => {
    useViewerStore.setState({ stats: STATS });
    render(<StudioInspector modelName="chair.glb" />);
    expect(screen.getByText('84.0k')).toBeTruthy(); // triangles via formatNumber
    expect(screen.getByText('42.0k')).toBeTruthy(); // vertices
    expect(screen.getByText('chair.glb')).toBeTruthy();
  });

  it('shows an empty line when no model is loaded', () => {
    useViewerStore.setState({ stats: null });
    render(<StudioInspector modelName={null} />);
    expect(screen.getByText(/Load a model/i)).toBeTruthy();
  });
});
