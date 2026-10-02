'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { colourSpaceOf, type MaterialChannel } from '@/lib/visual-gen/material-boundary';
import type { PBRParams, PreviewMesh } from './useMaterialStore';
import { buildStandardMaterialProps } from './materialPreviewProps';

/**
 * Load a texture from a URL and dispose the previous one whenever the URL (or
 * channel) changes or the component unmounts. The channel's role decides the
 * colour space — `SRGBColorSpace` for colour maps (albedo), `NoColorSpace` for
 * data maps (normal / metallic / roughness / AO) — because feeding a data map
 * through sRGB decode skews its values and renders the material subtly wrong.
 */
function useDisposableTexture(
  url: string | null,
  channel: MaterialChannel,
): THREE.Texture | null {
  const colorSpace = colourSpaceOf(channel) === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const texture = useMemo(() => {
    if (!url) return null;
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = colorSpace;
    return tex;
  }, [url, colorSpace]);

  // Dispose the texture from the *previous* render once a new one supersedes it,
  // and dispose the final one on unmount — TextureLoader allocates a GPU texture
  // per load, so without this every re-upload leaks one.
  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  return texture;
}

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
  normalTexture,
  metallicTexture,
  roughnessTexture,
  aoTexture,
}: {
  params: PBRParams;
  previewMesh: PreviewMesh;
  albedoTexture: string | null;
  normalTexture: string | null;
  metallicTexture: string | null;
  roughnessTexture: string | null;
  aoTexture: string | null;
}) {
  // Each map's colour space comes from the lab's per-role table
  // (material-boundary.ts) — the same one Blender and UE read.
  const albedoMap = useDisposableTexture(albedoTexture, 'albedo');
  const normalMap = useDisposableTexture(normalTexture, 'normal');
  const metallicMap = useDisposableTexture(metallicTexture, 'metallic');
  const roughnessMap = useDisposableTexture(roughnessTexture, 'roughness');
  const aoMap = useDisposableTexture(aoTexture, 'ao');

  // The slot→material mapping is a pure function so it can be asserted directly
  // (see materialPreviewProps.ts) instead of only through a WebGL render.
  const materialProps = useMemo(
    () =>
      buildStandardMaterialProps(params, {
        albedo: albedoMap,
        normal: normalMap,
        metallic: metallicMap,
        roughness: roughnessMap,
        ao: aoMap,
      }),
    [params, albedoMap, normalMap, metallicMap, roughnessMap, aoMap],
  );

  return (
    <mesh castShadow receiveShadow>
      <PreviewGeometry mesh={previewMesh} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

interface MaterialPreviewProps {
  params: PBRParams;
  previewMesh: PreviewMesh;
  albedoTexture: string | null;
  normalTexture: string | null;
  metallicTexture: string | null;
  roughnessTexture: string | null;
  aoTexture: string | null;
}

export function MaterialPreview({
  params,
  previewMesh,
  albedoTexture,
  normalTexture,
  metallicTexture,
  roughnessTexture,
  aoTexture,
}: MaterialPreviewProps) {
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
            normalTexture={normalTexture}
            metallicTexture={metallicTexture}
            roughnessTexture={roughnessTexture}
            aoTexture={aoTexture}
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
