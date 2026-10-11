/**
 * The run-level PARENT pass for a C++ reference read by `cpp-decls` (/zelda, vault Findings F18, Decisions Z-D97 / Z-D98).
 *
 * A class record keeps its bases as written. A parent written bare (no `::`) usually lives in ANOTHER file — often in
 * another spec, sometimes in another catalog — so the per-file reader cannot know which record it names, and its raw must
 * never be edited to say so. Once every spec of the run is wrapped, this pass looks the FIRST base up among the run's own
 * class / struct / union records and puts the answer on the child's PROJECTION:
 *
 *  - found → one link `{ catalogId: <the parent's own catalog>, entityId: <the parent's id>, role: 'extends' }`;
 *  - not found → no link, but an explicit marker `data.unresolvedLinks: [{ role: 'extends', ref: <the name as written> }]`
 *    and an entry in the run's `LinkReport.unresolved`. The marker sits in `data`, never in `links`, so the generic link
 *    loop (which only walks `links`) can never turn it into a guessed id.
 *
 * Lookup, first hit wins, template arguments stripped: (1) the child's enclosing class scope (namespace + outer + name);
 * (2) the child's namespace, then each enclosing namespace outward, to the global scope. A record is never its own parent.
 * A qualified first base, no base, and every non-class record are left as they are. The index is the run's set (every
 * spec reads its whole glob each run), never the database. A name held by two records resolves nothing and is reported.
 *
 * The pass is code, so its version joins the mapping version of every spec whose technique it reads (`wrapTable`, the
 * rule a derivation follows): a rewritten row carries a stamp it did not carry before. Bump `revision` on any change here.
 */
import { CPP_LIST_SEP } from '@/lib/catalog/ingest/cppDecls';
import type { CatalogLink } from '@/lib/catalog/types';
import { logger } from '@/lib/logger';
import { contentHash } from './hash';
import type { UnresolvedLink } from './links';
import type { ReferenceWrapper } from './wrapper';

/** A pass a source runs over ALL of one run's wrappers before the generic link loop. */
export interface RunLinkPass {
  /** The technique id (`cpp-decls`) whose wrappers it reads; its version joins every spec of that technique. */
  technique: string;
  version: string;
  run(wrappers: ReferenceWrapper[]): { wrappers: ReferenceWrapper[]; unresolved: UnresolvedLink[]; ambiguous: string[] };
}

/** PoF's word for "this node is a kind of that node". */
export const EXTENDS_ROLE = 'extends';

/** The projection field that keeps a parent no record answers, as written. */
export const UNRESOLVED_MARKER_FIELD = 'unresolvedLinks';

export interface UnresolvedLinkMarker {
  role: string;
  ref: string;
}

const CLASS_KINDS = new Set(['class', 'struct', 'union']);
const SCOPE = '::';

/** `cpp-decls@3` → `cpp-decls`. */
const techniqueIdOf = (label: string): string => (label.includes('@') ? label.slice(0, label.lastIndexOf('@')) : label);

/** The written name with every template argument list removed (`Box<A<B>>` → `Box`). */
export function stripTemplateArgs(name: string): string {
  let out = '';
  let depth = 0;
  for (const c of name) {
    if (c === '<') depth++;
    else if (c === '>') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += c;
  }
  return out.trim();
}

/** The first base as written, or `''`. */
export const firstBaseOf = (raw: Record<string, string>): string => (raw.bases ?? '').split(CPP_LIST_SEP)[0].trim();

/** The qualified names a bare first base can mean, in lookup order. */
export function parentCandidates(raw: Record<string, string>): string[] {
  const name = stripTemplateArgs(firstBaseOf(raw));
  const join = (...parts: string[]) => parts.filter(Boolean).join(SCOPE);
  const namespaces = raw.namespace ? raw.namespace.split(SCOPE) : [];
  const out: string[] = [];
  if (raw.outer) out.push(join(raw.namespace ?? '', raw.outer, name));
  for (let i = namespaces.length; i >= 0; i--) out.push(join(...namespaces.slice(0, i), name));
  return out;
}

function createCppParentPass(technique: string): RunLinkPass {
  const version = contentHash({
    pass: 'first-base-parent', revision: 1, technique, role: EXTENDS_ROLE, marker: UNRESOLVED_MARKER_FIELD,
    lookup: ['enclosing-class', 'namespace-outward'], templateArgs: 'stripped',
  });
  const isClassRecord = (w: ReferenceWrapper) => techniqueIdOf(w.technique) === technique && CLASS_KINDS.has(w.raw.kind ?? '');

  return {
    technique,
    version,
    run(wrappers) {
      const index = new Map<string, ReferenceWrapper>();
      const held = new Set<string>();
      for (const w of wrappers) {
        if (!isClassRecord(w)) continue;
        const key = w.raw.qualifiedName ?? '';
        if (index.has(key)) held.add(key);
        else index.set(key, w);
      }
      const ambiguous = [...held].sort();
      if (ambiguous.length) logger.warn(`[reference] ${ambiguous.length} qualified name(s) held by more than one class record; they resolve no parent`, ambiguous);

      const unresolved: UnresolvedLink[] = [];
      const out = wrappers.map((w): ReferenceWrapper => {
        if (!isClassRecord(w)) return w;
        const written = firstBaseOf(w.raw);
        if (!written || written.includes(SCOPE)) return w;
        let parent: ReferenceWrapper | undefined;
        for (const candidate of parentCandidates(w.raw)) {
          if (held.has(candidate)) break;
          const hit = index.get(candidate);
          if (hit && hit !== w) { parent = hit; break; }
        }
        const links: CatalogLink[] = (w.entity.links ?? []).filter((l) => l.role !== EXTENDS_ROLE);
        if (parent) {
          links.push({ catalogId: parent.catalogId, entityId: parent.entity.id, role: EXTENDS_ROLE });
          return { ...w, entity: { ...w.entity, links } };
        }
        unresolved.push({ wrapperId: w.wrapperId, role: EXTENDS_ROLE, catalogId: '', ref: written });
        const marker: UnresolvedLinkMarker[] = [{ role: EXTENDS_ROLE, ref: written }];
        return { ...w, entity: { ...w.entity, data: { ...w.entity.data, [UNRESOLVED_MARKER_FIELD]: marker } } };
      });
      return { wrappers: out, unresolved, ambiguous };
    },
  };
}

/** The parent pass over `cpp-decls` records (botw's only run-level pass). */
export const CPP_DECLS_PARENT_PASS: RunLinkPass = createCppParentPass('cpp-decls');
