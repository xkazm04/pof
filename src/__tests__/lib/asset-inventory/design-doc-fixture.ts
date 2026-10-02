/**
 * The example manifest of docs/ue5-companion-plugin-design.md:282-455, inlined
 * (the reference paths are verbatim; fields the inventory never reads are
 * trimmed to satisfy the type), plus the 14 Content/ files a project holding
 * it would scan - exactly as `/api/filesystem/scan-assets` emits them.
 *
 * Not on disk: /Game/Maps/L_MainHub (a manifest entry) and
 * /Game/Blueprints/Items/BP_Weapon_Base (a reference of DT_WeaponStats).
 */
import type { AssetManifest } from '@/types/pof-bridge';
import type { AssetType, ScannedAsset } from '@/app/api/filesystem/scan-assets/route';

export const DOC_MANIFEST: AssetManifest = {
  version: 1,
  generatedAt: '2026-02-21T14:30:22Z',
  projectName: 'PillarsOfFortune',
  engineVersion: '5.4.1',
  assetCount: 847,
  checksumSha256: 'a3f2c91d',
  blueprints: [{
    path: '/Game/Blueprints/Characters/BP_PlayerCharacter',
    parentCppClass: 'AARPGPlayerCharacter',
    parentCppModule: 'PillarsOfFortune',
    overriddenFunctions: [],
    addedComponents: [],
    variables: [],
    eventGraphEntryPoints: [],
    interfaces: ['BPI_Interactable', 'BPI_Damageable'],
    crossReferences: ['/Game/Data/DT_WeaponStats', '/Game/UI/WBP_PlayerHUD'],
    contentHash: 'b7e4a1f2',
  }],
  materials: [{
    path: '/Game/Materials/M_Character_Base',
    parentMaterial: null,
    domain: 'Surface',
    blendMode: 'Opaque',
    shadingModel: 'DefaultLit',
    parameters: [],
    materialInstances: ['/Game/Materials/MI_Character_Red', '/Game/Materials/MI_Character_Blue'],
    textureReferences: [
      '/Game/Textures/T_Char_BaseColor',
      '/Game/Textures/T_Char_Normal',
      '/Game/Textures/T_Char_ORM',
    ],
    crossReferences: ['/Game/Meshes/SK_PlayerCharacter'],
    contentHash: 'c3d8e901',
  }],
  animAssets: [
    {
      path: '/Game/Animations/AM_PrimaryAttack',
      assetType: 'AnimMontage',
      skeletonPath: '/Game/Characters/SK_Mannequin_Skeleton',
      crossReferences: ['/Game/Characters/SK_Mannequin_Skeleton', '/Game/Animations/ABP_PlayerCharacter'],
      contentHash: 'd9a2b3c4',
    },
    {
      path: '/Game/Animations/ABP_PlayerCharacter',
      assetType: 'AnimBlueprint',
      skeletonPath: '/Game/Characters/SK_Mannequin_Skeleton',
      crossReferences: ['/Game/Animations/AM_PrimaryAttack', '/Game/Animations/BS_Locomotion'],
      contentHash: 'e5f6a7b8',
    },
  ],
  dataTables: [{
    path: '/Game/Data/DT_WeaponStats',
    rowStruct: 'FWeaponStatsRow',
    rowStructModule: 'PillarsOfFortune',
    rowCount: 24,
    columnNames: ['BaseDamage', 'AttackSpeed', 'Range', 'StaggerPower', 'WeaponType'],
    crossReferences: ['/Game/Blueprints/Items/BP_Weapon_Base'],
    contentHash: 'f1a2b3c4',
  }],
  otherAssets: [{
    path: '/Game/Maps/L_MainHub',
    assetClass: 'World',
    crossReferences: [],
    contentHash: '01234567',
  }],
};

export function scanned(relativePath: string, type: AssetType, sizeBytes = 1024): ScannedAsset {
  const file = relativePath.split('/').pop()!;
  const dot = file.lastIndexOf('.');
  return {
    name: file.slice(0, dot),
    relativePath,
    fullPath: `C:/Proj/Content/${relativePath}`,
    extension: file.slice(dot),
    type,
    sizeBytes,
    modifiedAt: '2026-09-01T00:00:00.000Z',
  };
}

/** The 14 files; types are what scan-assets' inferAssetType assigns. */
export const DOC_ASSETS: ScannedAsset[] = [
  scanned('Animations/ABP_PlayerCharacter.uasset', 'animation'),
  scanned('Animations/AM_PrimaryAttack.uasset', 'animation'),
  scanned('Animations/BS_Locomotion.uasset', 'animation'),
  scanned('Blueprints/Characters/BP_PlayerCharacter.uasset', 'blueprint'),
  scanned('Characters/SK_Mannequin_Skeleton.uasset', 'mesh'),
  scanned('Data/DT_WeaponStats.uasset', 'other'),
  scanned('Materials/MI_Character_Blue.uasset', 'material'),
  scanned('Materials/MI_Character_Red.uasset', 'material'),
  scanned('Materials/M_Character_Base.uasset', 'material'),
  scanned('Meshes/SK_PlayerCharacter.uasset', 'mesh'),
  scanned('Textures/T_Char_BaseColor.uasset', 'texture'),
  scanned('Textures/T_Char_Normal.uasset', 'texture'),
  scanned('Textures/T_Char_ORM.uasset', 'texture'),
  scanned('UI/WBP_PlayerHUD.uasset', 'blueprint'),
];
