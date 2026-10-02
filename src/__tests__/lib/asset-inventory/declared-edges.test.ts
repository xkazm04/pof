/**
 * Asset Inventory: UE's declared references over name guesses.
 *
 * scan-assets' `inferDependencies` builds edges only from shared base names
 * after prefix stripping. On the plugin design doc's own example project that
 * recovers 0 of the 10 references the manifest declares (M_Character_Base's
 * base 'character_base' never matches T_Char_BaseColor's 'char_basecolor').
 * `declared-edges` reads the manifest's textureReferences / crossReferences
 * instead, and every edge says where it came from.
 *
 * RED before this change: `@/lib/asset-inventory/declared-edges` did not exist.
 */
import { describe, it, expect } from 'vitest';
import {
  gamePathToContentKey,
  contentKeyOf,
  declaredEdges,
  mergeInventoryEdges,
  reconcileInventory,
} from '@/lib/asset-inventory/declared-edges';
import type { AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';
import type { AssetManifest } from '@/types/pof-bridge';
import { DOC_ASSETS, DOC_MANIFEST, scanned } from './design-doc-fixture';

describe('content keys: one join between /Game package paths and Content-relative files', () => {
  it('maps /Game paths (with or without the object suffix) and refuses other mounts', () => {
    expect(gamePathToContentKey('/Game/Materials/M_Character_Base')).toBe('Materials/M_Character_Base');
    expect(gamePathToContentKey('/Game/Materials/M_Character_Base.M_Character_Base')).toBe('Materials/M_Character_Base');
    expect(gamePathToContentKey('/Engine/BasicShapes/Cube')).toBeNull();
    expect(contentKeyOf({ relativePath: 'Materials/M_Character_Base.uasset' })).toBe('Materials/M_Character_Base');
    expect(contentKeyOf({ relativePath: 'Maps/L_MainHub.umap' })).toBe('Maps/L_MainHub');
  });
});

describe('declaredEdges', () => {
  it('reads the design-doc manifest as 10 UE-declared edges keyed by relativePath', () => {
    const { edges, unresolvedRefs } = declaredEdges(DOC_MANIFEST, DOC_ASSETS);
    expect(edges).toHaveLength(10);
    expect(edges.every((e) => e.provenance === 'declared')).toBe(true);

    const textures = edges.filter((e) => e.relation === 'uses-texture');
    expect(textures).toHaveLength(3);
    expect(textures.every((e) => e.from === 'Materials/M_Character_Base.uasset')).toBe(true);
    expect(textures.map((e) => e.to).sort()).toEqual([
      'Textures/T_Char_BaseColor.uasset',
      'Textures/T_Char_Normal.uasset',
      'Textures/T_Char_ORM.uasset',
    ]);

    const refs = edges.filter((e) => e.relation === 'references');
    expect(refs).toHaveLength(7);
    expect(refs).toContainEqual({
      from: 'Materials/M_Character_Base.uasset',
      to: 'Meshes/SK_PlayerCharacter.uasset',
      relation: 'references',
      provenance: 'declared',
    });

    // Every endpoint is a scanned file: edges share the scan's relativePath key.
    const paths = new Set(DOC_ASSETS.map((a) => a.relativePath));
    expect(edges.every((e) => paths.has(e.from) && paths.has(e.to))).toBe(true);

    // DT_WeaponStats -> /Game/Blueprints/Items/BP_Weapon_Base has no file: counted, not drawn.
    expect(unresolvedRefs).toBe(1);
  });
});

describe('mergeInventoryEdges', () => {
  const crate = [
    scanned('Materials/M_Crate.uasset', 'material'),
    scanned('Textures/T_Crate_D.uasset', 'texture'),
    scanned('Meshes/SM_Barrel.uasset', 'mesh'),
    scanned('Materials/M_Barrel.uasset', 'material'),
  ];
  const inferred: AssetDependencyEdge[] = [
    { from: 'Materials/M_Crate.uasset', to: 'Textures/T_Crate_D.uasset', relation: 'uses-texture' },
    { from: 'Meshes/SM_Barrel.uasset', to: 'Materials/M_Barrel.uasset', relation: 'uses-material' },
  ];
  const manifest: AssetManifest = {
    ...DOC_MANIFEST,
    blueprints: [], animAssets: [], dataTables: [], otherAssets: [],
    materials: [{
      ...DOC_MANIFEST.materials[0],
      path: '/Game/Materials/M_Crate',
      materialInstances: [],
      textureReferences: [],
      crossReferences: [],
    }],
  };

  it('a covered asset keeps ONLY its declared out-edges; an uncovered one keeps its guesses, tagged', () => {
    const declared = declaredEdges(manifest, crate).edges;
    expect(declared).toEqual([]);
    const merged = mergeInventoryEdges(inferred, declared, manifest);
    // UE lists M_Crate with textureReferences [] -> the name guess M_Crate -> T_Crate_D is dropped.
    expect(merged.find((e) => e.from === 'Materials/M_Crate.uasset')).toBeUndefined();
    expect(merged).toEqual([
      { from: 'Meshes/SM_Barrel.uasset', to: 'Materials/M_Barrel.uasset', relation: 'uses-material', provenance: 'inferred' },
    ]);
  });

  it('declared edges come through unchanged next to the surviving guesses', () => {
    const withTex: AssetManifest = {
      ...manifest,
      materials: [{ ...manifest.materials[0], textureReferences: ['/Game/Textures/T_Crate_D.T_Crate_D'] }],
    };
    const declared = declaredEdges(withTex, crate).edges;
    const merged = mergeInventoryEdges(inferred, declared, withTex);
    expect(merged).toHaveLength(2);
    expect(merged.filter((e) => e.provenance === 'declared')).toEqual([
      { from: 'Materials/M_Crate.uasset', to: 'Textures/T_Crate_D.uasset', relation: 'uses-texture', provenance: 'declared' },
    ]);
    expect(merged.filter((e) => e.provenance === 'inferred')).toHaveLength(1);
  });

  it('with no manifest every edge is the route\'s guess, 1:1, tagged inferred', () => {
    expect(mergeInventoryEdges(inferred, [], null)).toEqual(
      inferred.map((e) => ({ ...e, provenance: 'inferred' })),
    );
  });
});

describe('reconcileInventory', () => {
  it('splits scanned files UE does not list from manifest entries with no file on disk', () => {
    const r = reconcileInventory(DOC_ASSETS, DOC_MANIFEST);
    if (!r.available) throw new Error('expected a reconcile');
    const listed = new Set([
      'Blueprints/Characters/BP_PlayerCharacter.uasset',
      'Materials/M_Character_Base.uasset',
      'Animations/AM_PrimaryAttack.uasset',
      'Animations/ABP_PlayerCharacter.uasset',
      'Data/DT_WeaponStats.uasset',
    ]);
    expect(r.notInManifest.map((a) => a.relativePath).sort()).toEqual(
      DOC_ASSETS.map((a) => a.relativePath).filter((p) => !listed.has(p)).sort(),
    );
    expect(r.notInManifest).toHaveLength(9);
    expect(r.missingOnDisk).toEqual(['/Game/Maps/L_MainHub']);
  });

  it('is unavailable without a manifest', () => {
    expect(reconcileInventory(DOC_ASSETS, null)).toEqual({ available: false });
  });
});
