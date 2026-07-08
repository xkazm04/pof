'use client';

/**
 * GlbViewer — shared, self-contained interactive .glb preview for pipeline steps
 * (CLAUDE.md → Shared Component Manifest). Refactored from the studio-3d SceneViewer
 * but decoupled from its inspector store: give it a served .glb URL and it renders an
 * orbitable, auto-framed model. Used by ArchetypeStep's gallery view so 3D steps whose
 * selected candidate carries a `glbUrl` are visually verifiable in-place.
 *
 * Import via next/dynamic({ ssr: false }) — three/r3f is client + WebGL only.
 */
import { Suspense, Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds, useGLTF, Html } from '@react-three/drei';

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/** Error boundary so a failed/absent .glb degrades to a message instead of crashing the step. */
class GlbBoundary extends Component<{ children: ReactNode; onError: () => ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode; onError: () => ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.onError() : this.props.children; }
}

export interface GlbViewerProps {
  /** Served .glb URL (e.g. /api/visual-gen/asset/<file>.glb). */
  url: string;
  height?: number;
}

export function GlbViewer({ url, height = 260 }: GlbViewerProps) {
  return (
    <div
      data-testid="glb-viewer"
      style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: 'rgb(11,13,18)', position: 'relative' }}
    >
      <GlbBoundary onError={() => (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgb(138,143,152)', fontSize: 12 }}>
          Could not load mesh
        </div>
      )}>
        <Canvas camera={{ position: [0, 0.5, 3], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 2]} intensity={1.1} />
          <Suspense fallback={<Html center style={{ color: 'rgb(138,143,152)', fontSize: 12 }}>Loading mesh…</Html>}>
            <Bounds fit clip observe margin={1.2}>
              <Model url={url} />
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={8} />
        </Canvas>
      </GlbBoundary>
    </div>
  );
}

export default GlbViewer;
