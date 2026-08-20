/**
 * Status dashboard model — pure aggregation of pipeline_artifacts truth into the
 * swimlane health map (one pipeline per row, one cell per step).
 *
 * The grade ladder is deliberately STRICT about what earns green: an L0–L2 pass
 * only proves "an output exists and passed static checks", so it grades by the
 * ENGINE's credibility class instead of jumping to green —
 *   verified  — a real gate passed (L3 runtime / L4 visual): professional-grade proof
 *   trusted   — L0–L2 pass from an engine class that scales to quality without a
 *               gate (LLM text, deterministic code, human selection)
 *   ungated   — L0–L2 pass from generative media (3D/audio/2D) or unproven runtime
 *               claims: output exists, professional quality NOT yet provable
 *   deferred  — honest L3/L4 wait (gate declared, not run)
 *   attention — a produced artifact fails
 *   pending   — produced but not yet passing
 *   unwired   — NO artifact exists (mocked / skipped / never run) ← the bottleneck
 */
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from './judge-verdicts-db';
import stepFactsJson from './step-facts.json';
import headlessCoverageJson from './headless-coverage.json';
import { BANDS, newestRubricVerdicts } from '@/lib/judge/rubrics';
// THE staleness rule, shared with the per-step Acceptance banner (`bridgeJudgeVerdict`) so
// the map and the drill-down can never disagree about the same verdict. Pure (hash + rubric
// arithmetic, no I/O), so the model stays JSON + args only.
import {
  verdictProvenance,
  judgedContentOf,
  judgedContentFromHash,
  unverifiedReason,
  CONDEMNING_PROVENANCE,
  type JudgedContent,
} from '@/lib/catalog/acceptance/judgeBridge';
import type { JudgeAttribution, VerdictProvenance } from '@/lib/catalog/acceptance/types';
import { mirrorSupport, type MirrorSupport } from '@/lib/preview/browser-mirror';
import { getRealization, type StepRealization } from '@/lib/preview/realization';
// readiness.ts imports only TYPES from this module, so this is not a runtime cycle.
import { readinessOf, atOrAbove, type ReadinessLevel } from './readiness';

export type CellGrade = 'verified' | 'trusted' | 'ungated' | 'unpowered' | 'deferred' | 'attention' | 'pending' | 'unwired';

/** One audited step fact from the 2026-07-07 Sonnet-fleet gap audit: who ACTUALLY
 *  produces the artifact, what the step claims to deliver, whether a wired generator
 *  for that class exists, and what judge could prove professional quality. */
export interface StepFact {
  catalogId: string;
  step: string;
  trueEngine: string;
  deliverable: string;
  generatorWired: boolean;
  judge: 'ue-test' | 'vlm' | 'llm-panel' | 'human' | 'none';
  checkerMeaningful: boolean;
  note: string;
}

const FACTS = new Map<string, StepFact>(
  (stepFactsJson.steps as StepFact[]).map((s) => [`${s.catalogId}|${s.step}`, s]),
);

export function getStepFact(catalogId: string, step: string): StepFact | undefined {
  return FACTS.get(`${catalogId}|${step}`);
}

/** One row of the headless-operability coverage walk (`scripts/headless-coverage.mjs`,
 *  regen: `node scripts/headless-coverage.mjs` with the dev server running). A step is
 *  `operable` when it can actually be produced/verified headlessly via pof-mcp. A cell
 *  cannot grade `verified` unless its step is proven headless-operable — a gate that only
 *  a human can drive is not professional-grade PROOF the machine can reproduce. */
export interface HeadlessFact {
  catalogId: string;
  step: string;
  operable: boolean;
  reason?: string;
}

const HEADLESS = new Map<string, HeadlessFact>(
  (headlessCoverageJson.steps as HeadlessFact[]).map((s) => [`${s.catalogId}|${s.step}`, s]),
);

export function getHeadlessFact(catalogId: string, step: string): HeadlessFact | undefined {
  return HEADLESS.get(`${catalogId}|${step}`);
}

