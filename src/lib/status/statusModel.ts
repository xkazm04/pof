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
import { BANDS, RUBRIC_VERSION } from '@/lib/judge/rubrics';

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
  // Prefer the NEWEST rubric — a strict v2 judgment supersedes a lenient v1 one for the same
  // step, so an old lenient pass can never keep a cell green after the strict rubric ships.
  const newestRubric = allRelevant.reduce((mx, v) => Math.max(mx, v.rubricVersion ?? 1), 0);
  const relevant = allRelevant.filter((v) => (v.rubricVersion ?? 1) === newestRubric);
  const judgedFail = relevant.find((v) => v.verdict === 'fail');
  const judgedPass = relevant.find((v) => v.verdict === 'pass');
  const judged = judgedFail ?? judgedPass;
  // Strict green requires a >=90 pass under the current strict rubric (v2+). A pass under an
  // old rubric, or a v2 pass below 90 (a "competent placeholder"), is trusted-amber, not green.
  const strictPass = !!judgedPass && (judgedPass.rubricVersion ?? 1) >= RUBRIC_VERSION && judgedPass.score >= BANDS.shippable;

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
    ...(judged ? { judged: { verdict: judged.verdict, score: judged.score, model: judged.model, findings: judged.findings, ...(judged.effort ? { effort: judged.effort } : {}), ...(judged.rubricVersion != null ? { rubricVersion: judged.rubricVersion } : {}) } } : {}),
  };
}

export interface Swimlane {
  catalogId: string;
  label: string;
  cells: StepCell[];
  /** % of steps with a GATE-PROVEN pass (the professional-grade bar). */
  verifiedPct: number;
  /** % of steps at verified or trusted. */
  credibleGePct: number;
  /** % of steps with any artifact at all. */
  wiredPct: number;
}

/** Build a swimlane for one pipeline from its step metas + all recorded artifacts. Pure. */
export function buildSwimlane(
  catalogId: string,
  label: string,
  steps: StepMeta[],
  artifacts: PipelineArtifact[],
  verdicts: JudgeVerdict[] = [],
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
    return deriveCell(s.label, engine, byStep.get(s.label) ?? [], fact, verdictsByStep.get(s.label) ?? []);
  });
  const n = Math.max(cells.length, 1);
  const verified = cells.filter((c) => c.grade === 'verified').length;
  const credible = cells.filter((c) => c.grade === 'verified' || c.grade === 'trusted').length;
  const wired = cells.filter((c) => c.grade !== 'unwired').length;
  return {
    catalogId,
    label,
    cells,
    verifiedPct: Math.round((verified / n) * 100),
    credibleGePct: Math.round((credible / n) * 100),
    wiredPct: Math.round((wired / n) * 100),
  };
}

/** Sort lanes: gate-proven first, then credible, then alpha — gaps sink visibly. Pure. */
export function sortLanes(lanes: Swimlane[]): Swimlane[] {
  return [...lanes].sort(
    (a, b) => b.verifiedPct - a.verifiedPct || b.credibleGePct - a.credibleGePct || a.label.localeCompare(b.label),
  );
}
