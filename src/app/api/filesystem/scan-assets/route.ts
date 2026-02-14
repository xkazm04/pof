import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ── Types ──

export type AssetType = 'mesh' | 'texture' | 'material' | 'animation' | 'blueprint' | 'sound' | 'map' | 'other';

export interface ScannedAsset {
  /** File name without extension */
  name: string;
  /** Relative path from Content/ */
  relativePath: string;
  /** Full file path on disk */
  fullPath: string;
  /** File extension (e.g. ".uasset", ".umap") */
  extension: string;
  /** Inferred asset type from naming conventions */
  type: AssetType;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified date ISO string */
  modifiedAt: string;
}

export interface AssetDependencyEdge {
  /** Source asset name (e.g. a mesh) */
  from: string;
  /** Target asset name (e.g. a material or texture) */
  to: string;
  /** Relationship type */
  relation: 'uses-material' | 'uses-texture' | 'references';
}

export interface AssetScanResult {
  scannedAt: string;
  contentPath: string;
  assets: ScannedAsset[];
  dependencies: AssetDependencyEdge[];
  totalSizeBytes: number;
  scanDurationMs: number;
}

// ── Helpers ──

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Infer the asset type from a file path using UE5 naming conventions.
 *
 * UE5 common prefixes:
 *   SM_ = Static Mesh, SK_ = Skeletal Mesh, T_ = Texture, M_ / MI_ = Material / Material Instance,
 *   ABP_ = Animation Blueprint, AM_ = Animation Montage, BS_ = Blend Space,
 *   BP_ = Blueprint, WBP_ = Widget Blueprint,
 *   S_ / SC_ = Sound Cue, SW_ = Sound Wave
 *
 * Also checks parent folder names: Meshes, Textures, Materials, Animations, etc.
 */
function inferAssetType(relativePath: string, fileName: string): AssetType {
  const nameUpper = fileName.toUpperCase();
  const pathUpper = relativePath.toUpperCase();

  // Extension-based first
  if (relativePath.endsWith('.umap')) return 'map';

  // Prefix-based naming conventions
  if (nameUpper.startsWith('SM_') || nameUpper.startsWith('SK_')) return 'mesh';
  if (nameUpper.startsWith('T_')) return 'texture';
  if (nameUpper.startsWith('M_') || nameUpper.startsWith('MI_') || nameUpper.startsWith('MF_')) return 'material';
  if (nameUpper.startsWith('ABP_') || nameUpper.startsWith('AM_') || nameUpper.startsWith('BS_') || nameUpper.startsWith('A_')) return 'animation';
  if (nameUpper.startsWith('BP_') || nameUpper.startsWith('WBP_')) return 'blueprint';
  if (nameUpper.startsWith('S_') || nameUpper.startsWith('SC_') || nameUpper.startsWith('SW_')) return 'sound';

  // Folder-based heuristics
  if (pathUpper.includes('/MESHES/') || pathUpper.includes('\\MESHES\\') ||
      pathUpper.includes('/STATICMESHES/') || pathUpper.includes('\\STATICMESHES\\') ||
      pathUpper.includes('/SKELETALMESHES/') || pathUpper.includes('\\SKELETALMESHES\\')) return 'mesh';
  if (pathUpper.includes('/TEXTURES/') || pathUpper.includes('\\TEXTURES\\')) return 'texture';
  if (pathUpper.includes('/MATERIALS/') || pathUpper.includes('\\MATERIALS\\')) return 'material';
  if (pathUpper.includes('/ANIMATIONS/') || pathUpper.includes('\\ANIMATIONS\\') ||
      pathUpper.includes('/ANIMS/') || pathUpper.includes('\\ANIMS\\')) return 'animation';
  if (pathUpper.includes('/BLUEPRINTS/') || pathUpper.includes('\\BLUEPRINTS\\')) return 'blueprint';
  if (pathUpper.includes('/SOUNDS/') || pathUpper.includes('\\SOUNDS\\') ||
      pathUpper.includes('/AUDIO/') || pathUpper.includes('\\AUDIO\\')) return 'sound';

  return 'other';
}

/**
 * Infer dependency edges from naming conventions.
 *
 * Strategy:
 * - If a mesh (SM_Foo) and material (M_Foo or MI_Foo) share a base name → mesh uses-material
 * - If a material (M_Foo) and texture (T_Foo_*) share a base name → material uses-texture
 * - Assets in the same subfolder with matching base names → references
 */