/* ── audited-fact drift ──────────────────────────────────────────────────────────────────
 *
 * Every audited JSON in this subsystem addresses a step by `catalogId | step-LABEL`:
 * step-facts.json (what really powers a step), headless-coverage.json (may a cell grade
 * `verified`), ceiling-facts.json (what caps a capability class) and preview/
 * realization-facts.json (may a cell reach R5). Labels are DISPLAY strings that authors
 * reword freely — so a rename silently drops the audit and falls the step through to the
 * heuristic. The map does not error; it just gets quieter and more confident at the same
 * time, which is the one failure mode /status must not have.
 *
 * The lookups cannot be re-keyed here (the JSONs are audit records, owned elsewhere), so the
 * defence is a DRIFT CHECK: every audited address must resolve to a registered step, and an
 * orphan is REPORTED for a human. Never reattached by fuzzy match — guessing which renamed
 * step an audit meant would fabricate provenance, which is worse than losing it.
 */

/** One (catalogId, step-label) address an audited fact claims to describe. */
export interface FactAddress {
  catalogId: string;
  step: string;
}

/** The key both the fact indexes and the drift check address a step by. */
export function factKey(catalogId: string, step: string): string {
  return `${catalogId}|${step}`;
}

/** Every address in step-facts.json. */
export function stepFactAddresses(): FactAddress[] {
  return (stepFactsJson.steps as StepFact[]).map((s) => ({ catalogId: s.catalogId, step: s.step }));
}

/** Every address in headless-coverage.json. */
export function headlessFactAddresses(): FactAddress[] {
  return (headlessCoverageJson.steps as HeadlessFact[]).map((s) => ({ catalogId: s.catalogId, step: s.step }));
}

/**
 * Audited facts whose address no longer resolves to a live step. Pure — `liveKeys` (a set of
 * {@link factKey}s) is supplied by the caller, so the model never imports the registry.
 */
export function orphanedFacts(facts: readonly FactAddress[], liveKeys: ReadonlySet<string>): FactAddress[] {
  return facts.filter((f) => !liveKeys.has(factKey(f.catalogId, f.step)));
}

export type HeadlessLookup = (catalogId: string, step: string) => HeadlessFact | undefined;

/** Gate a derived cell on headless-operability: a `verified` grade demands the step be
 *  PROVEN headless-operable via pof-mcp (a machine-reproducible gate), so a would-be
 *  `verified` cell whose step has no coverage entry OR is `operable:false` is demoted to
 *  `trusted` — the honest ceiling for a claim the machine can't reproduce — with the
 *  reason prefixed `not headless-operable via pof-mcp`. All other grades pass through
 *  unchanged. Pure; the coverage lookup is injectable for tests. */
export function gateHeadless(
  cell: StepCell,
  catalogId: string,
  step: string,
  lookup: HeadlessLookup = getHeadlessFact,
): StepCell {
  if (cell.grade !== 'verified') return cell;
  const fact = lookup(catalogId, step);
  if (fact && fact.operable) return cell;
  const prefix = 'not headless-operable via pof-mcp';
  const reason = cell.reason ? `${prefix}: ${cell.reason}` : prefix;
  return { ...cell, grade: 'trusted', reason };
}

/** Deliverable classes that require a real media generator (a passing checker on
 *  hand-typed placeholder data must NOT read as produced capability). */
const MEDIA_DELIVERABLES = new Set(['2d-art', '3d-mesh', 'audio', 'vfx-particles', 'animation']);

export type EngineClass = 'llm' | 'gen2d' | 'gen3d' | 'audio' | 'runtime' | 'tooling' | 'code' | 'human' | 'unaudited';

/** The engine name a step gets when NOTHING identifies its engine: no `StepSpec.engine`, no
 *  audited `StepFact.trueEngine`, and no heuristic match. It is a real name (not a guess at a
 *  real engine) so the cell can SAY the engine is unknown. */
export const UNAUDITED_ENGINE = 'Unaudited';

/** Engine-name → credibility class. LLM text/code/human-selection scale to quality;
 *  generative media and unproven runtime claims need a real gate. */
export const ENGINE_CLASS: Record<string, EngineClass> = {
  Claude: 'llm',
  [UNAUDITED_ENGINE]: 'unaudited',
  Code: 'code',
  Human: 'human',
  Leonardo: 'gen2d',
  Tripo: 'gen3d',
  TripoSR: 'gen3d',
  Hunyuan: 'gen3d',
  Meshy: 'gen3d',
  ElevenLabs: 'audio',
  'UE Python': 'runtime',
  'UE C++': 'runtime',
  'UE Runtime': 'runtime',
  Blender: 'tooling',
  VLM: 'tooling',
  // Audited `trueEngine` strings from step-facts.json that were absent here and therefore fell
  // through to the trusted `llm` bucket — 95 audited steps presented as trusted LLM work
  // (measured 2026-08-18). `Leonardo` was mapped but the audited string is the fuller
  // "Leonardo (Lucid Origin)", so the shorter key never matched.
  'Leonardo (Lucid Origin)': 'gen2d',
  'Code (deterministic)': 'code',
  // The packaging verifier rebuilds the package from sibling artifacts and grades it from DISK
  // TRUTH (real staged+hashed files) — deterministic code, no model and no UE runtime.
  // See src/lib/catalog/acceptance/packagingVerify.ts.
  'Packaging engine': 'code',
  'UE test': 'runtime',
};

