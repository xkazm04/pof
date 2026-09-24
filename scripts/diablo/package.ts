/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * UE Packaging for an ingested entity (/diablo W05) — declare what is REALLY in UE, then let the
 * packaging verifier grade it from disk.
 *
 *   npx tsx scripts/diablo/package.ts --catalog bestiary --id d1-MT_NZOMBIE
 *
 * The UE content lives under `diabloUeRoot(name)` (/Game/Diablo/Bestiary/<Name>, gitignored in the
 * UE repo: reference-game content stays local), imported by scripts/diablo/ue_import_monster.py.
 * This script (1) re-declares the sibling steps' ueAssets at that real root (same data — the earlier
 * declarations guessed /Game/Bestiary/...), (2) submits `UE Packaging` declaring the imported assets,
 * with a wiring contract naming THIS entity's registration, and (3) runs `verifyPackagingAll` for this
 * one entity: a declared path that has no .uasset on disk defers — nothing here decides the verdict.
 */
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { submitStepArtifact } from '../../src/lib/catalog/headless';
import { seededEntities } from '../../src/lib/catalog/seed';
import { defaultPackagingVerifyDeps, verifyPackagingAll } from '../../src/lib/catalog/acceptance/packagingVerify';
import { diabloUeRoot } from './ueRoot';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
if (!entityId) { console.error('usage: package.ts --catalog <id> --id <entityId>'); process.exit(2); }
const entity = seededEntities(catalogId).find((e) => e.id === entityId);
if (!entity) { console.error(`REFUSED: ${catalogId}/${entityId} is not a seeded/promoted entity`); process.exit(1); }

const { root, slug } = diabloUeRoot(entity);
const arts = listArtifacts(catalogId, entityId);

// A family member shares its family head's mesh (Diablo recolours one model): its 3D & Rig candidate
// carries `sharedWith`, so the mesh is declared at the HEAD's root and only the member's own
// Blueprint + tinted material live under its own.
const rigCand = ((arts.find((a) => a.step === '3D & Rig')?.data.genHistory ?? {}) as { selectedId?: string; batches?: { candidates?: { id: string; payload?: Record<string, unknown> }[] }[] });
const cand = rigCand.batches?.flatMap((b) => b.candidates ?? []).find((c) => c.id === rigCand.selectedId);
const sharedWith = typeof cand?.payload?.sharedWith === 'string' ? cand.payload.sharedWith : undefined;
const headEntity = sharedWith ? seededEntities(catalogId).find((e) => e.id === sharedWith) : undefined;
const meshRoot = headEntity ? diabloUeRoot(headEntity) : { root, slug };
// Interchange nests a .glb import under <file>/SkeletalMeshes/; the import script reports the real
// path, so the mesh declaration is read from the UE content on disk rather than guessed.
const meshDir = `${meshRoot.root}`;

// The mesh's real UE path: Interchange nests a .glb import under <root>/<glb basename>/SkeletalMeshes/.
const glbUrl = typeof cand?.payload?.glbUrl === 'string' ? cand.payload.glbUrl : '';
const glbBase = (/asset\/([^?]+)\.glb/.exec(glbUrl)?.[1] ?? '').replace(/%20/g, ' ');
const meshDirFull = glbBase ? `${meshRoot.root}/${glbBase}/SkeletalMeshes` : meshRoot.root;
const DECLARED: Record<string, string[]> = {
  'Concept 2D Art': [`${root}/T_${slug}_Concept`],
  '3D & Rig': [`${meshDirFull}/SK_${meshRoot.slug}`, `${meshDirFull}/SK_${meshRoot.slug}_Skeleton`, `${meshDirFull}/SK_${meshRoot.slug}_PhysicsAsset`],
};
for (const [step, paths] of Object.entries(DECLARED)) {
  const a = arts.find((x) => x.step === step);
  if (!a) { console.log(`skip ${step}: not produced`); continue; }
  const r = submitStepArtifact(catalogId, entityId, step, a.data, paths);
  console.log(`re-declared ${step} → ${paths.join(', ')} (${r.acceptance.status})`);
}

const assets = sharedWith
  ? [`BP_${slug}`, `MI_${slug}`, `GA_${slug}_Melee`, `T_${slug}_Concept`]
  : [`BP_${slug}`, `GA_${slug}_Melee`, `T_${slug}_Concept`];
const pkg = submitStepArtifact(catalogId, entityId, 'UE Packaging', {
  assets,
  wiringContract: {
    grantedBy: sharedWith
      ? `BP_${slug} (child of AARPGEnemyCharacter, ${root}) with ${headEntity!.name}'s shared SkeletalMesh under ${meshDir} and MI_${slug} recolouring it`
      : `BP_${slug} (child of AARPGEnemyCharacter, ${root}) with its own SkeletalMesh under ${meshDir}; GA_Death + GA_HitReact granted`,
    activatedBy: `spawning BP_${slug} (AARPGEnemyCharacter::BeginPlay grants its abilities; bEquipSithLightsaber off — it carries no weapon)`,
    dependencies: ['AARPGEnemyCharacter (C++ base class)', 'UARPGAttributeSet (incl. MagicResistance, /diablo D17)', 'GA_Death', 'GA_HitReact'],
    verification: `L2: every declared ${root} asset exists as a .uasset${sharedWith ? ` (the mesh lives with ${headEntity!.name}, shared)` : ''}; L3: -game scenario spawn_actor ${root}/BP_${slug} + canon_ortho capture, blind family check`,
  },
}, assets.map((a) => `${root}/${a}`));
console.log(`UE Packaging submitted (${pkg.acceptance.status}) declaring ${assets.length} assets`);

const summary = verifyPackagingAll({ catalogId, entityId }, defaultPackagingVerifyDeps());
for (const r of summary.results) console.log(`VERIFY ${r.step}: ${r.from} -> ${r.to} ${r.detail ?? ''} ${r.reason ?? ''}`);
