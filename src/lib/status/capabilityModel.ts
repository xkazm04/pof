/**
 * Capability model — the READ-ONLY "which parts of any game project can our STACK
 * generate at pro quality" lens on /status. Where statusModel grades a specific
 * project instance (one cell per pipeline step), this grades the generation
 * TECHNIQUE per capability class (text-config, 2d-art, 3d-mesh, audio, …): pooling
 * the strict-judge evidence across every project instance to answer "is this class
 * proven, strong, capped, or unproven — and where is the wall".
 *
 * It NEVER touches statusModel grading, the checkers, or any gate. It only reads
 * the same artifacts/verdicts the dashboard already fetches, plus two audited JSONs:
 *   - step-facts.json  — each step's `deliverable` (→ capability class), `trueEngine`
 *                        (→ technique stack), `judge`, `generatorWired`.
 *   - ceiling-facts.json — recorded quality ceilings from the green-loop campaign,
 *                        classed technique / project-data / checker-structural. A
 *                        project-data or checker-structural cell is EXCLUDED from the
 *                        median (it doesn't measure our technique); a technique cell
 *                        stays in and caps the class.
 *
 * Pure: JSON imports + function args only (mirrors statusModel).
 */
import stepFactsJson from './step-facts.json';
import ceilingFactsJson from './ceiling-facts.json';
import { deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact, isSyntheticEntity, type StepFact } from './statusModel';
import type { JudgeVerdict } from './judge-verdicts-db';

/** Minimum rubric version an llm-panel verdict must carry to count as capability
 *  evidence — v3 is the canon-aware strict bar (see judge/rubrics.ts). */
const MIN_PANEL_RUBRIC = 3;
/** Median >= this (with n>=MIN_PROVEN_N) earns `proven`. */
const PROVEN_MEDIAN = 90;
const PROVEN_N = 3;
/** Median in [STRONG_MEDIAN, PROVEN_MEDIAN) earns `strong`. */
const STRONG_MEDIAN = 85;

export type CapabilityProvenance = 'derived-from-project-instances' | 'neutral-benchmark';
export type CapabilityGradeLevel = 'proven' | 'strong' | 'capped' | 'unproven';

export interface CeilingFact {
  catalogId: string;
  step: string;
  entityId?: string;
  ceilingClass: 'technique' | 'project-data' | 'checker-structural';
  note: string;
}

const CEILINGS: CeilingFact[] = (ceilingFactsJson.ceilings as CeilingFact[]) ?? [];
const FACTS: StepFact[] = stepFactsJson.steps as StepFact[];
const EXCLUDE_KINDS = new Set<CeilingFact['ceilingClass']>(['project-data', 'checker-structural']);

/** Map a step's audited `deliverable` to its capability class. Reuses the judge's
 *  finer text/2D split (`deliverableClassOf` promotes flat-HUD 2D to `ui-glyph`);
 *  deliverables with no rubric class (`ue-runtime`, `graph-data`, `vfx-particles`)
 *  pass through verbatim so every step still lands in exactly one class. Text is NOT
 *  sub-split beyond ui-glyph — no cheap finer text partition exists, so all text
 *  steps stay one `text-config` capability. */
export function capabilityClassOf(deliverable: string, catalogId?: string): string {
  return deliverableClassOf(deliverable, catalogId) ?? deliverable;
}

/** Does a ceiling of one of `kinds` cover this exact cell? An entry with no `entityId`
 *  covers every entity of that (catalog, step); an entry WITH one covers only it. */