/** Classes whose L0–L2 pass is credible without a gate. `unaudited` is deliberately absent:
 *  a step nobody has identified an engine for has earned no credibility, and putting the
 *  unknown case in the trusted bucket is how uncertainty gets read as quality. */
const TRUSTED_CLASSES: ReadonlySet<EngineClass> = new Set(['llm', 'code', 'human']);

/** Entities created by test/smoke harnesses (`src/__tests__/catalog/headless.test.ts`, the MCP
 *  smoke check) that POST into the same DB as real content. They are fixtures, not deliverables:
 *  a judge scoring one is scoring a stub, and because a cell is `attention` if ANY of its
 *  entities fails, a stub's verdict reds out a step whose real content is shippable. Excluded
 *  from the map and never judged. */
export function isSyntheticEntity(entityId: string): boolean {
  return entityId.startsWith('test-headless') || entityId === 'item-mcp-smoke';
}

export interface StepMeta {
  label: string;
  archetype?: string;
  engine?: string;
}

/**
 * Resolve the engine powering a step: explicit StepSpec.engine wins, else a heuristic over
 * catalog + archetype + label. Pure.
 *
 * An UNMATCHED step resolves to {@link UNAUDITED_ENGINE}, not `Claude`. `StepSpec.engine` is
 * authored on 12 of ~344 steps, so this heuristic speaks for the rest — and its old fallback
 * put every step it could not classify into `llm`, the HIGHEST-credibility class. That is
 * uncertainty being read as quality: a step nobody audited and no rule matched looked exactly
 * like one genuinely powered by an LLM. The unknown case now says it is unknown and earns no
 * credibility (see `TRUSTED_CLASSES`).
 */
export function inferEngine(catalogId: string, step: StepMeta): string {
  if (step.engine) return step.engine;
  if (catalogId === 'player-movement') return 'UE Python';
  const label = step.label.toLowerCase();
  if (step.archetype === 'gallery') {
    if (/3d|mesh|model/.test(label)) return 'Tripo';
    return 'Leonardo';
  }
  if (/audio|music|ambient|sound|voice/.test(label) || ['music', 'ambient', 'audio'].includes(catalogId)) {
    if (step.archetype === 'custom' || step.archetype === 'manifest') return 'ElevenLabs';
  }
  if (/playable|runtime|test gate|in-game|pie\b/.test(label)) return 'UE Runtime';
  if (/visual gate|screenshot|capture/.test(label)) return 'VLM';
  return UNAUDITED_ENGINE;
}

/** Where a cell's engine name came from — an AUDITED fact, an AUTHORED spec, or a heuristic
 *  GUESS. Nothing marked which was which, so an inferred label read as established fact. */
export type EngineSource = 'audited' | 'authored' | 'inferred';

/**
 * How an engine name must READ on the map, per source.
 *
 * `resolveEngine` has distinguished the three sources since the audit landed, and
 * `buildSwimlane` stamps the answer onto every cell — but nothing rendered it, so a
 * heuristic guess and an audited fact printed the same string in the same weight. This is
 * the single vocabulary both render sites (`StatusCell`, `EvidenceModal`) use.
 *
 * `glyph` + `word` carry the distinction, never hue (WCAG 1.4.1) — the same discipline as
 * `readinessCode` and `ProvenanceStrip`.
 *
 * `undefined` is deliberately a state of its own and is NOT silently treated as known: a
 * cell built without recording its provenance has proven nothing, and letting the omission
 * render like an audited fact is exactly the class of lie this map exists to expose.
 */
