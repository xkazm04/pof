/**
 * statusReads - the ONE place the /status views turn the two shared reads (per-catalog
 * artifacts + judge verdicts) into something gradeable.
 *
 * A FAILED READ IS NOT A GRADE. A read that is loading, absent from the read set, or failed is
 * an {@link UnknownRead} - never `[]`, because an empty list grades every step R0 NOT WIRED.
 * Pipelines, Category and Item Focus used to each hand-build this; they now share it. Pure:
 * nothing here fetches, renders or grades (grading stays in statusModel / itemFocusModel).
 */
import { getCatalogPipeline, allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import type { CatalogArtifacts } from '@/components/status/statusArtifactSource';
import type { StatusVerdictRead } from '@/components/status/statusVerdictSource';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { unknownRead, type SwimlaneCtx } from '@/lib/status/itemFocusModel';
import { buildSwimlane, sortLanes, judgedContentOfRow, type Swimlane, type StepMeta } from '@/lib/status/statusModel';
import type { JudgedContent } from '@/lib/catalog/acceptance/judgeBridge';
import { craftForCell, type CellCraft, type CraftVerdictView } from '@/lib/craft/craftCell';

/** The two shared reads as a view holds them. `null` = still loading. */
export interface StatusReads {
  catalogs: readonly CatalogArtifacts[] | null;
  verdicts: StatusVerdictRead | null;
}

/** A registered catalog's step list as the swimlane model takes it. */
export function stepsFor(catalogId: string): StepMeta[] {
  const p = getCatalogPipeline(catalogId);
  return p ? p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine })) : [];
}

/**
 * The SwimlaneCtx for the entity-scoped tabs. Nothing grades until BOTH reads settle; a
 * catalog outside the read set is 'not read', a failed one carries its error; a failed verdict
 * read leaves artifacts gradeable (checker-only) but makes every verdictsFor UNKNOWN.
 */
export function swimlaneCtxFromReads({ catalogs, verdicts }: StatusReads): SwimlaneCtx {
  const reads = new Map((catalogs ?? []).map((c) => [c.catalogId, c]));
  return {
    stepsFor,
    artifactsFor: (c) => {
      if (!catalogs || !verdicts) return unknownRead('evidence still loading');
      const read = reads.get(c);
      if (!read) return unknownRead('not read');
      return read.error !== null ? unknownRead(read.error) : read.rows;
    },
    verdictsFor: (c) => {
      if (verdicts && !verdicts.ok) return unknownRead(verdicts.error);
      return (verdicts && verdicts.ok && verdicts.byCatalog.get(c)) || [];
    },
  };
}

/** One degraded-read notice, in display order. */
export interface ReadNotice {
  kind: 'artifacts' | 'verdicts';
  /** The catalog an `artifacts` notice is about. */
  subject?: string;
  error: string;
}

/** Failed catalogs (in read order), then a failed verdict read. Empty while loading or healthy. */
export function readNotices({ catalogs, verdicts }: StatusReads): ReadNotice[] {
  const out: ReadNotice[] = [];
  for (const c of catalogs ?? []) {
    if (c.error !== null) out.push({ kind: 'artifacts', subject: c.catalogId, error: c.error });
  }
  if (verdicts && !verdicts.ok) out.push({ kind: 'verdicts', error: verdicts.error });
  return out;
}

/** A catalog whose artifact read failed. Deliberately NOT a Swimlane. */
export interface UnknownLane {
  catalogId: string;
  error: string;
}

export interface AssembledLanes {
  lanes: Swimlane[];
  unknown: UnknownLane[];
  /** `${catalogId} ${step}` -> craft reading; null when the craft read is absent (never A0). */
  craft: Map<string, CellCraft> | null;
}

/**
 * Lane assembly for the Pipelines map: failed catalogs are held out as unknown, the rest are
 * graded (with the craft join) and ordered by sortLanes.
 */
export function assembleLanes({
  catalogs,
  byCatalog,
  craftByCatalog,
}: {
  catalogs: readonly CatalogArtifacts[];
  byCatalog: ReadonlyMap<string, JudgeVerdict[]>;
  craftByCatalog: ReadonlyMap<string, CraftVerdictView[]> | null;
}): AssembledLanes {
  const specs = new Map(allCatalogPipelines().map((p) => [p.catalogId, p]));
  const craft = craftByCatalog ? new Map<string, CellCraft>() : null;
  const lanes: Swimlane[] = [];
  const unknown: UnknownLane[] = [];
  for (const c of catalogs) {
    const p = specs.get(c.catalogId);
    if (!p) continue;
    // A failed read is NOT an empty catalog: it would grade every step R0 NOT WIRED.
    if (c.error !== null) {
      unknown.push({ catalogId: c.catalogId, error: c.error });
      continue;
    }
    const metas = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
    if (craft && craftByCatalog) {
      // Per-step entity -> what the artifact holds NOW, via THE row-hash rule the judge path uses.
      const contentByStep = new Map<string, Map<string, JudgedContent>>();
      for (const a of c.rows) {
        const m = contentByStep.get(a.step) ?? new Map<string, JudgedContent>();
        m.set(a.entityId, judgedContentOfRow(a));
        contentByStep.set(a.step, m);
      }
      for (const s of p.steps) {
        const cc = craftForCell(
          c.catalogId,
          s.label,
          craftByCatalog.get(c.catalogId) ?? [],
          contentByStep.get(s.label) ?? new Map(),
        );
        if (cc) craft.set(`${c.catalogId} ${s.label}`, cc);
      }
    }
    lanes.push(buildSwimlane(c.catalogId, c.catalogId, metas, c.rows, byCatalog.get(c.catalogId) ?? []));
  }
  return { lanes: sortLanes(lanes), unknown, craft };
}
