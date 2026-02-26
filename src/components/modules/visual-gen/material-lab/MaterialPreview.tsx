'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { PBRParams, PreviewMesh } from './useMaterialStore';

function PreviewGeometry({ mesh }: { mesh: PreviewMesh }) {
  switch (mesh) {
    case 'cube':
      return <boxGeometry args={[1.2, 1.2, 1.2]} />;
    case 'plane':
      return <planeGeometry args={[2, 2, 32, 32]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.6, 0.6, 1.4, 32]} />;
    case 'sphere':
    default:
      return <sphereGeometry args={[0.8, 64, 64]} />;
  }
}

function MaterialMesh({
  params,
  previewMesh,
  albedoTexture,
}: {
  params: PBRParams;
  previewMesh: PreviewMesh;
  albedoTexture: string | null;
}) {
  const color = useMemo(() => new THREE.Color(params.baseColor), [params.baseColor]);

  const albedoMap = useMemo(() => {
    if (!albedoTexture) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(albedoTexture);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [albedoTexture]);

  return (
    <mesh castShadow receiveShadow>
      <PreviewGeometry mesh={previewMesh} />
      <meshStandardMaterial
        color={albedoMap ? undefined : color}
        map={albedoMap}
        metalness={params.metallic}
        roughness={params.roughness}
        aoMapIntensity={params.aoStrength}
      />
    </mesh>
  );
}

interface MaterialPreviewProps {
  params: PBRParams;
  previewMesh: PreviewMesh;
  albedoTexture: string | null;
}

export function MaterialPreview({ params, previewMesh, albedoTexture }: MaterialPreviewProps) {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-[var(--surface-deep)]">
      <Canvas
        camera={{ position: [2, 1.5, 2], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-3, 3, -2]} intensity={0.4} />

          <Environment preset="studio" />

          <MaterialMesh
            params={params}
            previewMesh={previewMesh}
            albedoTexture={albedoTexture}
          />

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.1}
            minDistance={1}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