export const ENGINE_SOURCE_MARK: Record<EngineSource | 'unsourced', { glyph: string; word: string; note: string }> = {
  audited: {
    glyph: '✓',
    word: 'AUDITED',
    note: 'named by the fleet gap audit (step-facts.json trueEngine) — an agent read this step and recorded what powers it',
  },
  authored: {
    glyph: '✎',
    word: 'AUTHORED',
    note: 'declared by the step itself (StepSpec.engine); no audit fact covers this step',
  },
  inferred: {
    glyph: '?',
    word: 'UNAUTHORED',
    note: 'nothing authored or audited names this engine — the label is a HEURISTIC GUESS over catalog + archetype + label, not a fact',
  },
  unsourced: {
    glyph: '?',
    word: 'UNSOURCED',
    note: 'this cell was built without recording where its engine name came from — treat the name as unverified',
  },
};

/** The provenance mark for a cell's `engineSource`, with the missing case handled loudly. */
export function engineSourceMark(source?: EngineSource) {
  return ENGINE_SOURCE_MARK[source ?? 'unsourced'];
}

/** Resolve a step's engine AND how confidently it is known. The audited fleet fact
 *  (`StepFact.trueEngine`) outranks the authored spec, which outranks the heuristic. Pure. */
export function resolveEngine(catalogId: string, step: StepMeta, fact?: StepFact): { engine: string; source: EngineSource } {
  if (fact?.trueEngine && fact.trueEngine !== 'None') {
    return { engine: fact.trueEngine.replace(' (deterministic)', ''), source: 'audited' };
  }
  if (step.engine) return { engine: step.engine, source: 'authored' };
  return { engine: inferEngine(catalogId, step), source: 'inferred' };
}

export function engineClass(engine: string): EngineClass {
  // An engine name we do not recognise is UNKNOWN, not trusted. The old `?? 'llm'` put every
  // unrecognised string into `TRUSTED_CLASSES`, so uncertainty was biased toward the highest
  // credibility bucket — the same defect `inferEngine`'s fallback had, one seam down and with a
  // far larger blast radius, because it caught AUDITED engines whose spelling had drifted from
  // this map. Adding a new engine now requires adding it here, which is the point.
  return ENGINE_CLASS[engine] ?? 'unaudited';
}

export interface StepCell {
  label: string;
  engine: string;
  /** Whether `engine` is an AUDITED fact, an AUTHORED spec value, or a heuristic GUESS.
   *  Set by `buildSwimlane` (which knows all three sources); absent on a bare `deriveCell`,
   *  where the caller supplied the engine and only the caller knows where it came from. */
  engineSource?: EngineSource;
  grade: CellGrade;
  tier?: string;
  counts: { pass: number; deferred: number; fail: number; pending: number };
  reason?: string;
  /** What could prove this output professional-grade (from the fleet audit). */
  judge?: StepFact['judge'];
  /** Audit note — the gap, or why the step is sound. */
  auditNote?: string;
  /** False when the accept checker verifies shape only (field-exists / length),
   *  not content — the benevolence the audit exposed. */
  checkerMeaningful?: boolean;
  /** Content-quality judgment (LLM panel / VLM), when one has run. */
  judged?: { verdict: 'pass' | 'fail'; score: number; model: string; findings: string; effort?: string; rubricVersion?: number };
  /**
   * Whether that judgment still speaks for the content on record — the SAME
   * `JudgeAttribution` the per-step Acceptance banner carries, plus `applied`: did it move
   * this cell's grade? Present whenever `judged` is, INCLUDING when the verdict was not
   * applied, so a green that went away (or a red that lifted) states its reason instead of
   * changing silently.
   */
  judgeAttribution?: JudgeAttribution & { applied: boolean };
  /** Dual execution: the step class also runs in the browser preview ('direct'/'partial').
   *  Absent when there is no browser path (incl. the ue-runtime moat). */
  browserMirror?: MirrorSupport;
  /** Dual-execution EVIDENCE from the per-pipeline review: did this step's output
   *  actually run in the Browser / UE? Absent until the pipeline is reviewed. */
  realization?: StepRealization;
}

const GATE_TIERS = new Set(['L3', 'L4']);

