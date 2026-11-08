import { NextRequest } from 'next/server';
import { apiError, apiSuccess, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { attachClothToCharacter, CHAOS_CLOTH_NOT_RUN } from '@/lib/visual-gen/chaos-cloth';

/**
 * POST /api/visual-gen/chaos-cloth — the surface for the Chaos Cloth attach.
 *
 * `attachClothToCharacter` has been a proven headless UE 5.8 capability since 2026-07-22
 * (`docs/research/chaos-cloth-headless-spec.md`) with NO caller: no route, no UI, one
 * comment in `character-pipeline.ts` naming it as a rung the pipeline cannot reach. Under
 * the repo's dual-bridge law a capability with no surface is script-only, and this file is
 * that surface — nothing about the cloth graph itself changes here.
 *
 * Body: { targetSkeletalMesh, physicsAsset, garmentMeshPath? | garmentGlbPath?,
 *         destPath?, clothAssetName?, dataflowName?, garmentMeshName?, transferMethod? }
 *
 * **Editor machinery is REUSED, never forked.** The lib runs through the Experiment Lab
 * runner, which already owns the whole non-reentrant-editor contract: the read-only
 * `tasklist` probe for a live editor (refuse, never kill — `editor-precondition.ts`) and
 * the gate-runner's GLOBAL drain lease (`test-gate-runner/drain-lease`, the same registry
 * `POST /api/pipeline-artifacts/drain` and the always-on worker contend on). This route
 * adds no second guard; it only reports what the runner decided.
 *
 * **A not-run is never a 200.** When nothing was observed — a precondition refusal, or no
 * runner at all — the answer is a 503 naming {@link CHAOS_CLOTH_NOT_RUN} plus the runner's
 * own reason. An empty-but-successful envelope would let "no UE on this machine" reach the
 * UI as "the cloth attach produced nothing", which is a verdict nobody earned.
 *
 * Privileged: this boots a headless editor, so it takes the same operator guard as the
 * other UE-spawning control-plane routes (`requireOperator`).
 *
 * The run is long (editor cold start + graph build + evaluate; the lib's default settle is
 * 300 s), so the caller holds one request open for the whole attach — there is exactly one
 * editor and one lease, so a job store would queue nothing that the lease does not already
 * serialise.
 */
interface ClothBody {
  targetSkeletalMesh?: string;
  physicsAsset?: string;
  garmentMeshPath?: string;
  garmentGlbPath?: string;
  destPath?: string;
  clothAssetName?: string;
  dataflowName?: string;
  garmentMeshName?: string;
  transferMethod?: string;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// Every accepted string lands inside a single-quoted literal of the editor Python
// (`buildClothGraphPython`), so a value that could close the literal is refused here.
const GAME_PATH = /^\/[A-Za-z0-9_\-/.]+$/;
const ASSET_NAME = /^[A-Za-z0-9_-]+$/;
const ENUM_VALUE = /^[A-Za-z][A-Za-z0-9_]*$/;
const FILE_PATH = /^[^'"\r\n\0]+$/;

const FIELD_SHAPES: ReadonlyArray<readonly [keyof ClothBody, RegExp, string]> = [
  ['targetSkeletalMesh', GAME_PATH, 'a /Game path'],
  ['physicsAsset', GAME_PATH, 'a /Game path'],
  ['garmentMeshPath', GAME_PATH, 'a /Game path'],
  ['destPath', GAME_PATH, 'a /Game path'],
  ['garmentGlbPath', FILE_PATH, 'a file path with no quotes or line breaks'],
  ['clothAssetName', ASSET_NAME, 'letters, digits, _ or -'],
  ['dataflowName', ASSET_NAME, 'letters, digits, _ or -'],
  ['garmentMeshName', ASSET_NAME, 'letters, digits, _ or -'],
  ['transferMethod', ENUM_VALUE, 'an EChaosClothAssetTransferSkinWeightsMethod name'],
];

export const POST = withRoute(async (request: NextRequest) => {
  const denied = requireOperator(request);
  if (denied) return denied;

  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as ClothBody;
  for (const [field, shape, expected] of FIELD_SHAPES) {
    const value = str(body[field]);
    if (value && !shape.test(value)) return apiError(`${field} must be ${expected}`, 400);
  }

  const targetSkeletalMesh = str(body.targetSkeletalMesh);
  const physicsAsset = str(body.physicsAsset);
  const garmentMeshPath = str(body.garmentMeshPath);
  const garmentGlbPath = str(body.garmentGlbPath);

  // Refuse an under-specified attach here rather than burning an editor boot on it.
  if (!targetSkeletalMesh) return apiError('targetSkeletalMesh is required (the /Game path of the character skeletal mesh)', 400);
  if (!physicsAsset) return apiError('physicsAsset is required (the /Game path of the character physics asset — the cloth collider)', 400);
  if (!garmentMeshPath && !garmentGlbPath) {
    return apiError('a garment source is required: garmentMeshPath (an existing /Game static mesh) or garmentGlbPath (a .glb to import)', 400);
  }

  const result = await attachClothToCharacter({
    targetSkeletalMesh,
    physicsAsset,
    ...(garmentMeshPath ? { garmentMeshPath } : {}),
    ...(garmentGlbPath ? { garmentGlbPath } : {}),
    ...(str(body.destPath) ? { destPath: str(body.destPath) } : {}),
    ...(str(body.clothAssetName) ? { clothAssetName: str(body.clothAssetName) } : {}),
    ...(str(body.dataflowName) ? { dataflowName: str(body.dataflowName) } : {}),
    ...(str(body.garmentMeshName) ? { garmentMeshName: str(body.garmentMeshName) } : {}),
    ...(str(body.transferMethod) ? { transferMethod: str(body.transferMethod) } : {}),
  });

  if (result.notRun) {
    return apiError(`${CHAOS_CLOTH_NOT_RUN}: ${result.error ?? 'the runner reported no reason'}`, 503);
  }
  return apiSuccess(result);
}, 'Chaos Cloth attach failed');
