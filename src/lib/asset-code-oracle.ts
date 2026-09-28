/**
 * Asset-Code Consistency Oracle
 *
 * Cross-references scan-project results (C++ classes) with scan-assets results
 * (Content/ .uasset files) to detect:
 *   - Orphaned assets: BP_ exists but no corresponding C++ class
 *   - Missing assets: C++ Actor declared but no BP_ in Content/
 *   - Stale references: asset references a class name that doesn't exist
 *   - Dependency analysis: mesh→material→texture graph queries
 *
 * Identity: an asset IS its Content-relative `relativePath` — the key scan-assets
 * emits its dependency edges in (basenames collide across folders). The basename
 * is only a display label. Every violation id is stable across re-scans:
 * `<type>:<subject>` (subject = relativePath or C++ class name); a stale reference
 * also names its target (`stale-reference:<from>-><to>`), because one asset can
 * hold several stale references. `@/lib/asset-oracle/oracleDiff` diffs these ids.
 */

import type {
  ScannedClass,
} from '@/app/api/filesystem/scan-project/route';
import type {
  ScannedAsset,
  AssetDependencyEdge,
  AssetType,
} from '@/app/api/filesystem/scan-assets/route';

// ── Result types ────────────────────────────────────────────────────────────

/**
 * @deprecated For UI consumption, prefer the canonical `Severity` from
 * `@/types/severity`. Map at the boundary: `legacyToCanonical(severity)`
 * converts `error → high` and `warning → medium`. Engine-internal logic in
 * this file continues to use these values.
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

export type ViolationType =
  | 'orphaned-asset'     // BP_ exists but no C++ counterpart
  | 'missing-asset'      // C++ class declared but no BP_ in Content
  | 'stale-reference'    // Asset references a name that doesn't match any class
  | 'naming-mismatch'    // Asset prefix doesn't match its type
  | 'unreferenced-asset' // Asset has no incoming dependency edges
  ;

export interface ConsistencyViolation {
  /** Stable across re-scans: `<type>:<subject>` (stale refs: `<type>:<from>-><to>`). */
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  title: string;
  description: string;
  /** The asset (relativePath) or C++ class name that triggered the violation */
  subject: string;
  /** Display name of the subject (asset basename or class name) */
  label?: string;
  /** Expected counterpart that's missing or mismatched */
  expected?: string;
  /** Suggestion for fixing */
  suggestion: string;
}

export interface DependencyNode {
  /** Asset relativePath, or the C++ class name for a class node */
  id: string;
  /** Display name (asset basename or class name) — NOT unique */
  label: string;
  type: AssetType | 'class';
  /** Number of incoming references */
  inDegree: number;
  /** Number of outgoing references */
  outDegree: number;
}