/**
 * What ONE row holds right now, for checking a verdict's content binding against it.
 *
 * THE row-hash rule, in priority order — shared by both /status models so they cannot answer
 * the same question differently:
 *  1. the row CARRIES its binding (`contentHash`) → take it. The blob-free summary projection
 *     stamps it server-side with the same `stepContentHash` the full path computes, so this is
 *     the identical fingerprint, not a second rule.
 *  2. the row was read in FULL → hash its own blob, byte-identically to before.
 *  3. NEITHER → no hash at all. A reader that has no blob and no binding cannot prove one, and
 *     `judgedContentOf(undefined)` would fingerprint `{}` — fabricating a binding that could
 *     match a genuinely-empty step's verdict. Hash-less degrades to `unknown` provenance:
 *     still CONDEMNING (a recorded fail is evidence) but never ELEVATING. Unprovable falls to
 *     the conservative side.
 *
 * Pure.
 */
export function judgedContentOfRow(a: ArtifactVerdictRow): JudgedContent {
  if (a.contentHash) return judgedContentFromHash(a.contentHash, a.updatedAt);
  if (a.data) return judgedContentOf(a.data, a.updatedAt);
  return judgedContentFromHash(undefined, a.updatedAt);
}

/** What each ENTITY of this step holds right now. `judge_verdicts` and `pipeline_artifacts`
 *  are both keyed by (catalog, entity, step), so this is the join that lets a verdict be
 *  checked against the content it claims to have judged. Pure. */
function contentByEntity(artifacts: ArtifactVerdictRow[]): Map<string, JudgedContent> {
  const m = new Map<string, JudgedContent>();
  for (const a of artifacts) m.set(a.entityId, judgedContentOfRow(a));
  return m;
}

/**
 * What a verdict does and does not prove HERE — the same vocabulary `bridgeJudgeVerdict`
 * puts on the per-step Acceptance banner, so an operator reading the map and the drill-down
 * hears one sentence, not two.
 */
function provenanceNote(v: JudgeVerdict, p: VerdictProvenance, applied: boolean): string {
  if (p === 'current') return 'Judged the content currently on record.';
  const kind = v.verdict === 'fail' ? 'FAIL' : 'PASS';
  if (applied) {
    return `This verdict cannot be confirmed against the current content — ${unverifiedReason(v)}.`
      + ' It is still applied, and still needs a re-judge.';
  }
  if (p === 'stale') {
    return `A judge ${kind} is on record but it judged content this step no longer holds`
      + ' (re-produced since). Not applied — this step is UNJUDGED, not judged-and-passed.';
  }
  if (p === 'superseded') {
    return `A judge ${kind} is on record under a superseded rubric. Not applied — this step`
      + ' needs a re-judge under the current rubric.';
  }
  return `A judge ${kind} is on record but ${unverifiedReason(v)}. Not applied — a binding`
    + ' nobody can confirm cannot PROVE quality (it can still condemn).';
}

function attribution(v: JudgeVerdict, p: VerdictProvenance, applied: boolean): JudgeAttribution & { applied: boolean } {
  return {
    provenance: p,
    verdict: v.verdict,
    score: v.score,
    judge: v.judge,
    ...(v.model ? { model: v.model } : {}),
    ...(v.judgedAt ? { judgedAt: v.judgedAt } : {}),
    note: provenanceNote(v, p, applied),
    applied,
  };
}

/** Derive one cell from every artifact recorded for that step label, cross-examined
 *  against the audited step fact and any content-quality judge verdicts. Pure. */
