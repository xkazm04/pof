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
 *  `data[field]` as an object and maps the named keys to a ChartPanel flavor:
 *   - `variant: 'bars'`      — one horizontal budget bar per `rows[]` entry (value =
 *     `field[row.key]`, label defaults to the key); `highlightKey` emphasises one bar.
 *   - `variant: 'histogram'` — one vertical bar per `keys[]` entry.
 *  `max` fixes the domain ceiling (else auto). This is what a `balance`-archetype step
 *  declares so a "budget"/"faucet-vs-sink" step renders a real chart, not a table. */
export type ViewDescriptor =
  | { kind: 'prose'; field: string; emptyText: string }
  | { kind: 'table'; field: string; columns: { key: string; label?: string; unit?: string }[] }
  | { kind: 'chart'; variant: 'bars'; field: string; rows: { key: string; label?: string; unit?: string }[]; max?: number; highlightKey?: string }
  | { kind: 'chart'; variant: 'histogram'; field: string; keys: string[]; max?: number; highlightKey?: string }
  | { kind: 'gallery'; field: string; candidates: number }
  | { kind: 'checklist'; field: string }
  | { kind: 'manifest'; field: string }
  | { kind: 'graph'; field: string };

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
  /** What the Produce writes. */
  produce: (entity: LabEntity) => StepOutput;
  /** Derives the acceptance result from the persisted artifact data. */
  accept: Checker;
  /** Optional plain-language remediation copy for a non-passing acceptance. When
   *  absent, ArchetypeStep falls back to a generic copy derived from the checker
   *  result (status + optional reason) — never invents catalog-specific content. */
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
