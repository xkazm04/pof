import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  verifyPackagingAll,
  defaultPackagingVerifyDeps,
  type PackagingVerifyFilter,
} from '@/lib/catalog/acceptance/packagingVerify';

/**
 * Packaging-verify pass — rebuilds each row's package from its SIBLING artifacts
 * (referenced files hashed in place, embedded data-URL art materialized under
 * generated/packages/<catalogId>/<entityId>/ + manifest.json) and re-grades the
 * packaging artifact from disk truth. The L2 sibling of /verify-static: pure
 * filesystem, no bridge/editor needed. Un-does the audited "packaging never touches
 * disk/UE" hollow-pass class.
 */
function parseFilter(get: (k: 'catalogId' | 'entityId') => string | null | undefined): PackagingVerifyFilter {
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return { ...(catalogId ? { catalogId } : {}), ...(entityId ? { entityId } : {}) };
}

/** GET — dry-run preview: the would-be verdicts (and what each package would contain /
 *  is missing) WITHOUT writing artifacts. NOTE: the package dirs/manifests themselves
 *  ARE (re)built on disk — that is the ground truth being graded, not app state.
 *  `?catalogId=&entityId=` narrows the set. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const summary = verifyPackagingAll(parseFilter((k) => sp.get(k)), defaultPackagingVerifyDeps(), { apply: false });
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'verify-packaging GET failed', 500);
  }
}

/** POST — apply: rebuild every persisted packaging step's package and write the L2
 *  verdict back (pass when all referenced outputs exist + hash, deferred with reasons
 *  otherwise). Body: { catalogId?, entityId? }. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { catalogId?: string; entityId?: string };
    const summary = verifyPackagingAll(parseFilter((k) => body[k]), defaultPackagingVerifyDeps(), { apply: true });
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'verify-packaging POST failed', 500);
  }
}
