import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { bindIconsAll, type BindIconsFilter } from '@/lib/catalog/acceptance/bindIconsAll';
import { listIconLibrary, makeBindIconsDeps } from '@/lib/catalog/acceptance/bindIconsDeps';
import '@/lib/catalog/pipelines/registry.generated';

/**
 * Icon-binding pass — the filesystem analog of /drain for 2D art.
 *
 * `generated/icons/` holds gated, already-generated images named for the exact pipeline
 * step they were made for, and the lab renders them; but a produce stub persists only
 * deterministic swatch candidates, so those steps grade `deferred` ("not a generated
 * asset") even though the art exists. This route binds the library art onto each such
 * artifact's selected candidate and RE-GRADES through the normal server checker.
 *
 * It cannot manufacture a pass: the file must exist and match the artifact's own identity
 * — `iconSlug(catalogId, step, entityId)` for the entity's own art, `iconSlug(catalogId,
 * step)` for the per-step fallback — an artifact with no generation history is skipped, and
 * the bind is disclosed in the artifact data (`iconBinding`) with the scope that served it.
 *
 * The library reader and the db wiring live in `bindIconsDeps.ts`, shared with the catalog
 * re-settle (`/api/pipeline-artifacts/settle`), which runs this pass for one catalog.
 */
function parseFilter(get: (k: 'catalogId' | 'entityId') => string | null | undefined): BindIconsFilter {
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return { ...(catalogId ? { catalogId } : {}), ...(entityId ? { entityId } : {}) };
}

/** GET — dry-run preview: what WOULD be bound and how each verdict would move. No writes. */
export async function GET(req: NextRequest) {
  try {
    const icons = listIconLibrary();
    const sp = req.nextUrl.searchParams;
    return apiSuccess(bindIconsAll(parseFilter((k) => sp.get(k)), makeBindIconsDeps(icons), { apply: false, library: icons.length }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'bind-icons GET failed', 500);
  }
}

/** POST — apply the bindings. Body: `{ catalogId?, entityId? }`. Idempotent (a candidate
 *  that already carries a real asset is skipped as `already-real`). */
export async function POST(req: NextRequest) {
  try {
    const icons = listIconLibrary();
    const body = (await req.json().catch(() => ({}))) as { catalogId?: string; entityId?: string };
    return apiSuccess(bindIconsAll(parseFilter((k) => body[k]), makeBindIconsDeps(icons), { apply: true, library: icons.length }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'bind-icons POST failed', 500);
  }
}
