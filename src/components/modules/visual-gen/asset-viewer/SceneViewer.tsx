'use client';

import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment, Center } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { logger } from '@/lib/logger';
import type { RenderMode } from './useViewerStore';
import { useViewerStore } from './useViewerStore';
import { computeAssetStats } from './assetStats';
import { describeLoadError } from './loadStatus';
import { ViewportStatus } from './ViewportStatus';

// ── Model component that loads from URL ──────────────────────────────────────

/**
 * Switch one mesh's material for a render-mode change, disposing whichever solid/
 * wireframe material `applyRenderMode` itself created last time (never the original —
 * that one belongs to the loaded glTF and must survive every mode switch).
 *
 * `solid`/`wireframe` used to allocate a fresh `THREE.Material` on every call with no
 * disposal of the one it replaced — toggling render mode repeatedly in one session leaked
 * a compiled material (and its GPU program) per switch. `created` is the ref that lets this
 * function recognise "mine to dispose" without ever touching the original.
 */
export function applyRenderMode(
  child: THREE.Mesh,
  renderMode: RenderMode,
  original: THREE.Material | THREE.Material[] | undefined,
  created: Set<THREE.Material>,
): void {
  const disposeIfOwned = () => {
    const current = child.material;
    const mats = Array.isArray(current) ? current : current ? [current] : [];
    for (const m of mats) {
      if (created.has(m)) {
        m.dispose();
        created.delete(m);
      }
    }
  };
  switch (renderMode) {
    case 'textured': {
      disposeIfOwned();
      if (original) child.material = original;
      break;
    }
    case 'solid': {
      disposeIfOwned();
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.1 });
      created.add(mat);
      child.material = mat;
      break;
    }
    case 'wireframe': {
      disposeIfOwned();
      const mat = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x06b6d4 });
      created.add(mat);
      child.material = mat;
      break;
    }
  }
}

function LoadedModel({ url, renderMode }: { url: string; renderMode: RenderMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const originalMaterials = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const createdMaterials = useRef<Set<THREE.Material>>(new Set());
  const reportLoaded = useViewerStore((s) => s.reportLoaded);
  const reportLoadError = useViewerStore((s) => s.reportLoadError);
  const clearStats = useViewerStore((s) => s.clearStats);

  // Load model
  const loadedScene = useMemo(() => {
    const group = new THREE.Group();
    const loader = new GLTFLoader();

    // Load asynchronously and add to group when ready
    loader.load(
      url,
      (gltf) => {
        // Store original materials
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            originalMaterials.current.set(child, child.material);
          }
        });
        group.add(gltf.scene);

        // Report geometry/material/texture stats to the inspector. Keyed on `url` so a
        // superseded load that lands late is dropped rather than shown under a new name.
        reportLoaded(url, computeAssetStats(gltf));

        // Auto-fit camera to model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 2 / maxDim;
          gltf.scene.scale.setScalar(scale);
          // Center the model
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center.multiplyScalar(scale));
        }
      },
      undefined,
      (error) => {
        // A 404, a bad ?dir=, or a corrupt mesh used to end here as a console line and
        // nothing else — an empty studio the user could not tell from "still loading".
        const reason = describeLoadError(error);
        logger.error('asset viewer: failed to load model', url, reason);
        reportLoadError(url, reason);
      },
    );

    return group;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Apply render mode changes
  useEffect(() => {
    if (!loadedScene) return;

    loadedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      applyRenderMode(child, renderMode, originalMaterials.current.get(child), createdMaterials.current);
    });
  }, [loadedScene, renderMode]);

  // Cleanup on unmount — dispose any solid/wireframe material this component created
  // (never the originals, which belong to the loaded glTF), then clear the inspector
  // stats so a removed model isn't checked.
  useEffect(() => {
    return () => {
      for (const m of createdMaterials.current) m.dispose();
      createdMaterials.current.clear();
      originalMaterials.current.clear();
      clearStats();
    };
  }, [clearStats]);

  return <primitive ref={groupRef} object={loadedScene} />;
}

// ── Empty state placeholder ──────────────────────────────────────────────────

function EmptyScene() {
  return (
    <Center>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={0x06b6d4} opacity={0.3} transparent />
      </mesh>
    </Center>
  );
}

// ── Main SceneViewer ─────────────────────────────────────────────────────────

interface SceneViewerProps {
  modelUrl: string | null;
  renderMode: RenderMode;
  showGrid: boolean;
  showAxes: boolean;
  autoRotate: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Override the floor-grid line color (e.g. a blueprint tint). Default: studio grey. */
  gridColor?: string;
  /** Override the canvas backdrop (e.g. blueprint paper). Default: var(--surface-deep). */
  backgroundColor?: string;
}

export function SceneViewer({
  modelUrl,
  renderMode,
  showGrid,
  showAxes,
  autoRotate,
  canvasRef,
  gridColor,
  backgroundColor,
}: SceneViewerProps) {
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const modelName = useViewerStore((s) => s.modelName);

  return (
    <div
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ background: backgroundColor ?? 'var(--surface-deep)', position: 'relative' }}
    >
      <Canvas
        ref={canvasRef}
        camera={{ position: [3, 2, 3], fov: 50, near: 0.01, far: 1000 }}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-3, 4, -2]} intensity={0.5} />
          <directionalLight position={[0, 2, -5]} intensity={0.3} />

          {/* Environment for reflections */}
          <Environment preset="studio" />

          {/* Model or placeholder */}
          {modelUrl ? (
            <LoadedModel url={modelUrl} renderMode={renderMode} />
          ) : (
            <EmptyScene />
          )}

          {/* Grid */}
          {showGrid && (
            <Grid
              args={[10, 10]}
              cellSize={0.5}
              cellThickness={0.5}
              cellColor={gridColor ?? '#374151'}
              sectionSize={2}
              sectionThickness={1}
              sectionColor={gridColor ?? '#4b5563'}
              fadeDistance={15}
              fadeStrength={1}
              infiniteGrid
            />
          )}

          {/* Axes gizmo */}
          {showAxes && (
            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport
                axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                labelColor="white"
              />
            </GizmoHelper>
          )}

          {/* Controls */}
          <OrbitControls
            makeDefault
            autoRotate={autoRotate}
            autoRotateSpeed={2}
            enableDamping
            dampingFactor={0.1}
            minDistance={0.5}
            maxDistance={100}
          />
        </Suspense>
      </Canvas>
      {/* Outside the Canvas on purpose — plain DOM survives a dead GL context and is
          what makes the three states assertable without WebGL. */}
      <ViewportStatus
        loadState={loadState}
        loadError={loadError}
        modelName={modelName}
        modelUrl={modelUrl}
      />
    </div>
  );
}
