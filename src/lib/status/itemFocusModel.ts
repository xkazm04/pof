/**
 * Item Focus model — the ENTITY-centric complement to the pipeline-centric swimlane
 * map (statusModel.ts). Where a Swimlane aggregates one pipeline's readiness across
 * ALL entities, this projects ONE entity: its origin pipeline's realization state
 * (did THIS entity produce each step) plus a 1-hop, both-direction dependency map
 * (the presentation entries it binds → forward; the loot/crafting/bestiary rows that
 * reference it → reverse).
 *
 * It is a thin, pure projection over existing substrate:
 *   - artifacts are entity-scoped (pipeline_artifacts PK includes entity_id), so an
 *     entity's realization is just the catalog's artifacts filtered to its id, fed to
 *     the unchanged buildSwimlane().
 *   - cross-catalog edges already exist as CatalogLink on every entity; the reverse
 *     index is a single inverting pass over all entities.
 *
 * A FAILED READ IS NOT A GRADE (the rule the Pipelines tab already keeps). A catalog whose
 * artifact read failed arrives as an {@link UnknownRead}; its nodes are marked `unknown` and
 * get NO swimlane - grading a failure's empty list would paint every step R0 NOT WIRED / 0%.
 * A failed VERDICT read still grades from the artifact rows (as Pipelines does) but every node
 * carries `verdictsUnknown`, because without verdicts a judge-condemned step reads as reached:
 * the flag is what keeps that grade from being presented as the whole truth.
 */
import type { CatalogEntityBase, CatalogLink } from '@/lib/catalog/types';
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from './judge-verdicts-db';
import { buildSwimlane, type HeadlessLookup, type Swimlane, type StepMeta } from './statusModel';

/** A read that FAILED - distinct from an empty one. `error` is the reason, shown as-is. */
export interface UnknownRead {
  unknown: true;
  error: string;
}

/** A per-catalog read as the model receives it: the rows, or UNKNOWN. */
export type CatalogRead<T> = readonly T[] | UnknownRead;

export function unknownRead(error: string): UnknownRead {
  return { unknown: true, error };
}

function isUnknown<T>(read: CatalogRead<T>): read is UnknownRead {
  return !Array.isArray(read);
}

/** A resolved cross-catalog reference with the role that connects the two. */
export interface CatalogRef {
  catalogId: string;
  entityId: string;
  role: string;
}

/** Forward = an entity's own links; reverse = who links TO an entity (inverted). */
export interface DependencyIndex {
  forward: Map<string, CatalogLink[]>;
  reverse: Map<string, CatalogRef[]>;
}

/** Stable composite key for an entity across catalogs. */
export function entityKey(catalogId: string, entityId: string): string {
  return `${catalogId}:${entityId}`;
}

/** One focused/connected entity: its identity, the connecting role (absent for the
 *  focus itself), its entity-scoped realization swimlane, and whether the link target
 *  was actually found (dangling links still render so a broken binding is visible). */
export interface FocusNode {
  catalogId: string;
  entityId: string;
  name: string;
  role?: string;
  /** `null` exactly when `unknown` - a node whose evidence could not be read has no grade. */
  swimlane: Swimlane | null;
  missing?: boolean;
  /** The catalog's artifact read FAILED: nothing here is graded (never R0 / 0%). */
  unknown?: true;
  unknownReason?: string;
  /** The judge-verdict read failed: the swimlane shows checker status only, so a judged
   *  pass or fail is not reflected in it. */
  verdictsUnknown?: true;
  verdictsUnknownReason?: string;
}

export interface ItemFocus {
  focus: FocusNode;
  forward: FocusNode[];
  reverse: FocusNode[];
}

type EntitiesByCatalog = Record<string, Record<string, CatalogEntityBase>>;

/** Invert every entity's `links` into a forward + reverse adjacency index. One pass
 *  over all entities. Pure. */
export function buildDependencyIndex(entitiesByCatalog: EntitiesByCatalog): DependencyIndex {
  const forward = new Map<string, CatalogLink[]>();
  const reverse = new Map<string, CatalogRef[]>();
  for (const [catalogId, byId] of Object.entries(entitiesByCatalog)) {
    for (const entity of Object.values(byId)) {
      const links = entity.links ?? [];
      if (links.length === 0) continue;
      forward.set(entityKey(catalogId, entity.id), links);
      for (const link of links) {
        const key = entityKey(link.catalogId, link.entityId);
        const list = reverse.get(key) ?? [];
        list.push({ catalogId, entityId: entity.id, role: link.role });
        reverse.set(key, list);
      }
    }
  }
  return { forward, reverse };
}

/** The data sources needed to build ANY entity-scoped swimlane (per-catalog step list,
 *  artifacts, verdicts). Shared by the single-entity focus and the category overview. */
export interface SwimlaneCtx {
  /** Step metas for a catalog's pipeline (from pipeline-registry). */
  stepsFor: (catalogId: string) => StepMeta[];
  /** All persisted artifact rows for a catalog (pre-fetched, entity-filtered here) - verdict
   *  fields only, so the blob-free summary projection is a valid input - or UNKNOWN. */
  artifactsFor: (catalogId: string) => CatalogRead<ArtifactVerdictRow>;
  /** Judge verdicts for a catalog, or UNKNOWN when the verdict read failed. */
  verdictsFor: (catalogId: string) => CatalogRead<JudgeVerdict>;
  /** Headless-operability lookup (defaults to the audited coverage JSON); a test seam. */
  headless?: HeadlessLookup;
}

