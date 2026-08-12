import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  deriveNormalFromAlbedo,
  deriveHeightFromAlbedo,
  deriveRoughnessFromAlbedo,
} from '@/lib/texture-maps';
import { logger } from '@/lib/logger';

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