function ceilingFor(
  catalogId: string,
  step: string,
  entityId: string,
  kinds: ReadonlySet<CeilingFact['ceilingClass']>,
): CeilingFact | undefined {
  return CEILINGS.find(
    (c) =>
      c.catalogId === catalogId &&
      c.step === step &&
      (c.entityId === undefined || c.entityId === entityId) &&
      kinds.has(c.ceilingClass),
  );
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

interface ClassStats {
  engines: Map<string, number>;
  judges: Map<string, number>;
  unwired: number;
  total: number;
}

function bump(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** Static per-class stats derived once from step-facts: technique stack (trueEngine
 *  tallies), dominant judge, and wiring (how many steps have no wired generator / a
 *  `None` true engine). Also the set of every capability class the stack has steps for
 *  — so a class with zero verdicts still surfaces as a row. */
function computeClassStats(): Map<string, ClassStats> {
  const out = new Map<string, ClassStats>();
  for (const f of FACTS) {
    const k = capabilityClassOf(f.deliverable, f.catalogId);
    let s = out.get(k);
    if (!s) {
      s = { engines: new Map(), judges: new Map(), unwired: 0, total: 0 };
      out.set(k, s);
    }
    if (f.trueEngine && f.trueEngine !== 'None') bump(s.engines, f.trueEngine.replace(' (deterministic)', ''));
    bump(s.judges, f.judge);
    s.total += 1;
    if (!f.generatorWired || f.trueEngine === 'None') s.unwired += 1;
  }
  return out;
}

/** Capability classes with a documented TECHNIQUE ceiling (a wall our stack can't
 *  cross by re-authoring). Resolved from ceiling-facts via each cell's deliverable. */
function cappedClasses(): Set<string> {
  const out = new Set<string>();
  for (const c of CEILINGS) {
    if (c.ceilingClass !== 'technique') continue;
    const f = getStepFact(c.catalogId, c.step);
    if (f) out.add(capabilityClassOf(f.deliverable, c.catalogId));
  }
  return out;
}

function topKeys(m: Map<string, number>, k: number): string[] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name]) => name);
}

const CLASS_LABEL: Record<string, string> = {
  'text-config': 'Text & Systems Design',
  '2d-art': '2D Art (painterly)',
  'ui-glyph': 'UI / HUD Icons',
  '3d-mesh': '3D Meshes',
  animation: 'Animation',
  audio: 'Audio',
  'ue-runtime': 'UE Runtime (gameplay)',
  'graph-data': 'Graph / Structured Data',
  'vfx-particles': 'VFX / Particles',
};

/** Curated gap statement per class, derived from the known walls (green-loop ledger +
 *  fleet audit). A class with no curated line falls back to a grade-derived sentence. */
const GAP: Record<string, string> = {
  'text-config':
    'Adversarial systems-spec ceiling ~85-89: the strict canon-aware judge escalates polish demands and re-flags plausibility/arithmetic coin-flips. Project-data (locked seeds, canon collisions) and checker-forced numbers are excluded, so this measures pure writing technique.',
  '2d-art':
    'Model-capability wall ~70 on materialRendering / edgeQuality — generated 2D reads as color-blocked rather than painterly surface, and there is no gate beyond the VLM.',
  'ui-glyph':
    'Flat HUD-icon craft clears higher than painterly 2D (judged on clarity/legibility), but stays model-capped on edge crispness at small scale.',
  '3d-mesh':
    'Generated meshes are placeholder-plus (Tripo / TripoSR). No llm-panel judge exists for the class — pro quality is provable only by 3D-mesh VLM/human review, which is largely unrun.',
  animation:
    'No llm-panel verdicts — graded by L3/L4 runtime gates, see project map. Output is authored/retargeted motion, not hand-keyed AAA locomotion.',
  audio:
    'SFX/ambient stems generate via ElevenLabs; there is NO music-generation engine, so scored/adaptive music is unproven. Audio is checker-terminal, not text-judgeable by the panel.',
  'ue-runtime':
    'Graded by L3/L4 gates, see project map — not the llm-panel lens. Wiring is real (UE C++/Python) but pro-quality proof lives in the runtime/visual gates, outside this view.',
  'graph-data':
    'Structural graph output (e.g. dialogue branches) is shape-checked, not content-judged at pro quality by the panel.',
  'vfx-particles':
    'No wired generator and no llm-panel judge — VFX is hand-specced text/params, unproven as shippable particle craft.',
};

export interface CapabilityRow {
  klass: string;
  label: string;
  grade: CapabilityGradeLevel;
  /** Median of INCLUDED (non-excluded) strict-panel scores; null when no evidence. */
  median: number | null;
  /** Evidence count — included cells feeding the median. */
  n: number;
  /** Cells excluded as project-data / checker-structural. */
  excluded: number;
  /** Dominant true engine(s) powering the class (technique stack). */
  techniqueStack: string[];
  /** Dominant judge class for the class's steps. */
  judgeClass: string;
  /** A documented technique wall exists for this class. */
  cappedByTechnique: boolean;
  gapStatement: string;
  provenance: CapabilityProvenance;
}