export function deriveCell(
  label: string,
  engine: string,
  artifacts: ArtifactVerdictRow[],
  fact?: StepFact,
  verdicts: JudgeVerdict[] = [],
): StepCell {
  const counts = { pass: 0, deferred: 0, fail: 0, pending: 0 };
  let bestPassTier: string | undefined;
  let tier: string | undefined;
  let reason: string | undefined;
  for (const a of artifacts) {
    if (a.status === 'pass') {
      counts.pass += 1;
      if (a.tier && (!bestPassTier || a.tier > bestPassTier)) bestPassTier = a.tier;
    } else if (a.status === 'deferred') counts.deferred += 1;
    else if (a.status === 'fail') counts.fail += 1;
    else counts.pending += 1;
    if (a.tier && (!tier || a.tier > tier)) tier = a.tier;
    if (a.reason && !reason) reason = a.reason;
  }

  // A pass on a claim NOTHING in the palette can produce (audited trueEngine None, or a
  // media deliverable with no wired generator) is UNPOWERED — the checker passed on
  // hand-typed placeholder data, not real capability.
  const unpowered =
    counts.pass > 0 &&
    !!fact &&
    (fact.trueEngine === 'None' || (!fact.generatorWired && MEDIA_DELIVERABLES.has(fact.deliverable)));

  // Content-quality judgments: a matching judge's PASS is professional-grade proof for
  // content steps (the thing shape checkers can't see); a judge FAIL condemns the content
  // even when the shape checker passed.
  const allRelevant = verdicts.filter((v) => !fact || v.judge === fact.judge || v.judge === 'human');
  // THE shared rubric filter (`newestRubricVerdicts`, @/lib/judge/rubrics) — the SAME rule the
  // judge→acceptance bridge applies, so /status and the pipeline's own acceptance can't diverge
  // when RUBRIC_VERSION is bumped. Only the newest rubric present speaks: a strict v3 judgment
  // supersedes a lenient v1 one, so an old lenient pass can never keep a cell green.
  const relevant = newestRubricVerdicts(allRelevant);

  // ── Content binding ──────────────────────────────────────────────────────────────────
  // A verdict speaks only for the content it actually judged. THE shared rule is
  // `verdictProvenance` + `CONDEMNING_PROVENANCE` (@/lib/catalog/acceptance/judgeBridge) —
  // the very functions the per-step Acceptance banner applies. Before this, `deriveCell`
  // read neither `contentHash` nor `updatedAt`, so a PASS that judged content since
  // regressed held a cell green forever, and a FAIL that judged content since FIXED held a
  // re-produced step red forever. The map and its own drill-down could disagree, with the
  // map trusting the staler evidence.
  //
  // The binding is taken from the ROW (`judgedContentOfRow`) rather than re-hashed from a
  // blob, so this grades a verdict-only projection and a full row to the same cell — that is
  // what lets /status read the 40×-smaller summary without moving a grade.
  const content = contentByEntity(artifacts);
  const classified = relevant.map((v) => ({ v, p: verdictProvenance(v, content.get(v.entityId)) }));
  // CONDEMNS on `current` (binding confirmed) or `unknown` (nobody can confirm OR refute —
  // a recorded fail is evidence, and dropping it would be the optimistic lie this layer
  // exists to prevent). A `stale` / `superseded` fail does not condemn.
  const condemningFail = classified.find((c) => c.v.verdict === 'fail' && CONDEMNING_PROVENANCE.has(c.p));
  // ELEVATION is deliberately stricter than condemnation: only a CONFIRMED binding proves
  // quality, so a verdict whose provenance cannot be determined degrades to not-proven,
  // never to proven. (`current` also implies the current rubric — see verdictProvenance.)
  const bindingPass = classified.find((c) => c.v.verdict === 'pass' && c.p === 'current');
  // Whatever is on record but did NOT move the grade is still REPORTED, so "unjudged since
  // the re-produce" can never be read as "judged and passed".
  const reported = condemningFail
    ?? bindingPass
    ?? classified.find((c) => c.v.verdict === 'fail')
    ?? classified.find((c) => c.v.verdict === 'pass');
  const judgedFail = condemningFail?.v;
  const judgedPass = bindingPass?.v;
  const judged = reported?.v;
  // Strict green requires a >=90 pass under the current strict rubric, bound to the content
  // on record. A pass under an old rubric, one below 90 (a "competent placeholder"), or one
  // that judged content this step no longer holds, is not green.
  const strictPass = !!bindingPass && bindingPass.v.score >= BANDS.shippable;

  let grade: CellGrade;
  if (counts.pass > 0 && bestPassTier && GATE_TIERS.has(bestPassTier)) grade = 'verified';
  else if (judgedFail && counts.pass > 0) grade = 'attention';
  else if (unpowered) grade = 'unpowered';
  // A strict judge (Opus, reading the actual content) scoring >=90 under rubric v2+ is stronger
  // proof than a shape-only checker — so it verifies the cell as long as SOMETHING was produced
  // (pass/pending/deferred) and the checker didn't FAIL. This lets hardened content whose richer
  // shape the legacy checker can't parse (pending) still show its judge-proven quality, without
  // fabricating verified when nothing was produced at all.
  else if (strictPass && counts.fail === 0 && counts.pass + counts.pending + counts.deferred > 0) grade = 'verified';
  else if (judgedPass && counts.pass > 0) grade = 'trusted';
  else if (counts.pass > 0) grade = TRUSTED_CLASSES.has(engineClass(engine)) ? 'trusted' : 'ungated';
  else if (counts.deferred > 0) grade = 'deferred';
  else if (counts.fail > 0) grade = 'attention';
  else if (counts.pending > 0) grade = 'pending';
  else grade = 'unwired';

  return {
    label,
    engine: fact && fact.trueEngine === 'None' ? 'none' : engine,
    grade,
    tier: bestPassTier ?? tier,
    counts,
    reason,
    judge: fact?.judge,
    auditNote: fact?.note,
    checkerMeaningful: fact?.checkerMeaningful,
    ...(fact && mirrorSupport(fact.deliverable, fact.step) !== 'none'
      ? { browserMirror: mirrorSupport(fact.deliverable, fact.step) }
      : {}),
    ...(judged ? { judged: { verdict: judged.verdict, score: judged.score, model: judged.model, findings: judged.findings, ...(judged.effort ? { effort: judged.effort } : {}), ...(judged.rubricVersion != null ? { rubricVersion: judged.rubricVersion } : {}) } } : {}),
    ...(reported
      ? { judgeAttribution: attribution(reported.v, reported.p, reported === condemningFail || reported === bindingPass) }
      : {}),
  };
}

