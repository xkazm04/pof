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

export type CellGrade = 'verified' | 'trusted' | 'ungated' | 'deferred' | 'attention' | 'pending' | 'unwired';

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
}

const GATE_TIERS = new Set(['L3', 'L4']);

/** Derive one cell from every artifact recorded for that step label. Pure. */
export function deriveCell(label: string, engine: string, artifacts: PipelineArtifact[]): StepCell {
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

  let grade: CellGrade;
  if (counts.pass > 0 && bestPassTier && GATE_TIERS.has(bestPassTier)) grade = 'verified';
  else if (counts.pass > 0) grade = TRUSTED_CLASSES.has(engineClass(engine)) ? 'trusted' : 'ungated';
  else if (counts.deferred > 0) grade = 'deferred';
  else if (counts.fail > 0) grade = 'attention';
  else if (counts.pending > 0) grade = 'pending';
  else grade = 'unwired';

  return { label, engine, grade, tier: bestPassTier ?? tier, counts, reason };
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
): Swimlane {
  const byStep = new Map<string, PipelineArtifact[]>();
  for (const a of artifacts) {
    const list = byStep.get(a.step) ?? [];
    list.push(a);
    byStep.set(a.step, list);
  }
  const cells = steps.map((s) => deriveCell(s.label, inferEngine(catalogId, s), byStep.get(s.label) ?? []));
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
