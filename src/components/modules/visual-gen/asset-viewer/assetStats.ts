import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface TextureStat {
  name: string;
  width: number;
  height: number;
  format: string;
  isPowerOfTwo: boolean;
}

export interface MaterialStat {
  name: string;
  type: string;
  textureCount: number;
}

export interface AnimationStat {
  name: string;
  duration: number;
  trackCount: number;
}

export interface AssetStats {
  triangles: number;
  vertices: number;
  meshes: number;
  /**
   * Mesh x material-slot pairs traversed in the loaded scene. A PROXY for draw calls,
   * not a measured draw count (instancing, merging and Nanite all change the real
   * number), and PoF authors no draw-call budget — so it is labelled as a proxy
   * wherever it is shown, and never graded. See `DRAW_CALLS_PROXY_NOTE` in assetGrade.ts.
   */
  drawCalls: number;
  materials: MaterialStat[];
  textures: TextureStat[];
  animations: AnimationStat[];
  /**
   * Bounding-box extents in the glTF file's own units (metres by spec) — NOT a
   * real-world size. Every generator PoF runs normalises its output to a ~1 m box:
   * measured 2026-08-19 over all 51 served `.glb` files, the longest extent is
   * 0.950-1.069 on every one. Grade it through `world-scale`, never print it under a
   * "metres" heading as though it described the asset.
   */
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

/**
 * NO BUDGET TABLE LIVES HERE.
 *
 * This file used to export `AssetBudget` / `DEFAULT_UE5_PROP_BUDGET` / `UE5_PRESETS`
 * (prop = 100,000 triangles, character = 200,000) — a second, rival authority that
 * contradicted the project's authored budgets in `src/lib/visual-gen/polycount-presets.ts`
 * (prop `faceLimit` 10,000 / `warnAbove` 15,000; character 40,000 / 60,000) by up to 10x.
 * Under it, `chair.glb` at 83,728 measured triangles — 5.6x the authored prop ceiling —
 * was stamped "Within budget".
 *
 * This module MEASURES. Grading lives in `assetGrade.ts`, which reads
 * `polycount-presets` + `face-budget` + `world-scale` and owns no numbers of its own.
 * If you are about to add a threshold constant to this file, put it in
 * `polycount-presets.ts` instead — one table, with its rationale, or none.
 */

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function trianglesFromGeometry(geom: THREE.BufferGeometry): number {
  const index = geom.getIndex();
  if (index) return index.count / 3;
  const position = geom.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function verticesFromGeometry(geom: THREE.BufferGeometry): number {
  const position = geom.getAttribute('position');
  return position ? position.count : 0;
}

function describeTextureFormat(texture: THREE.Texture): string {
  const fmtMap: Record<number, string> = {
    [THREE.RGBAFormat]: 'RGBA',
    [THREE.AlphaFormat]: 'Alpha',
    [THREE.RedFormat]: 'R',
    [THREE.RGFormat]: 'RG',
    [THREE.DepthFormat]: 'Depth',
  };
  return fmtMap[texture.format] ?? `Format#${texture.format}`;
}

function collectMaterialTextures(
  mat: THREE.Material,
  out: Map<THREE.Texture, TextureStat>,
): number {
  let count = 0;
  const m = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(m)) {
    const value = m[key];
    if (value && (value as THREE.Texture).isTexture) {
      const tex = value as THREE.Texture;
      const image = tex.image as { width?: number; height?: number } | undefined;
      const width = image?.width ?? 0;
      const height = image?.height ?? 0;
      if (!out.has(tex)) {
        out.set(tex, {
          name: tex.name || key,
          width,
          height,
          format: describeTextureFormat(tex),
          isPowerOfTwo: isPowerOfTwo(width) && isPowerOfTwo(height),
        });
      }
      count += 1;
    }
  }
  return count;
}

/**
 * Walk a GLTF scene and produce a structured stats report.
 */
export function computeAssetStats(gltf: GLTF): AssetStats {
  let triangles = 0;
  let vertices = 0;
  let meshes = 0;
  let drawCalls = 0;

  const materialMap = new Map<THREE.Material, MaterialStat>();
  const textureMap = new Map<THREE.Texture, TextureStat>();

  gltf.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    meshes += 1;

    const geom = obj.geometry as THREE.BufferGeometry | undefined;
    if (geom) {
      triangles += trianglesFromGeometry(geom);
      vertices += verticesFromGeometry(geom);
    }

    const matList = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of matList) {
      if (!m) continue;
      drawCalls += 1;
      if (!materialMap.has(m)) {
        const textureCount = collectMaterialTextures(m, textureMap);
        materialMap.set(m, {
          name: m.name || '(unnamed)',
          type: m.type,
          textureCount,
        });
      }
    }
  });

  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const size = bbox.isEmpty()
    ? new THREE.Vector3()
    : bbox.getSize(new THREE.Vector3());

  const animations: AnimationStat[] = (gltf.animations ?? []).map((clip) => ({
    name: clip.name || '(unnamed)',
    duration: clip.duration,
    trackCount: clip.tracks.length,
  }));

  return {
    triangles: Math.round(triangles),
    vertices: Math.round(vertices),
    meshes,
    drawCalls,
    materials: Array.from(materialMap.values()),
    textures: Array.from(textureMap.values()),
    animations,
    boundingBox: {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
  };
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}

export function formatMeters(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return `${n.toFixed(2)}`;
}
