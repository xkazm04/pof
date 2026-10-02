import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { safeAssetDir, safeAssetName } from '@/lib/visual-gen/generated-assets';
import { gateRig } from '@/lib/visual-gen/rig-gate';
import { RIG_PRESETS } from '@/lib/visual-gen/rig-presets';
import {
  RIG_CHECK_MORPHOLOGIES,
  isMorphology,
  summarizeRigCheck,
  type RigCheckResponse,
} from '@/lib/visual-gen/rig-check';

/**
 * POST /api/visual-gen/rig-check
 *
 * Check ONE generated GLB's rig and compare it against every target skeleton — the
 * Auto-Rig tab's "Check a produced rig" panel.
 *
 * Body: `{ name, dir, morphology? }`. The file is resolved ONLY through the generated
 * asset allow-list: `dir` must be a member of `ASSET_DIRS` and `name` a safe `.glb`
 * basename, so a caller never names a filesystem path. `morphology` (default `biped`)
 * is the anatomy the Tier-1 gate grades the joint names against.
 *
 * Free and local: `gateRig` decodes the glTF JSON chunk plus two accessors — no Blender,
 * no model, no paid call. An unrigged or unparseable file is an ANSWER (200 with
 * `state: 'not-rigged' | 'unreadable'`); only a malformed request or a missing file is
 * an error.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: unknown; dir?: unknown; morphology?: unknown };
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    const name = safeAssetName(rawName);
    if (!name || !/\.glb$/i.test(name)) {
      return apiError('name must be a plain .glb basename from the generated asset list (no path)', 400);
    }
    const spec = safeAssetDir(typeof body.dir === 'string' ? body.dir : undefined);
    if (!spec) return apiError(`dir "${String(body.dir)}" is not a generated asset dir`, 400);

    const morphology = body.morphology === undefined ? 'biped' : body.morphology;
    if (!isMorphology(morphology)) {
      return apiError(
        `morphology "${String(morphology)}" is not one of: ${RIG_CHECK_MORPHOLOGIES.join(', ')}`,
        400,
      );
    }

    const path = join(process.cwd(), 'generated', spec.dir, name);
    if (!existsSync(path)) return apiError(`rig not found: generated/${spec.dir}/${name}`, 404);

    const summary = summarizeRigCheck(gateRig(path, { morphology }), RIG_PRESETS);
    const answer: RigCheckResponse = { name, dir: spec.dir, morphology, ...summary };
    return apiSuccess(answer);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to check the rig', 500);
  }
}
