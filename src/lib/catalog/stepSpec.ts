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

/**
 * Which View kinds each archetype is allowed to render — the archetype↔view coherence
 * contract the fleet spec linter enforces (rule (a2)).
 *
 * The archetype IS the deliverable contract (it picks the corrective language in
 * `steps/shared/genericFixCopy.ts`, the canon slice in `canon/archetypeCanon.ts`, and
 * whether a live CLI may author the step at all — `labProduceMode.CLI_ELIGIBLE_ARCHETYPES`).
 * So a step whose view renders in a shape its archetype's peers never use is either
 * mis-archetyped or mis-viewed, and until this list existed nothing said which.
 *
 * DERIVED BY MEASUREMENT, not invented: this is exactly the set of (archetype, view.kind)
 * pairs the 344 registered steps use. The four steps that once diverged were corrected to
 * the cohort whose payload shape and checker they already matched, rather than widening an
 * archetype to cover a one-off:
 *   - character-pipeline "Face Gate 2D" / "Face Gate 3D" were `checklist` + `table`; their
 *     `gate` payload is a flat record graded by `fieldsPopulated`, which is the `schema`
 *     cohort's shape (11 other schema steps render exactly that), not a checklist's array.
 *   - codex "Lore Body" was `schema` + `prose` and combat-map "Ambient / Audio" was `rules`
 *     + `prose`; both write a single prose string graded by `minLength` — the `brief`
 *     contract, which all 32 brief steps share.
 *
 * This is a RATCHET. Widening an entry is a deliberate act: add the kind here together with
 * a one-line reason, so a new shape is a recorded decision rather than silent drift. Never
 * widen it merely to make a failing step pass.
 */
export const ARCHETYPE_VIEW_KINDS: Record<ArchetypeId, readonly ViewKind[]> = {
  brief: ['prose'],
  schema: ['table'],
  balance: ['chart'],
  gallery: ['gallery'],
  // `rules` is the one genuinely two-shaped archetype: 115 steps render a row/record table,
  // 11 render a manifest list (an enumeration of wired assets rather than a rule grid).
  rules: ['table', 'manifest'],
  checklist: ['checklist'],
  manifest: ['manifest'],
  graph: ['graph'],
  // `custom` is the bespoke escape hatch, but all 5 of its steps are audio manifests today.
  // A future custom step in another shape must add its kind here — deliberately, with a
  // reason — rather than the escape hatch silently accepting anything.
  custom: ['manifest'],
};

/** Remediation copy for a non-passing acceptance: a plain-language cause (`why`), an
 *  optional suggested action (`suggestion`), and the corrective direction (`fixDirection`)
 *  a one-click "Produce fix" dispatches.
 *
 *  This is the RETURN type of the derived generic copy (`steps/shared/genericFixCopy.ts`),
 *  which composes all three from the checker's own status + `reason` + this step's label
 *  and archetype. It is no longer an authoring surface on a StepSpec — see `StepSpec.copy`
 *  for why the per-step override was retired. */
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
  /**
   * RETIRED — do not author. Enforced by spec-linter rule (l).
   *
   * Zero of the registered steps ever used it, and the SIGNATURE is why: `copy` is handed
   * only the artifact `data`, never the graded `AcceptanceResult`. So an authored `why` /
   * `suggestion` structurally cannot name the checker's status or its own `reason`, while
   * the derived fallback always does (`steps/shared/genericFixCopy.ts` composes
   * `base.reason` verbatim). Authoring it therefore either makes a step's banner strictly
   * LESS honest than the fallback it replaces, or duplicates the checker's cause-derivation
   * in a second place that can drift out of step with the verdict it explains.
   *
   * Step-bespoke copy that does work already exists: the Items table
   * (`steps/itemsSteps.ts` → `ITEM_STEP_COPY`, applied inside the checker where the base
   * verdict is in scope). For everything else `fixDirectionFor` is the SINGLE source of a
   * step's corrective direction. If a step genuinely needs bespoke copy, change this
   * signature to take the `AcceptanceResult` first — as a deliberate act — rather than
   * authoring against a shape that cannot see the verdict.
   *
   * Still declared only because `withGenericFixCopy` reads it; with rule (l) green that
   * branch is provably dead and should be deleted the next time that file is touched.
   */
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
  /**
   * Optional seed direction for the Produce panel's text area, and — now that `copy` is
   * retired — the FIRST rung of the "Produce fix" ladder (this → the direction derived from
   * the failing checker by `fixDirectionFor`).
   *
   * KEPT, unlike `copy`, and the distinction is the signature: this is a plain string a step
   * author writes deliberately, not a callback that must reason about a verdict it cannot
   * see. It is legitimately usable — author it when a step has a standing house instruction
   * every corrective run should carry.
   *
   * It is authored on ZERO steps today (verified 2026-08-18), and that is NOT a defect: the
   * derived rung is always non-empty, so "Produce fix" can never dispatch an empty
   * instruction, and an option nobody has needed yet is not a broken one. Do not mass-author
   * placeholder directions to "adopt" it — a fabricated house instruction is worse than the
   * derived one, which at least names the criterion and the checker's own reason.
   */
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
  /**
   * Why this pipeline has NO packaging step — the machine-readable half of a rule with
   * exactly two states and no third.
   *
   * Every registered pipeline must EITHER own a packaging step (`isPackagingStep`: the
   * `packaging: true` flag, or the canonical "UE Packaging" label 30 of them end on) OR
   * declare this reason. Before it existed, two pipelines simply ended on something else,
   * so the packaging-truth drain had nothing to re-grade for them and said nothing about
   * it — an intentional exemption was indistinguishable from an authoring omission, and
   * the drain reported it as an ordinary skip.
   *
   * Set it only where a packaging step would be MEANINGLESS (a pipeline whose outputs
   * never pass through PoF's package staging); never to silence the rule. The reason is
   * surfaced by the drain (`verifyPackagingAll` → `summary.exempt`), so it is read by an
   * operator, not just by whoever opens this file.
   * `src/__tests__/catalog/packaging-coverage.test.ts` enforces the two-state rule.
   */
  packagingExempt?: string;
}