function gradeOf(med: number | null, n: number, cappedByTechnique: boolean): CapabilityGradeLevel {
  // No strict-panel evidence → unproven (also covers classes whose steps are
  // predominantly generatorWired:false / trueEngine None — they never accrue verdicts).
  if (n === 0) return 'unproven';
  // A documented technique wall caps the class BEFORE `proven` — the conservative
  // reading (a high sample median against a known wall is favorable variance, which the
  // green-loop ledger repeatedly warns about). Counts against capability, never inflates.
  if (cappedByTechnique) return 'capped';
  if (med !== null && med >= PROVEN_MEDIAN && n >= PROVEN_N) return 'proven';
  if (med !== null && med >= STRONG_MEDIAN) return 'strong';
  return 'capped';
}

const GRADE_RANK: Record<CapabilityGradeLevel, number> = { proven: 0, strong: 1, capped: 2, unproven: 3 };

/**
 * Build one capability row per class from the strict-panel verdicts the dashboard
 * fetched. Pure — no I/O. Steps:
 *  1. Keep the latest rubric>=3 llm-panel verdict per (catalog|entity|step), skipping
 *     synthetic fixtures.
 *  2. Map each surviving cell to its capability class; EXCLUDE project-data /
 *     checker-structural cells (count them, don't score them).
 *  3. Per class: median + n of the included scores, excluded count, and a grade from
 *     the ladder (proven / strong / capped / unproven), with technique stack + gap.
 */
export function buildCapabilityRows(verdicts: JudgeVerdict[]): CapabilityRow[] {
  const latest = new Map<string, JudgeVerdict>();
  for (const v of verdicts) {
    if (v.judge !== 'llm-panel') continue;
    if ((v.rubricVersion ?? 1) < MIN_PANEL_RUBRIC) continue;
    if (isSyntheticEntity(v.entityId)) continue;
    const key = `${v.catalogId}|${v.entityId}|${v.step}`;
    const prev = latest.get(key);
    if (!prev || (v.judgedAt ?? '') > (prev.judgedAt ?? '')) latest.set(key, v);
  }

  const scores = new Map<string, number[]>();
  const excluded = new Map<string, number>();
  for (const v of latest.values()) {
    const fact = getStepFact(v.catalogId, v.step);
    if (!fact) continue;
    const klass = capabilityClassOf(fact.deliverable, v.catalogId);
    if (ceilingFor(v.catalogId, v.step, v.entityId, EXCLUDE_KINDS)) {
      excluded.set(klass, (excluded.get(klass) ?? 0) + 1);
      continue;
    }
    const list = scores.get(klass) ?? [];
    list.push(v.score);
    scores.set(klass, list);
  }

  const stats = computeClassStats();
  const capped = cappedClasses();
  const classes = new Set<string>([...stats.keys(), ...scores.keys(), ...excluded.keys()]);

  const rows: CapabilityRow[] = [];
  for (const klass of classes) {
    const list = scores.get(klass) ?? [];
    const n = list.length;
    const med = median(list);
    const cappedByTechnique = capped.has(klass);
    const grade = gradeOf(med, n, cappedByTechnique);
    const s = stats.get(klass);
    const techniqueStack = s ? topKeys(s.engines, 2) : [];
    const judgeClass = s ? topKeys(s.judges, 1)[0] ?? 'none' : 'none';
    const gapStatement =
      GAP[klass] ??
      (n === 0
        ? 'No strict-panel evidence recorded for this class yet.'
        : `Graded ${grade} from ${n} judged cells (median ${med ?? '—'}); no documented technique wall.`);
    rows.push({
      klass,
      label: CLASS_LABEL[klass] ?? klass,
      grade,
      median: med,
      n,
      excluded: excluded.get(klass) ?? 0,
      techniqueStack: techniqueStack.length ? techniqueStack : ['—'],
      judgeClass,
      cappedByTechnique,
      gapStatement,
      provenance: 'derived-from-project-instances',
    });
  }

  return rows.sort(
    (a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || (b.median ?? -1) - (a.median ?? -1) || a.label.localeCompare(b.label),
  );
}
