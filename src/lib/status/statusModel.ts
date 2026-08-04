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
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from './judge-verdicts-db';
import stepFactsJson from './step-facts.json';
import headlessCoverageJson from './headless-coverage.json';
import { BANDS, newestRubricVerdicts, isCurrentRubric } from '@/lib/judge/rubrics';
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

export type EngineClass = 'llm' | 'gen2d' | 'gen3d' | 'audio' | 'runtime' | 'tooling' | 'code' | 'human';

/** Engine-name → credibility class. LLM text/code/human-selection scale to quality;
 *  generative media and unproven runtime claims need a real gate. */
export const ENGINE_CLASS: Record<string, EngineClass> = {
  Claude: 'llm',
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
};

/** Classes whose L0–L2 pass is credible without a gate. */
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

/** Resolve the engine powering a step: explicit StepSpec.engine wins, else a
 *  heuristic over catalog + archetype + label. Pure. */
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
  return 'Claude';
}

export function engineClass(engine: string): EngineClass {
  return ENGINE_CLASS[engine] ?? 'llm';
}

export interface StepCell {
  label: string;
  engine: string;
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
  /** Dual execution: the step class also runs in the browser preview ('direct'/'partial').
   *  Absent when there is no browser path (incl. the ue-runtime moat). */
  browserMirror?: MirrorSupport;
  /** Dual-execution EVIDENCE from the per-pipeline review: did this step's output
   *  actually run in the Browser / UE? Absent until the pipeline is reviewed. */
  realization?: StepRealization;
}

const GATE_TIERS = new Set(['L3', 'L4']);

/** Derive one cell from every artifact recorded for that step label, cross-examined
 *  against the audited step fact and any content-quality judge verdicts. Pure. */
export function deriveCell(
  label: string,
  engine: string,
  artifacts: PipelineArtifact[],
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
  const judgedFail = relevant.find((v) => v.verdict === 'fail');
  const judgedPass = relevant.find((v) => v.verdict === 'pass');
  const judged = judgedFail ?? judgedPass;
  // Strict green requires a >=90 pass under the current strict rubric (v2+). A pass under an
  // old rubric, or a v2 pass below 90 (a "competent placeholder"), is trusted-amber, not green.
  const strictPass = !!judgedPass && isCurrentRubric(judgedPass) && judgedPass.score >= BANDS.shippable;

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
  artifacts: PipelineArtifact[],
  verdicts: JudgeVerdict[] = [],
  headless: HeadlessLookup = getHeadlessFact,
): Swimlane {
  const byStep = new Map<string, PipelineArtifact[]>();
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
    const engine = fact?.trueEngine && fact.trueEngine !== 'None'
      ? fact.trueEngine.replace(' (deterministic)', '')
      : inferEngine(catalogId, s);
    const cell = deriveCell(s.label, engine, byStep.get(s.label) ?? [], fact, verdictsByStep.get(s.label) ?? []);
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
