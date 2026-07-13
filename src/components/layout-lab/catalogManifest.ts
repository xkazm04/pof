import { CATALOG_SECTIONS, type CatalogSection } from '@/lib/catalog/sections';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { labPipelineSteps } from './labPipelines';
import { resolveAccept } from './labAcceptance';

/**
 * One catalog manifest — the single place that resolves how the /layout lab wires a
 * catalog together across the four decentralized sources that used to be edited by
 * hand: the catalog `section` (`@/lib/catalog/sections`), the ordered `steps`
 * (bespoke fine-step list vs a registered `StepSpec` pipeline), the acceptance
 * `grader` (`resolveAccept`), and the bespoke composition-UI availability.
 *
 * It is a *resolver* over the existing sources, not a copy of their data — so adding
 * a catalog stays a matter of registering a pipeline + a section, and this module
 * (plus its guard test) surfaces any desync instead of letting the rail and matrix
 * silently render different step lists.
 *
 * The privileged `bespoke` flag replaces the `catalogId === 'items'` special-cases
 * that were scattered across `useBaseline`, `useEntityArtifacts`, and `labPipelines`.
 */

/**
 * Catalogs whose lab UI is the bespoke reference implementation — curated step
 * components (`STEP_REGISTRY`) + the curated fine-step names (`ITEM_STEP_NAMES`),
 * which deliberately override any registered `StepSpec` pipeline of the same id.
 * Items is the single privileged reference catalog.
 */
const BESPOKE_CATALOGS = new Set<string>(['items']);

/** Where a catalog's ordered step labels come from. */
export type StepSource =
  /** Bespoke reference pipeline: curated fine steps + bespoke step UIs (Items). */
  | 'bespoke'
  /** A registered `StepSpec` pipeline drives the generic `ArchetypeStep`. */
  | 'registry'
  /** No registered pipeline — the generic track-label fallback (ungraded). */
  | 'fallback';

export interface CatalogManifest {
  catalogId: string;
  /** Section metadata from `CATALOG_SECTIONS`, or `null` when the catalog has no section. */
  section: CatalogSection | null;
  /** True for the privileged reference catalog(s) — replaces the `isItems` special-case. */
  bespoke: boolean;
  /** Which of the four step sources actually drives this catalog. */
  stepSource: StepSource;
  /** True when a registered `StepSpec` pipeline exists (independent of `bespoke`). */
  hasPipeline: boolean;
  /** The single resolved ordered step-label list — identical for rail, matrix, and detail. */
  steps: string[];
}

/**
 * Resolve the full manifest for a catalog. Bespoke catalogs render their curated
 * fine-step list even when a same-id `StepSpec` pipeline is registered (the Items
 * bespoke UI is keyed to `ITEM_STEP_NAMES`, not the registry labels); every other
 * catalog with a pipeline renders the pipeline labels; the rest fall back to the
 * generic track labels.
 */
export function catalogManifest(catalogId: string): CatalogManifest {
  const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId) ?? null;
  const bespoke = BESPOKE_CATALOGS.has(catalogId);
  const pipeline = getCatalogPipeline(catalogId);
  const hasPipeline = pipeline !== null;
  const useRegistry = !bespoke && hasPipeline;
  const stepSource: StepSource = bespoke ? 'bespoke' : useRegistry ? 'registry' : 'fallback';
  const steps = useRegistry ? pipeline!.steps.map((s) => s.label) : labPipelineSteps(catalogId);
  return { catalogId, section, bespoke, stepSource, hasPipeline, steps };
}

/** The `isItems` flag, routed through the manifest so the special-case lives in one place. */
export function isBespokeCatalog(catalogId: string | undefined): boolean {
  return !!catalogId && BESPOKE_CATALOGS.has(catalogId);
}

/**
 * The single step-source lookup used by `useBaseline`, `CatalogMatrix`, and
 * `useLabCatalogData` — collapses the old FINE_STEPS-vs-registry duality so the
 * rail and the matrix can never disagree about a catalog's step list.
 */
export function resolveCatalogSteps(catalogId: string): string[] {
  return catalogManifest(catalogId).steps;
}

/** Grader availability for a (catalog, step): a bespoke `ItemStepSpec` or a registry `StepSpec` checker. */
export function hasStepGrader(catalogId: string, step: string): boolean {
  return resolveAccept(catalogId, step) !== null;
}
