'use client';

import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment, Center } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RenderMode } from './useViewerStore';

// ── Model component that loads from URL ──────────────────────────────────────

function LoadedModel({ url, renderMode }: { url: string; renderMode: RenderMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const originalMaterials = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const { scene: threeScene } = useThree();

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
        // eslint-disable-next-line no-console
        console.error('Failed to load model:', error);
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

      switch (renderMode) {
        case 'textured': {
          const orig = originalMaterials.current.get(child);
          if (orig) child.material = orig;
          break;
        }
        case 'solid': {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.6,
            metalness: 0.1,
          });
          break;
        }
        case 'wireframe': {
          child.material = new THREE.MeshBasicMaterial({
            wireframe: true,
            color: 0x06b6d4,
          });
          break;
        }
      }
    });
  }, [loadedScene, renderMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      originalMaterials.current.clear();
    };
  }, []);

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
}

export function SceneViewer({
  modelUrl,
  renderMode,
  showGrid,
  showAxes,
  autoRotate,
  canvasRef,
}: SceneViewerProps) {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-[var(--surface-deep)]">
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
              cellColor="#374151"
              sectionSize={2}
              sectionThickness={1}
              sectionColor="#4b5563"
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
    </div>
  );
}
