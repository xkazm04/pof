import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { verifyStaticAll, defaultStaticVerifyDeps, type StaticVerifyFilter } from '@/lib/catalog/acceptance/staticVerify';

/**
 * L2 static-verify pass — runs the catalog pipelines' `staticChecks` against the REAL UE
 * project (Source/*.h, Content/Python/) and re-grades the persisted artifacts. The
 * filesystem analog of the L3/L4 /drain route: no bridge / live editor needed, so it works
 * whenever the UE source is on disk (POF_UE_ROOT or the default checkout). This is the
 * production consumer the L2 tier never had.
 */
function parseFilter(get: (k: 'catalogId' | 'entityId') => string | null | undefined): StaticVerifyFilter {
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return { ...(catalogId ? { catalogId } : {}), ...(entityId ? { entityId } : {}) };
}

/** GET — dry-run preview: report the would-be L2 verdicts (and the resolved UE root)
 *  WITHOUT writing them back. `?catalogId=&entityId=` narrows the set. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const summary = verifyStaticAll(parseFilter((k) => sp.get(k)), defaultStaticVerifyDeps, { apply: false });
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'verify-static GET failed', 500);
  }
}

/** POST — apply: re-grade each persisted artifact whose step declares staticChecks against
 *  the real UE source and write the L2 verdict back (pass when the symbol/row is present,
 *  deferred when it's authored-but-not-yet-realized in UE). Body: { catalogId?, entityId? }. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { catalogId?: string; entityId?: string };
    const summary = verifyStaticAll(parseFilter((k) => body[k]), defaultStaticVerifyDeps, { apply: true });
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'verify-static POST failed', 500);
  }
}
