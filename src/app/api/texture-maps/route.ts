import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  deriveNormalFromAlbedo,
  deriveHeightFromAlbedo,
  deriveRoughnessFromAlbedo,
} from '@/lib/texture-maps';
import { GENERATED_IMAGE_DIR, generatedImageUrl } from '@/lib/visual-gen/image-providers';
import { detectSeamsSafe } from '@/lib/visual-gen/seam-check';
import {
  DERIVED_CHANNELS,
  REFUSED_CHANNELS,
  derivedMapName,
  type DerivedChannel,
  type DerivedMapEntry,
  type DerivedMapsResponse,
} from '@/lib/visual-gen/derived-maps';
import { logger } from '@/lib/logger';

/**
 * POST /api/texture-maps — free, local (sharp) derivation of normal + height +
 * roughness from an albedo's bytes. No provider, no spend.
 *
 * Default: the legacy body `{normalBase64, heightBase64, roughnessBase64}`.
 * `persist: true`: the maps are written into `generated/images/` (served by
 * GET /api/visual-gen/image/:name, so they can travel to Blender where a data:
 * URL is refused), and the body is `{maps, refused}` — each map carrying its
 * provenance label (`derived-maps.ts`) and a seam check run on ITS OWN bytes,
 * not the source's; metalness is named as refused rather than left silent.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const albedoBase64 = body?.albedoBase64;
    if (!albedoBase64 || typeof albedoBase64 !== 'string') {
      return apiError('Missing or invalid "albedoBase64" field', 400);
    }
    const strength = typeof body?.strength === 'number' ? body.strength : undefined;
    const albedo = new Uint8Array(Buffer.from(albedoBase64, 'base64'));
    const roughnessInvert = typeof body?.roughnessInvert === 'boolean' ? body.roughnessInvert : true;
    const [normal, height, roughness] = await Promise.all([
      deriveNormalFromAlbedo(albedo, { strength }),
      deriveHeightFromAlbedo(albedo),
      deriveRoughnessFromAlbedo(albedo, { invert: roughnessInvert }),
    ]);
    if (body?.persist === true) {
      return apiSuccess(await persistMaps(albedo, { normal, height, roughness }));
    }
    return apiSuccess({
      normalBase64: Buffer.from(normal).toString('base64'),
      heightBase64: Buffer.from(height).toString('base64'),
      roughnessBase64: Buffer.from(roughness).toString('base64'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/texture-maps] ${message}`);
    return apiError(message, 500);
  }
}

/** Write each derived map as a served file, label it, and seam-check its bytes. */
async function persistMaps(
  albedo: Uint8Array,
  bytes: Record<DerivedChannel, Uint8Array>,
): Promise<DerivedMapsResponse> {
  // Content-addressed: the same albedo rewrites the same three files.
  const hash = createHash('sha256').update(albedo).digest('hex').slice(0, 16);
  const dir = join(process.cwd(), 'generated', GENERATED_IMAGE_DIR);
  await mkdir(dir, { recursive: true });
  const maps = await Promise.all(
    DERIVED_CHANNELS.map(async (spec): Promise<DerivedMapEntry> => {
      const name = derivedMapName(hash, spec.channel);
      const data = bytes[spec.channel];
      await writeFile(join(dir, name), data);
      return {
        channel: spec.channel,
        name,
        url: generatedImageUrl(name),
        provenance: spec.provenance,
        method: spec.method,
        colourSpace: spec.colourSpace,
        seam: await detectSeamsSafe(data),
      };
    }),
  );
  return { maps, refused: [...REFUSED_CHANNELS] };
}