export interface Swimlane {
  catalogId: string;
  label: string;
  cells: StepCell[];
  /** % of steps at R4+ — gate-proven or shipped. The professional-grade bar.
   *  (Was `verifiedPct`; renamed with the readiness ladder rather than silently
   *  redefined, so no caller can keep reading it as the old grade-only measure.) */
  readyPct: number;
  /** % of steps at R3+ — reviewed or better. (Was `credibleGePct`.) */
  crediblePct: number;
  /** % of steps at R1+ — anything has been produced at all. (Was `wiredPct`.) */
  startedPct: number;
  /** Steps a checker or judge condemned. Off-ladder, so it is a count, not a percent. */
  blockedCount: number;
}

/** Build a swimlane for one pipeline from its step metas + all recorded artifacts. Pure. */
export function buildSwimlane(
  catalogId: string,
  label: string,
  steps: StepMeta[],
  artifacts: ArtifactVerdictRow[],
  verdicts: JudgeVerdict[] = [],
  headless: HeadlessLookup = getHeadlessFact,
): Swimlane {
  const byStep = new Map<string, ArtifactVerdictRow[]>();
  for (const a of artifacts) {
    if (isSyntheticEntity(a.entityId)) continue;
    const list = byStep.get(a.step) ?? [];
    list.push(a);
    byStep.set(a.step, list);
  }
  const verdictsByStep = new Map<string, JudgeVerdict[]>();
  for (const v of verdicts) {
    if (isSyntheticEntity(v.entityId)) continue;
    const list = verdictsByStep.get(v.step) ?? [];
    list.push(v);
    verdictsByStep.set(v.step, list);
  }
  const cells = steps.map((s) => {
    const fact = getStepFact(catalogId, s.label);
    const { engine, source } = resolveEngine(catalogId, s, fact);
    const cell = deriveCell(s.label, engine, byStep.get(s.label) ?? [], fact, verdictsByStep.get(s.label) ?? []);
    cell.engineSource = source;
    const realization = getRealization(catalogId, s.label);
    if (realization) cell.realization = realization;
    return gateHeadless(cell, catalogId, s.label, headless);
  });
  const n = Math.max(cells.length, 1);
  // Lane numbers read the SAME ladder the cells paint, so a lane's headline percentage
  // and the colours under it can never disagree. `waiting`/`blocked` are not rungs, so
  // they are excluded from the "reached" percentages and counted separately.
  const readings = cells.map(readinessOf);
  const reached = readings.filter((r) => r.state === 'reached');
  const pctAtOrAbove = (floor: ReadinessLevel) =>
    Math.round((reached.filter((r) => atOrAbove(r.level, floor)).length / n) * 100);
  return {
    catalogId,
    label,
    cells,
    readyPct: pctAtOrAbove('R4'),
    crediblePct: pctAtOrAbove('R3'),
    startedPct: pctAtOrAbove('R1'),
    blockedCount: readings.filter((r) => r.state === 'blocked').length,
  };
}

/** Sort lanes: most production-ready first, then credible, then alpha — gaps sink
 *  visibly. Pure. */
export function sortLanes(lanes: Swimlane[]): Swimlane[] {
  return [...lanes].sort(
    (a, b) => b.readyPct - a.readyPct || b.crediblePct - a.crediblePct || a.label.localeCompare(b.label),
  );
}