export interface OracleResult {
  violations: ConsistencyViolation[];
  stats: {
    totalClasses: number;
    totalAssets: number;
    totalDependencyEdges: number;
    orphanedAssets: number;
    missingAssets: number;
    staleReferences: number;
    namingMismatches: number;
    unreferencedAssets: number;
    consistencyScore: number; // 0-100
  };
  dependencyGraph: {
    nodes: DependencyNode[];
    edges: AssetDependencyEdge[];
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip UE prefix (A, U, F, E) from class name for matching */
function stripClassPrefix(name: string): string {
  if (/^[AUFE][A-Z]/.test(name)) return name.slice(1);
  return name;
}

/** Strip UE asset prefix (BP_, SM_, etc.) for matching */
function stripAssetPrefix(name: string): string {
  return name.replace(/^(BP_|WBP_|SM_|SK_|T_|M_|MI_|MF_|ABP_|AM_|BS_|A_|S_|SC_|SW_)/, '');
}

/** Strip whatever `XX_` prefix an asset uses (the rename target keeps the stem). */
function stripAnyPrefix(name: string): string {
  return name.replace(/^[A-Z]{1,3}_/, '');
}

/** Basename of a Content-relative asset path, without extension. */
function pathLabel(relativePath: string): string {
  return (relativePath.split('/').pop() ?? relativePath).replace(/\.u(asset|map)$/i, '');
}

/** Normalize name for fuzzy matching (lowercase, strip underscores) */
function normalize(s: string): string {
  return s.toLowerCase().replace(/_/g, '');
}

// ── Main analysis ──────────────────────────────────────────────────────────

export function analyzeConsistency(
  classes: ScannedClass[],
  assets: ScannedAsset[],
  dependencies: AssetDependencyEdge[],
): OracleResult {
  const violations: ConsistencyViolation[] = [];
  const seen = new Set<string>();
  /** Push once per stable id — a duplicate input row never yields a duplicate row. */
  const push = (v: ConsistencyViolation) => {
    if (seen.has(v.id)) return;
    seen.add(v.id);
    violations.push(v);
  };

  // Every join is on relativePath — the identity scan-assets keys its edges by.
  const assetPathSet = new Set(assets.map((a) => a.relativePath));

  // Blueprints and Actors for cross-referencing
  const blueprints = assets.filter((a) => a.type === 'blueprint');
  const actors = classes.filter((c) => c.prefix === 'A');

  // ── 1. Orphaned assets: BP_ exists but no corresponding C++ class ──

  for (const bp of blueprints) {
    const baseName = normalize(stripAssetPrefix(bp.name));
    if (!baseName) continue;

    // Check if any Actor class matches this blueprint base name
    const hasMatch = actors.some((a) => {
      const classBase = normalize(stripClassPrefix(a.name));
      return classBase === baseName
        || classBase.includes(baseName)
        || baseName.includes(classBase);
    });

    if (!hasMatch && baseName.length > 2) {
      push({
        id: `orphaned-asset:${bp.relativePath}`,
        type: 'orphaned-asset',
        severity: 'warning',
        title: `Orphaned Blueprint: ${bp.name}`,
        description: `Blueprint "${bp.name}" (${bp.relativePath}) exists in Content/ but no corresponding C++ Actor class was found.`,
        subject: bp.relativePath,
        label: bp.name,
        expected: `A${stripAssetPrefix(bp.name)} or similar Actor class`,
        suggestion: `Create a C++ parent class for this Blueprint, or verify it inherits from a framework class.`,
      });
    }
  }

  // ── 2. Missing assets: C++ Actor exists but no BP_ in Content ──

  for (const actor of actors) {
    const classBase = normalize(stripClassPrefix(actor.name));
    if (!classBase || classBase.length < 3) continue;

    // Skip abstract/base classes (heuristic: contains "base" or "component")
    const lowerName = actor.name.toLowerCase();
    if (lowerName.includes('base') || lowerName.includes('component') || lowerName.includes('interface')) continue;

    const hasBlueprint = blueprints.some((bp) => {
      const bpBase = normalize(stripAssetPrefix(bp.name));
      return bpBase === classBase
        || bpBase.includes(classBase)
        || classBase.includes(bpBase);
    });

    if (!hasBlueprint) {
      push({
        id: `missing-asset:${actor.name}`,
        type: 'missing-asset',
        severity: 'info',
        title: `Missing Blueprint: ${actor.name}`,
        description: `C++ Actor "${actor.name}" is declared (${actor.headerPath}) but no corresponding BP_ Blueprint was found in Content/.`,
        subject: actor.name,
        label: actor.name,
        expected: `BP_${stripClassPrefix(actor.name)}`,
        suggestion: `Create a Blueprint derived from ${actor.name} if this class needs data-driven configuration.`,
      });
    }
  }

  // ── 3. Stale references: dependency edges point to non-existent asset paths ──

  for (const edge of dependencies) {
    if (!assetPathSet.has(edge.to)) {
      push({
        id: `stale-reference:${edge.from}->${edge.to}`,
        type: 'stale-reference',
        severity: 'error',
        title: `Stale Reference: ${pathLabel(edge.from)} → ${pathLabel(edge.to)}`,
        description: `"${edge.from}" references "${edge.to}" (${edge.relation}) but the target asset was not found in Content/.`,
        subject: edge.from,
        label: pathLabel(edge.from),
        expected: edge.to,
        suggestion: `Check if "${edge.to}" was renamed or deleted. Update the reference in "${edge.from}".`,
      });
    }
  }

  // ── 4. Naming convention mismatches ──

  const EXPECTED_PREFIXES: Partial<Record<AssetType, string[]>> = {
    mesh: ['SM_', 'SK_'],
    texture: ['T_'],
    material: ['M_', 'MI_', 'MF_'],
    animation: ['ABP_', 'AM_', 'BS_', 'A_'],
    blueprint: ['BP_', 'WBP_'],
    sound: ['S_', 'SC_', 'SW_'],
  };

  for (const asset of assets) {
    const expected = EXPECTED_PREFIXES[asset.type];
    if (!expected) continue;
    if (asset.type === 'other' || asset.type === 'map') continue;

    const hasCorrectPrefix = expected.some((p) => asset.name.startsWith(p));
    if (!hasCorrectPrefix && asset.name.includes('_')) {
      // Only flag if the asset uses SOME prefix (just the wrong one)
      const usesAnyPrefix = /^[A-Z]{1,3}_/.test(asset.name);
      if (usesAnyPrefix) {
        push({
          id: `naming-mismatch:${asset.relativePath}`,
          type: 'naming-mismatch',
          severity: 'info',
          title: `Naming Mismatch: ${asset.name}`,
          description: `"${asset.name}" (${asset.relativePath}) is classified as "${asset.type}" but doesn't use expected prefixes (${expected.join(', ')}).`,
          subject: asset.relativePath,
          label: asset.name,
          expected: `${expected[0]}${stripAnyPrefix(asset.name)}`,
          suggestion: `Rename to use the correct UE5 naming convention prefix.`,
        });
      }
    }
  }

  // ── 5. Unreferenced assets (no incoming dependency edges) ──

  const referencedAssets = new Set<string>();
  for (const edge of dependencies) {
    referencedAssets.add(edge.to);
  }
  // Also count assets that reference others as "used"
  const referencingAssets = new Set<string>();
  for (const edge of dependencies) {
    referencingAssets.add(edge.from);
  }

  for (const asset of assets) {
    if (asset.type === 'map' || asset.type === 'blueprint' || asset.type === 'other') continue;
    if (!referencedAssets.has(asset.relativePath) && !referencingAssets.has(asset.relativePath)) {
      push({
        id: `unreferenced-asset:${asset.relativePath}`,
        type: 'unreferenced-asset',
        severity: 'info',
        title: `Unreferenced: ${asset.name}`,
        description: `"${asset.name}" (${asset.type}, ${asset.relativePath}) has no dependency connections — it may be unused.`,
        subject: asset.relativePath,
        label: asset.name,
        suggestion: `Verify this asset is referenced in the project. If unused, consider removing it to reduce package size.`,
      });
    }
  }

  // ── Build dependency graph nodes (keyed by relativePath; basename is the label) ──

  const nodeMap = new Map<string, DependencyNode>();
  for (const asset of assets) {
    nodeMap.set(asset.relativePath, { id: asset.relativePath, label: asset.name, type: asset.type, inDegree: 0, outDegree: 0 });
  }
  for (const cls of classes) {
    if (!nodeMap.has(cls.name)) {
      nodeMap.set(cls.name, { id: cls.name, label: cls.name, type: 'class', inDegree: 0, outDegree: 0 });
    }
  }
  for (const edge of dependencies) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (from) from.outDegree++;
    if (to) to.inDegree++;
  }

  // ── Compute consistency score ──

  const orphanCount = violations.filter((v) => v.type === 'orphaned-asset').length;
  const missingCount = violations.filter((v) => v.type === 'missing-asset').length;
  const staleCount = violations.filter((v) => v.type === 'stale-reference').length;
  const namingCount = violations.filter((v) => v.type === 'naming-mismatch').length;
  const unrefCount = violations.filter((v) => v.type === 'unreferenced-asset').length;

  const totalItems = classes.length + assets.length;
  const errorWeight = staleCount * 3 + orphanCount * 2 + missingCount * 1 + namingCount * 0.5 + unrefCount * 0.3;
  const score = totalItems > 0
    ? Math.max(0, Math.round(100 - (errorWeight / totalItems) * 100))
    : 100;

  return {
    violations,
    stats: {
      totalClasses: classes.length,
      totalAssets: assets.length,
      totalDependencyEdges: dependencies.length,
      orphanedAssets: orphanCount,
      missingAssets: missingCount,
      staleReferences: staleCount,
      namingMismatches: namingCount,
      unreferencedAssets: unrefCount,
      consistencyScore: score,
    },
    dependencyGraph: {
      nodes: Array.from(nodeMap.values()),
      edges: dependencies,
    },
  };
}
