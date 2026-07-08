import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// r3f/drei are WebGL-only — mock them to plain passthrough so the viewer's own
// structure (container + the loaded model URL) is assertable in jsdom.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useGLTF: (url: string) => ({ scene: { url } }),
}));

import { GlbViewer } from '@/components/layout-lab/steps/shared/GlbViewer';

afterEach(cleanup);

describe('GlbViewer', () => {
  it('renders the viewer container and mounts a Canvas for a given glb url', () => {
    const { getByTestId } = render(<GlbViewer url="/api/visual-gen/asset/pof_bestiary_grunt.glb" />);
    const container = getByTestId('glb-viewer');
    expect(container).toBeDefined();
    // Canvas (mocked) mounts inside the boundary — proves the 3D scene is set up, not the error state.
    expect(getByTestId('canvas')).toBeDefined();
  });

  it('applies the requested height', () => {
    const { getByTestId } = render(<GlbViewer url="/x.glb" height={320} />);
    expect(getByTestId('glb-viewer').style.height).toBe('320px');
  });
});
