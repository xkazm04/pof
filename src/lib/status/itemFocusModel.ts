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
 */
import type { CatalogEntityBase, CatalogLink } from '@/lib/catalog/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from './judge-verdicts-db';
import { buildSwimlane, type Swimlane, type StepMeta } from './statusModel';

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
  swimlane: Swimlane;
  missing?: boolean;
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
  /** All persisted artifacts for a catalog (pre-fetched, entity-filtered here). */
  artifactsFor: (catalogId: string) => PipelineArtifact[];
  /** Judge verdicts for a catalog. */
  verdictsFor: (catalogId: string) => JudgeVerdict[];
}

export interface ItemFocusCtx extends SwimlaneCtx {
  entitiesByCatalog: EntitiesByCatalog;
  index: DependencyIndex;
}

/** Build the entity-scoped realization swimlane for one entity: the catalog's step
 *  list graded against ONLY that entity's artifacts + verdicts. */
function nodeSwimlane(catalogId: string, entityId: string, name: string, ctx: SwimlaneCtx): Swimlane {
  const artifacts = ctx.artifactsFor(catalogId).filter((a) => a.entityId === entityId);
  const verdicts = ctx.verdictsFor(catalogId).filter((v) => v.entityId === entityId);
  return buildSwimlane(catalogId, name, ctx.stepsFor(catalogId), artifacts, verdicts);
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
    swimlane: nodeSwimlane(ref.catalogId, ref.entityId, name ?? ref.entityId, ctx),
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
    swimlane: nodeSwimlane(catalogId, entityId, entity.name, ctx),
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
 *  float the least-realized entities to the top so effort lands where it's needed. Pure. */
export function sortWeakestFirst(nodes: FocusNode[]): FocusNode[] {
  return [...nodes].sort(
    (a, b) => a.swimlane.readyPct - b.swimlane.readyPct || a.name.localeCompare(b.name),
  );
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
    swimlane: nodeSwimlane(catalogId, e.id, e.name, ctx),
  }));
  return sortWeakestFirst(nodes);
}
