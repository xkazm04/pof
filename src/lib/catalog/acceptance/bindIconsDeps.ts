/**
 * Server deps for the icon-bind pass — the icon library reader and the artifact-db wiring,
 * shared by `/api/pipeline-artifacts/bind-icons` and the catalog re-settle
 * (`/api/pipeline-artifacts/settle`) so both routes read ONE library the same way and write
 * through ONE `save` — the re-grade door's `persistRegrade` (`./regrade`), over the real db or
 * the settle preview's stage. (Next route files may export only handlers, hence this module.)
 */
import type { BindIconsDeps } from './bindIconsAll';
import { resolveIconFor, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import { iconLibraryDir, readIconLibrary } from '@/lib/visual-gen/icon-library';
import { gradeArtifact } from '@/lib/catalog/headless';
import { persistRegrade, realArtifactIO, createTouched, type ArtifactIO } from './regrade';

/** The files under `generated/icons/`, through the library door's ONE reader — the same
 *  manifest `GET /api/visual-gen/icons` serves, provenance (`origin`, bound to the bytes)
 *  included. An absent dir is an empty library — nothing to bind, not an error. */
export function listIconLibrary(): GeneratedIcon[] {
  return readIconLibrary(iconLibraryDir()) ?? [];
}

/** The real bind deps over one library listing: the io's rows, the library's own precedence
 *  (the entity's icon first, the per-step icon as the fallback), the server checker, and the
 *  one `save` that persists the bound data with its re-graded verdict. `flushLifecycle` re-derives
 *  the lifecycle of each entity saved since the last flush, once — call it after an apply run. */
export function makeBindIconsDeps(
  icons: GeneratedIcon[],
  io: ArtifactIO = realArtifactIO,
): BindIconsDeps & { flushLifecycle: () => void } {
  const touched = createTouched();
  return {
    listArtifacts: (filter) =>
      io.list(filter).map((a) => ({
        catalogId: a.catalogId,
        entityId: a.entityId,
        step: a.step,
        status: a.status,
        data: a.data ?? {},
      })),
    iconFor: (catalogId, step, entityId) => {
      const hit = resolveIconFor(icons, catalogId, step, entityId);
      return hit ? { url: hit.url, scope: hit.scope } : null;
    },
    grade: (catalogId, step, data, entityId) => {
      const { graded, raw } = gradeArtifact(catalogId, step, data, entityId);
      return graded ? raw : null;
    },
    save: (catalogId, entityId, step, data, res) => {
      persistRegrade(io, { catalogId, entityId, step }, res, data);
      touched.add(catalogId, entityId);
    },
    now: () => new Date().toISOString(),
    flushLifecycle: () => touched.flush(io.syncLifecycle),
  };
}
