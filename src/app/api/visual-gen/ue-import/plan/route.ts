import { NextRequest } from 'next/server';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { critiqueMesh, type CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import { gateRequestFor } from '@/lib/visual-gen/gate-request';
import { importStageFor } from '@/lib/visual-gen/ue-import-job-store';
import { planUeImport, type CollisionUse } from '@/lib/visual-gen/ue-import-plan';

const USES: CollisionUse[] = ['blocking', 'decorative', 'character'];
const ASSET_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;
/** How many existing files the replace reason names before it just counts. */
const NAMED_FILES = 3;

/**
 * POST /api/visual-gen/ue-import/plan
 *
 * PREVIEW an import: the plan the job would make and whether it would replace anything —
 * answered in seconds, without launching the editor. Read-only: it runs the $0 Tier-1 critic
 * (a local trimesh script) and reads the project's Content folder; it writes nothing and never
 * reaches the experiment runner. The import itself stays `POST /api/visual-gen/ue-import`,
 * the only door that writes into UE, sent on an explicit operator click.
 *
 * Body: { glbPath, use, assetName, assetClass?, targetExtentM?, components? }
 *
 * Every delivery imports into its OWN folder, `/Game/Generated/<assetName>/`. A glTF import
 * writes the mesh AND its materials and textures, named from the glb's internal names rather
 * than the asset name, and the importer runs with `replace_existing`. In the shared
 * `/Game/Generated` a second import could silently replace a previous import's material while a
 * mesh-only check said "new". So the replace verdict is folder-wide: ANY file under
 * `<Content>/Generated/<assetName>/` means this import replaces something (registry:
 * imported-material-conformance — a name collision is refused and reported, never absorbed).
 *
 * `assetPath` (`<destPath>/<assetName>`) is the REQUESTED path. The live run of 2026-09-07 saw
 * the glTF importer nest the mesh under `<dest>/<glb basename>/StaticMeshes/`; the folder-wide
 * check above holds either way, and the imported path is read back by the job.
 *
 * `replaces` is `null` when POF_UE_UPROJECT is unset — the project is unknown, so the check is
 * not made (and the import itself would refuse on the same missing variable).
 *
 * The refusals mirror the import route's word for word — a preview must not accept what the
 * import refuses, and a parity test holds the two together.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      glbPath?: string;
      use?: string;
      assetName?: string;
      assetClass?: string;
      targetExtentM?: number;
      components?: number;
    };

    const glbPath = body.glbPath?.trim();
    if (!glbPath) return apiError('glbPath is required', 400);
    if (!/\.glb$/i.test(glbPath)) {
      return apiError(
        `only .glb is importable by this route (got "${glbPath}") — the executing pipeline writes GLB, and the FBX path has its own Interchange gotcha`,
        400,
      );
    }
    if (!existsSync(glbPath)) return apiError(`no file at ${glbPath}`, 400);

    if (!body.use) {
      return apiError(
        `use is required — one of ${USES.join(', ')}. It decides collision, and no default is safe: a decorative asset wants none, a blocking prop wants hulls.`,
        400,
      );
    }
    if (!USES.includes(body.use as CollisionUse)) {
      return apiError(`use must be one of ${USES.join(', ')} (got "${body.use}")`, 400);
    }
    const use = body.use as CollisionUse;

    const assetName = typeof body.assetName === 'string' ? body.assetName.trim() : '';
    if (!ASSET_NAME_RE.test(assetName)) {
      return apiError(
        'assetName is required ([A-Za-z0-9_], at most 64 chars) — an unnamed import lands on the shared /Game/Generated/TripoSRMesh and replaces the last one',
        400,
      );
    }

    if (body.components !== undefined && (!Number.isInteger(body.components) || body.components < 1)) {
      return apiError('components, when given, must be a positive integer', 400);
    }
    if (body.targetExtentM !== undefined && !(typeof body.targetExtentM === 'number' && Number.isFinite(body.targetExtentM) && body.targetExtentM > 0)) {
      return apiError('targetExtentM, when given, must be a positive number of metres (the intended longest extent)', 400);
    }
    if (body.assetClass !== undefined && typeof body.assetClass !== 'string') {
      return apiError('assetClass, when given, must be a string', 400);
    }
    const assetClass = body.assetClass?.trim() || undefined;

    // The SAME critique the job runs: through `gateRequestFor`, at the stage the path implies.
    const gate = gateRequestFor({ assetClass, stage: importStageFor(glbPath), targetExtentM: body.targetExtentM });
    let critique: CritiqueResult | undefined;
    try {
      critique = await critiqueMesh(glbPath, gate.deps);
    } catch {
      critique = undefined; // as in the job: an absent critic costs the plan evidence, never the answer
    }
    const plan = planUeImport({ critique, use, declaredShells: body.components, assetClass, targetExtentM: body.targetExtentM });

    const destPath = `/Game/Generated/${assetName}`;
    const replace = replaceVerdict(assetName);

    return apiSuccess({
      collision: plan.collision,
      planBasis: plan.collisionBasis,
      shells: plan.shells ?? null,
      scale: { ...plan.scale, factor: plan.scale.factor ?? null },
      orientation: plan.orientation,
      gradedAs: gate.gradedAs,
      critiqueUnavailable: critique?.unavailable,
      critiqueError: critique?.unavailable ? critique.error : undefined,
      destPath,
      assetPath: `${destPath}/${assetName}`,
      replaces: replace.replaces,
      replacesReason: replace.reason,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to plan ue-import', 500);
  }
}

/** Every file under `dir`, relative to it (depth-first). Empty sub-folders contribute nothing. */
function filesUnder(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(p, root));
    else out.push(relative(root, p).replace(/\\/g, '/'));
  }
  return out;
}

function replaceVerdict(assetName: string): { replaces: boolean | null; reason: string } {
  const uproject = process.env.POF_UE_UPROJECT;
  if (!uproject) {
    return { replaces: null, reason: 'POF_UE_UPROJECT is not set — the project is unknown, so whether this import replaces anything was not checked' };
  }
  const folder = join(dirname(uproject), 'Content', 'Generated', assetName);
  const files = existsSync(folder) ? filesUnder(folder) : [];
  if (files.length === 0) {
    return { replaces: false, reason: `nothing under /Game/Generated/${assetName}/ — a new folder; the mesh and its materials/textures land beside nothing` };
  }
  const named = files.slice(0, NAMED_FILES).join(', ') + (files.length > NAMED_FILES ? ', …' : '');
  return {
    replaces: true,
    reason: `${files.length} file(s) already under /Game/Generated/${assetName}/ (${named}) — the import replaces existing assets, materials and textures included`,
  };
}
