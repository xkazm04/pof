import { CATALOG_SECTIONS, type CatalogSection } from '@/lib/catalog/sections';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { labPipelineSteps } from './labPipelines';
import { resolveAccept } from './labAcceptance';
import { ITEM_STEP_NAMES } from './steps/itemsSteps';

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

/**
 * THE ITEMS SPEC DUALITY — declared here, in ONE place, on purpose.
 *
 * `items` is the only catalog with TWO step specs, and until 2026-07-29 the two files
 * simply disagreed (11 labels vs 13) with nothing saying so. They are not a mistake and
 * they are not interchangeable — they answer different questions:
 *
 *  • ON-SCREEN (`ITEM_STEP_SPECS`, {@link ITEMS_ON_SCREEN_STEPS}) — the 13 fine-grained
 *    steps a human actually walks and grades in `/layout`. Routed by `BESPOKE_CATALOGS`
 *    and graded by `resolveAccept`. This is the reference implementation of the bespoke
 *    step UI (Rules 1–4) and is the ONLY items spec any user sees.
 *  • REGISTRY (`src/lib/catalog/pipelines/items.ts`, {@link ITEMS_REGISTRY_STEPS}) — the
 *    11 coarse steps that carry the ARPG canon payloads (affix tier tables, GE wiring
 *    contracts, DT_Items packaging manifest). This is what `/status`, the headless
 *    pof-mcp drains, the L3/L4 runner and the judge fleet enumerate, and what the fleet
 *    spec linter walks.
 *
 * Six labels are shared ({@link ITEMS_SHARED_STEPS}); a `step-facts.json` row is keyed by
 * (catalogId, step), so a shared label carries ONE fact describing that step identity in
 * both specs, and a bespoke-only label carries its own.
 *
 * WHY NOT MERGE: the registry labels key persisted `pipeline_artifacts` rows, recorded
 * `judge_verdicts`, `step-facts.json` and the headless drains; the bespoke labels key the
 * per-step UI registry (`getStepComponent`) and the reference e2e walk. Renaming either
 * side orphans real recorded data. The duality is therefore DECLARED and GUARDED
 * (`src/__tests__/catalog/items-spec-duality.test.ts`) rather than papered over: both
 * lists are asserted against their sources, and the bespoke 13 are held to the same
 * produce/accept rules the fleet linter applies to the registry pipelines.
 */
export const ITEMS_SPEC_DUALITY = {
  catalogId: 'items',
  reason:
    'The 13 bespoke labels key the on-screen step UIs + the reference e2e walk; the 11 registry ' +
    'labels key persisted artifacts, judge verdicts, step facts and the headless drains. Merging ' +
    'either side orphans recorded data, so both are declared and guarded instead.',
} as const;

/** The 13 step labels the lab actually RENDERS and grades for `items` (bespoke). */
export const ITEMS_ON_SCREEN_STEPS: readonly string[] = ITEM_STEP_NAMES;

/** The 11 step labels the registered `StepSpec` pipeline exposes to /status + headless. */
export function itemsRegistrySteps(): string[] {
  return getCatalogPipeline('items')?.steps.map((s) => s.label) ?? [];
}

/** Labels defined by BOTH items specs — one `step-facts.json` row serves both. */
export function itemsSharedSteps(): string[] {
  const registry = new Set(itemsRegistrySteps());
  return ITEMS_ON_SCREEN_STEPS.filter((s) => registry.has(s));
}

/** Every items step label that exists in either spec — the set a `StepFact` must cover. */
export function itemsAllStepLabels(): string[] {
  return [...new Set([...itemsRegistrySteps(), ...ITEMS_ON_SCREEN_STEPS])];
}

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
