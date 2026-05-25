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
  drawCalls: number;
  materials: MaterialStat[];
  textures: TextureStat[];
  animations: AnimationStat[];
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface AssetBudget {
  /** Maximum triangle count */
  maxTriangles: number;
  /** Maximum texture dimension (width or height in pixels) */
  maxTextureSize: number;
  /** Maximum unique material slots */
  maxMaterials: number;
  /** Maximum draw calls (unique mesh+material pairs) */
  maxDrawCalls: number;
}

export const DEFAULT_UE5_PROP_BUDGET: AssetBudget = {
  maxTriangles: 100_000,
  maxTextureSize: 2048,
  maxMaterials: 4,
  maxDrawCalls: 8,
};

export const UE5_PRESETS: Record<string, AssetBudget> = {
  prop: { maxTriangles: 100_000, maxTextureSize: 2048, maxMaterials: 4, maxDrawCalls: 8 },
  character: { maxTriangles: 200_000, maxTextureSize: 4096, maxMaterials: 8, maxDrawCalls: 16 },
  hero: { maxTriangles: 500_000, maxTextureSize: 4096, maxMaterials: 12, maxDrawCalls: 24 },
  environment: { maxTriangles: 50_000, maxTextureSize: 2048, maxMaterials: 6, maxDrawCalls: 12 },
};

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

export interface BudgetViolation {
  metric: 'triangles' | 'textureSize' | 'materials' | 'drawCalls';
  label: string;
  actual: number;
  limit: number;
  detail?: string;
}

export function findBudgetViolations(
  stats: AssetStats,
  budget: AssetBudget,
): BudgetViolation[] {
  const out: BudgetViolation[] = [];

  if (stats.triangles > budget.maxTriangles) {
    out.push({
      metric: 'triangles',
      label: 'Triangle count',
      actual: stats.triangles,
      limit: budget.maxTriangles,
    });
  }

  if (stats.materials.length > budget.maxMaterials) {
    out.push({
      metric: 'materials',
      label: 'Material slots',
      actual: stats.materials.length,
      limit: budget.maxMaterials,
    });
  }

  if (stats.drawCalls > budget.maxDrawCalls) {
    out.push({
      metric: 'drawCalls',
      label: 'Draw calls',
      actual: stats.drawCalls,
      limit: budget.maxDrawCalls,
    });
  }

  for (const tex of stats.textures) {
    const dim = Math.max(tex.width, tex.height);
    if (dim > budget.maxTextureSize) {
      out.push({
        metric: 'textureSize',
        label: `Texture "${tex.name}"`,
        actual: dim,
        limit: budget.maxTextureSize,
        detail: `${tex.width}×${tex.height}`,
      });
    }
  }

  return out;
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
