import type { Checker } from './acceptance/types';
import type { UeChecker } from './acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';
import type { GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';

/** A generated candidate before it is assigned a stable id (the batch stamps ids). */
export type RawGenCandidate = Omit<GenCandidate, 'id'>;

/** A real on-disk generated asset the gallery can surface as a thumbnail. */
export interface GenAssetRef {
  name: string;
  /** Served URL under /api/visual-gen/asset/… */
  url: string;
}

/**
 * Pluggable candidate generator for a `gallery` step (Direction: real assets in generic
 * galleries). Same contract as the bespoke Items generators (`itemGenCandidates`) —
 * `RawGenCandidate[]` from `(direction, seq)` — but kept **synchronous-friendly** for
 * real assets: ArchetypeStep pre-fetches the asset manifest once (when `needsAssets`)
 * and passes it in, so `build` stays pure. When `assets` is empty (none on disk / not
 * requested) `build` must fall back honestly (deterministic swatches), never fake a
 * "real" preview. Absent → ArchetypeStep uses the default swatch generator unchanged.
 */
export interface GenCandidatesSpec {
  /** Ask ArchetypeStep to fetch the generated-asset manifest and pass it to `build`. */
  needsAssets?: boolean;
  /** Which manifest to pre-fetch when `needsAssets`: `'2d'` served preview images
   *  (default — via `useGeneratedImageAssets`) or `'3d'` `.glb` meshes (via
   *  `useGeneratedMeshAssets`). A 3D gallery's candidates carry `payload.glbUrl` so
   *  the selected mesh renders in the interactive GlbViewer. */
  assetKind?: '2d' | '3d';
  build: (direction: string, seq: number, assets: GenAssetRef[]) => RawGenCandidate[];
}

/** The common archetypes (Hybrid: these use the generic renderer; complex rows may register a bespoke component instead). */
export type ArchetypeId =
  | 'brief' | 'schema' | 'balance' | 'gallery' | 'rules' | 'checklist' | 'manifest' | 'graph' | 'custom';

/** Declarative View for the generic ArchetypeStep renderer.
 *
 *  The `chart` kind routes a step's numeric artifact data through the shared
 *  `ChartPanel` (steps/shared/ChartPanel.tsx) instead of a hand-rolled SVG. It reads
 *  `data[field]` as an object and maps the named keys to a ChartPanel flavor. All FOUR
 *  ChartPanel variants are reachable from the generic renderer:
 *   - `variant: 'bars'`      — one horizontal budget bar per `rows[]` entry (value =
 *     `field[row.key]`, label defaults to the key); `highlightKey` emphasises one bar.
 *   - `variant: 'histogram'` — one vertical bar per `keys[]` entry (a distribution).
 *   - `variant: 'scatter'`   — a dashed reference curve (`field[referenceKey]`, an array
 *     of `{x,y}`) plus optional peer/accent points (`field[pointsKey]`); `xDomain`/
 *     `yDomain` fix the axes. Use for a curve-fit / value-vs-power scatter.
 *   - `variant: 'waveform'`  — an oscilloscope strip from `field[samplesKey]` (a number
 *     array); `activeKey` (a boolean field, default active) dims it when idle.
 *  `max` fixes the bars/histogram domain ceiling (else auto). This is what a
 *  `balance`-archetype step declares so a "budget"/"faucet-vs-sink" step renders a real
 *  chart, not a table. `SUPPORTED_CHART_VARIANTS` is the single source of truth the fleet
 *  spec linter (src/__tests__/catalog/pipeline-spec-linter.test.ts) checks against. */
export const SUPPORTED_CHART_VARIANTS = ['bars', 'histogram', 'scatter', 'waveform'] as const;
export type ChartVariant = (typeof SUPPORTED_CHART_VARIANTS)[number];

export type ViewDescriptor =
  | { kind: 'prose'; field: string; emptyText: string }
  // `rowsKey` points at a nested row container when the row list lives one level under
  // `field` (`hazards.hazardList`, `telemetry.events`). `field` stays the top-level key so
  // the linter's field-coherence rules (f)/(g) are unaffected. See `catalog/tableView.ts`.
  | { kind: 'table'; field: string; columns: { key: string; label?: string; unit?: string }[]; rowsKey?: string }
  | { kind: 'chart'; variant: 'bars'; field: string; rows: { key: string; label?: string; unit?: string }[]; max?: number; highlightKey?: string }
  | { kind: 'chart'; variant: 'histogram'; field: string; keys: string[]; max?: number; highlightKey?: string }
  | { kind: 'chart'; variant: 'scatter'; field: string; referenceKey: string; pointsKey?: string; xDomain: readonly [number, number]; yDomain: readonly [number, number]; xLabel?: string; yLabel?: string }
  | { kind: 'chart'; variant: 'waveform'; field: string; samplesKey: string; activeKey?: string }
  | { kind: 'gallery'; field: string; candidates: number }
  | { kind: 'checklist'; field: string }
  | { kind: 'manifest'; field: string }
  | { kind: 'graph'; field: string };

/** The View kinds the generic ViewPanel renderer supports (linter source of truth). */
export const SUPPORTED_VIEW_KINDS = ['prose', 'table', 'chart', 'gallery', 'checklist', 'manifest', 'graph'] as const;
export type ViewKind = (typeof SUPPORTED_VIEW_KINDS)[number];

/** Per-step remediation copy: a plain-language cause (`why`), an optional suggested
 *  action (`suggestion`), and an optional corrective direction (`fixDirection`) that
 *  seeds a one-click "Produce fix". Optional on a StepSpec — ArchetypeStep derives a
 *  neutral, honest fallback from the checker result when a step supplies none. */
export interface StepFixCopy {
  why: string;
  suggestion?: string;
  fixDirection?: string;
}

export interface StepSpec {
  archetype: ArchetypeId;
  label: string;
  view: ViewDescriptor;
  /**
   * What the Produce writes.
   *
   * `direction` is the operator's typed art direction, forwarded by every dispatch site
   * (ArchetypeStep, the Items static steps, the one-shot step route). It is OPTIONAL on
   * both sides: a step body may ignore it (most do today — the per-catalog produce
   * redesign that makes the constant bodies direction-sensitive is follow-on work), and
   * every caller that has no direction (the spec linter, headless recipes, demo seeding)
   * calls it with one argument exactly as before. Whether or not the body reads it, the
   * direction + built prompt are persisted on the artifact via `withProduceDirection`
   * (`@/lib/catalog/produceDirection`), so a produced step always records what drove it.
   */
  produce: (entity: LabEntity, direction?: string) => StepOutput;
  /** Derives the acceptance result from the persisted artifact data. */
  accept: Checker;
  /** Optional plain-language remediation copy for a non-passing acceptance. When
   *  absent — as it is for every step today — ArchetypeStep falls back to the generic
   *  copy derived from the checker result (status + optional reason) plus this step's
   *  own label/archetype, which never invents catalog-specific content
   *  (`steps/shared/genericFixCopy.ts`). Authoring `copy` here overrides the `why` and
   *  `suggestion`; a `fixDirection` you omit or leave blank still falls through to
   *  `defaultDirection` and then to the derived direction, so "Produce fix" can never
   *  dispatch an empty instruction. */
  copy?: (data: Record<string, unknown>) => StepFixCopy;
  /** Optional L2 static (UE codebase-analysis) checks, run server/CLI-side against the UE root.
   *  Entity-aware because the symbol/row names derive from the entity. */
  staticChecks?: (entity: LabEntity) => UeChecker[];
  /** Marks a packaging step: the packaging-truth drain (/api/pipeline-artifacts/
   *  verify-packaging) rebuilds its package from the row's SIBLING artifacts and
   *  re-grades it from disk truth. Steps labeled "UE Packaging" are matched without
   *  the flag (see `isPackagingStep`) — set it only for non-standard labels. */
  packaging?: boolean;
  /** Optional pluggable candidate generator for a `gallery` step. When present,
   *  ArchetypeStep's gallery uses it (real thumbnails from disk when available) instead
   *  of the default deterministic swatch generator. Ignored for non-gallery steps. */
  genCandidates?: GenCandidatesSpec;
  /** Optional CLI direction default + note for the Produce panel. */
  produceNote?: string;
  /** Optional seed direction for the Produce panel's text area, and the SECOND rung of
   *  the "Produce fix" ladder (bespoke `copy.fixDirection` → this → the direction derived
   *  from the failing checker). Authoring it is optional precisely because the derived
   *  rung is always non-empty; author it when a step has a standing house instruction
   *  that a corrective run should always carry. */
  defaultDirection?: string;
  /** Engine powering this step's Produce (e.g. 'Claude', 'Tripo', 'Leonardo',
   *  'UE Python', 'Blender', 'Code') — surfaced on the /status health map, where it
   *  also decides output-credibility (LLM text scales to quality; generative
   *  3D/audio/2D output needs a real gate). Inferred heuristically when absent. */
  engine?: string;
}

export interface CatalogPipeline {
  catalogId: string;
  steps: StepSpec[];
}