function inferDependencies(assets: ScannedAsset[]): AssetDependencyEdge[] {
  const edges: AssetDependencyEdge[] = [];
  const meshes = assets.filter(a => a.type === 'mesh');
  const materials = assets.filter(a => a.type === 'material');
  const textures = assets.filter(a => a.type === 'texture');

  // Extract base name by stripping common prefixes
  function baseName(name: string): string {
    return name
      .replace(/^(SM_|SK_|T_|M_|MI_|MF_|ABP_|AM_|BS_|A_|BP_|WBP_|S_|SC_|SW_)/i, '')
      .toLowerCase();
  }

  // Build lookup maps
  const materialByBase = new Map<string, ScannedAsset[]>();
  for (const m of materials) {
    const bn = baseName(m.name);
    if (!materialByBase.has(bn)) materialByBase.set(bn, []);
    materialByBase.get(bn)!.push(m);
  }

  const textureByBase = new Map<string, ScannedAsset[]>();
  for (const t of textures) {
    // Textures often have suffixes like T_Foo_D, T_Foo_N, T_Foo_ORM
    // Extract up to the last underscore-suffix as the base
    const bn = baseName(t.name).replace(/_(d|n|orm|r|m|ao|e|s|h|bc|a)$/i, '');
    if (!textureByBase.has(bn)) textureByBase.set(bn, []);
    textureByBase.get(bn)!.push(t);
  }

  // Mesh → Material
  for (const mesh of meshes) {
    const bn = baseName(mesh.name);
    const mats = materialByBase.get(bn);
    if (mats) {
      for (const mat of mats) {
        edges.push({ from: mesh.name, to: mat.name, relation: 'uses-material' });
      }
    }
  }

  // Material → Texture
  for (const mat of materials) {
    const bn = baseName(mat.name);
    const texs = textureByBase.get(bn);
    if (texs) {
      for (const tex of texs) {
        edges.push({ from: mat.name, to: tex.name, relation: 'uses-texture' });
      }
    }
  }

  return edges;
}

/**
 * Recursively collect all .uasset and .umap files under Content/.
 * Caps at 2000 files to avoid scanning massive projects.
 */
async function collectAssets(
  contentDir: string,
  maxFiles = 2000
): Promise<ScannedAsset[]> {
  const results: ScannedAsset[] = [];

  async function walk(current: string) {
    if (results.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          // Skip engine/plugin intermediate directories
          if (entry.name === 'Intermediate' || entry.name === 'DerivedDataCache' || entry.name.startsWith('.')) {
            continue;
          }
          await walk(full);
        } else if (entry.isFile() && (entry.name.endsWith('.uasset') || entry.name.endsWith('.umap'))) {
          try {
            const stat = await fs.stat(full);
            const fileName = path.basename(entry.name, path.extname(entry.name));
            const relativePath = path.relative(contentDir, full).replace(/\\/g, '/');
            results.push({
              name: fileName,
              relativePath,
              fullPath: full,
              extension: path.extname(entry.name),
              type: inferAssetType(relativePath, fileName),
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(contentDir);
  return results;
}

// ── Main scan function ──

async function scanAssets(projectPath: string): Promise<AssetScanResult> {
  const startTime = Date.now();
  const contentDir = path.join(projectPath, 'Content');

  if (!(await directoryExists(contentDir))) {
    return {
      scannedAt: new Date().toISOString(),
      contentPath: contentDir,
      assets: [],
      dependencies: [],
      totalSizeBytes: 0,
      scanDurationMs: Date.now() - startTime,
    };
  }

  const assets = await collectAssets(contentDir);
  const dependencies = inferDependencies(assets);
  const totalSizeBytes = assets.reduce((sum, a) => sum + a.sizeBytes, 0);

  return {
    scannedAt: new Date().toISOString(),
    contentPath: contentDir,
    assets,
    dependencies,
    totalSizeBytes,
    scanDurationMs: Date.now() - startTime,
  };
}

// ── Route handler ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    if (!(await directoryExists(projectPath))) {
      return apiError('Project path does not exist', 404);
    }

    const result = await scanAssets(projectPath);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Internal server error');
  }
}