export interface ItemFocusCtx extends SwimlaneCtx {
  entitiesByCatalog: EntitiesByCatalog;
  index: DependencyIndex;
}

type NodeGrade = Pick<FocusNode, 'swimlane' | 'unknown' | 'unknownReason' | 'verdictsUnknown' | 'verdictsUnknownReason'>;

/** Build the entity-scoped realization swimlane for one entity: the catalog's step
 *  list graded against ONLY that entity's artifacts + verdicts - or, when the artifact read
 *  failed, no swimlane at all and the reason. */
function nodeGrade(catalogId: string, entityId: string, name: string, ctx: SwimlaneCtx): NodeGrade {
  const arts = ctx.artifactsFor(catalogId);
  if (isUnknown(arts)) return { swimlane: null, unknown: true, unknownReason: arts.error };
  const verdictRead = ctx.verdictsFor(catalogId);
  const artifacts = arts.filter((a) => a.entityId === entityId);
  const verdicts = isUnknown(verdictRead) ? [] : verdictRead.filter((v) => v.entityId === entityId);
  const swimlane = buildSwimlane(catalogId, name, ctx.stepsFor(catalogId), artifacts, verdicts, ctx.headless);
  return isUnknown(verdictRead)
    ? { swimlane, verdictsUnknown: true, verdictsUnknownReason: verdictRead.error }
    : { swimlane };
}

function lookupName(entitiesByCatalog: EntitiesByCatalog, catalogId: string, entityId: string): string | undefined {
  return entitiesByCatalog[catalogId]?.[entityId]?.name;
}

function toNode(ref: CatalogRef, ctx: ItemFocusCtx): FocusNode {
  const name = lookupName(ctx.entitiesByCatalog, ref.catalogId, ref.entityId);
  return {
    catalogId: ref.catalogId,
    entityId: ref.entityId,
    name: name ?? ref.entityId,
    role: ref.role,
    ...nodeGrade(ref.catalogId, ref.entityId, name ?? ref.entityId, ctx),
    ...(name ? {} : { missing: true }),
  };
}

/** Project one entity into an ItemFocus (focus + 1-hop forward/reverse nodes). Returns
 *  null when the focus entity does not exist. Pure. */
export function resolveItemFocus(catalogId: string, entityId: string, ctx: ItemFocusCtx): ItemFocus | null {
  const entity = ctx.entitiesByCatalog[catalogId]?.[entityId];
  if (!entity) return null;
  const selfKey = entityKey(catalogId, entityId);

  const focus: FocusNode = {
    catalogId,
    entityId,
    name: entity.name,
    ...nodeGrade(catalogId, entityId, entity.name, ctx),
  };

  const seen = new Set<string>([selfKey]);
  const dedup = (refs: CatalogRef[]): FocusNode[] => {
    const out: FocusNode[] = [];
    for (const ref of refs) {
      const key = entityKey(ref.catalogId, ref.entityId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(toNode(ref, ctx));
    }
    return out;
  };

  const forwardRefs: CatalogRef[] = (ctx.index.forward.get(selfKey) ?? []).map((l) => ({
    catalogId: l.catalogId,
    entityId: l.entityId,
    role: l.role,
  }));
  const forward = dedup(forwardRefs);
  const reverse = dedup(ctx.index.reverse.get(selfKey) ?? []);

  return { focus, forward, reverse };
}

/** Order nodes weakest-first: least production-ready coverage (R4+) ascending, then name
 *  ascending as a stable tiebreak — the whole point of the category overview is to
 *  float the least-realized entities to the top so effort lands where it's needed.
 *  UNKNOWN nodes (no swimlane) form their own band after the graded ones: ranking them as
 *  weakest would read a failed read as 0%, ranking them strongest would bury a grade. Pure. */
export function sortWeakestFirst(nodes: FocusNode[]): FocusNode[] {
  const rank = (n: FocusNode) => (n.swimlane ? n.swimlane.readyPct : Number.POSITIVE_INFINITY);
  return [...nodes].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return (ra === rb ? 0 : ra < rb ? -1 : 1) || a.name.localeCompare(b.name);
  });
}

/** Project EVERY entity in a catalog into a weakest-first list of realization
 *  swimlanes — the category overview. Same per-entity grading as resolveItemFocus's
 *  focus node, aggregated across the catalog. Pure. */
export function buildCategoryNodes(
  catalogId: string,
  entitiesByCatalog: EntitiesByCatalog,
  ctx: SwimlaneCtx,
): FocusNode[] {
  const byId = entitiesByCatalog[catalogId] ?? {};
  const nodes: FocusNode[] = Object.values(byId).map((e) => ({
    catalogId,
    entityId: e.id,
    name: e.name,
    ...nodeGrade(catalogId, e.id, e.name, ctx),
  }));
  return sortWeakestFirst(nodes);
}
