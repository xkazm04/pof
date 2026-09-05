import { NextRequest } from 'next/server';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { bindIconsAll, type BindIconsFilter, type BindIconsDeps } from '@/lib/catalog/acceptance/bindIconsAll';
import { buildIconList, resolveIconFor, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact } from '@/lib/catalog/headless';
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
 */
function listLibrary(): GeneratedIcon[] {
  const dir = join(process.cwd(), 'generated', 'icons');
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return []; // no library → nothing to bind, not an error
  }
  const stated = files.flatMap((name) => {
    try {
      const s = statSync(join(dir, name));
      return s.isFile() ? [{ name, mtimeMs: s.mtimeMs }] : [];
    } catch {
      return [];
    }
  });
  return buildIconList(stated);
}

function makeDeps(icons: GeneratedIcon[]): BindIconsDeps {
  return {
    listArtifacts: (filter) =>
      listAllArtifacts(filter).map((a) => ({
        catalogId: a.catalogId,
        entityId: a.entityId,
        step: a.step,
        status: a.status,
        data: a.data ?? {},
      })),
    // The library's own precedence — the entity's icon first, the per-step icon as the
    // fallback (`resolveIconFor` picks the newest of whichever scope answered).
    iconFor: (catalogId, step, entityId) => {
      const hit = resolveIconFor(icons, catalogId, step, entityId);
      return hit ? { url: hit.url, scope: hit.scope } : null;
    },
    grade: (catalogId, step, data, entityId) => {
      const { graded, raw } = gradeArtifact(catalogId, step, data, entityId);
      return graded ? raw : null;
    },
    save: (catalogId, entityId, step, data, res) => {
      const existing = getArtifact(catalogId, entityId, step);
      upsertArtifact({
        catalogId, entityId, step,
        data,
        ueAssets: existing?.ueAssets ?? [],
        status: res.status,
        tier: res.tier,
        ...(res.reason ? { reason: res.reason } : res.detail ? { reason: res.detail } : {}),
      });
    },
    now: () => new Date().toISOString(),
  };
}

function parseFilter(get: (k: 'catalogId' | 'entityId') => string | null | undefined): BindIconsFilter {
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return { ...(catalogId ? { catalogId } : {}), ...(entityId ? { entityId } : {}) };
}

/** GET — dry-run preview: what WOULD be bound and how each verdict would move. No writes. */
export async function GET(req: NextRequest) {
  try {
    const icons = listLibrary();
    const sp = req.nextUrl.searchParams;
    return apiSuccess(bindIconsAll(parseFilter((k) => sp.get(k)), makeDeps(icons), { apply: false, library: icons.length }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'bind-icons GET failed', 500);
  }
}

/** POST — apply the bindings. Body: `{ catalogId?, entityId? }`. Idempotent (a candidate
 *  that already carries a real asset is skipped as `already-real`). */
export async function POST(req: NextRequest) {
  try {
    const icons = listLibrary();
    const body = (await req.json().catch(() => ({}))) as { catalogId?: string; entityId?: string };
    return apiSuccess(bindIconsAll(parseFilter((k) => body[k]), makeDeps(icons), { apply: true, library: icons.length }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'bind-icons POST failed', 500);
  }
}
