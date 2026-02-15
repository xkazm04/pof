import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { analyzeConsistency } from '@/lib/asset-code-oracle';
import type { ScannedClass } from '@/app/api/filesystem/scan-project/route';
import type { ScannedAsset, AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';

/**
 * POST /api/asset-code-oracle
 *
 * Accepts pre-scanned data from the client (both scan-project and scan-assets
 * results) and runs the consistency oracle analysis.
 *
 * The client is responsible for calling the two scan endpoints first and
 * passing the results here — this avoids coupling the oracle to filesystem
 * access and keeps it a pure analysis layer.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      classes,
      assets,
      dependencies,
    } = body as {
      classes: ScannedClass[];
      assets: ScannedAsset[];
      dependencies: AssetDependencyEdge[];
    };

    if (!Array.isArray(classes) || !Array.isArray(assets)) {
      return apiError('classes and assets arrays are required', 400);
    }

    const result = analyzeConsistency(
      classes,
      assets,
      dependencies ?? [],
    );

    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
