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
 *   - capability-benchmarks.json (Phase 2) — neutral-brief benchmark of the TECHNIQUE
 *                        STACK, canon-FREE strict-judged. When a class has scored
 *                        benchmark briefs the neutral median DRIVES its grade (provenance
 *                        'neutral-benchmark', project-portable) and the instance median is
 *                        kept visible as a secondary field; deferred rows only surface a note.
 *
 * Pure: JSON imports + function args only (mirrors statusModel).
 */
import stepFactsJson from './step-facts.json';
import ceilingFactsJson from './ceiling-facts.json';
import capabilityBenchmarksJson from './capability-benchmarks.json';
import { deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact, isSyntheticEntity, type StepFact } from './statusModel';
import { verdictProvenance, judgedContentOf, type JudgedContent } from '@/lib/catalog/acceptance/judgeBridge';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { JudgeVerdict } from './judge-verdicts-db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/** Minimum rubric version an llm-panel verdict must carry to count as capability
 *  evidence — v3 is the canon-aware strict bar (see judge/rubrics.ts). VLM verdicts
 *  predate the rubric column (Qwen vision tier) and human verdicts carry no rubric,
 *  so neither is rubric-gated — see `latestVerdictsByJudge`. */
const MIN_PANEL_RUBRIC = 3;
/** Median >= this (with n>=MIN_PROVEN_N) earns `proven` (score-judged classes). */
const PROVEN_MEDIAN = 90;
const PROVEN_N = 3;
/** Median in [STRONG_MEDIAN, PROVEN_MEDIAN) earns `strong`. */
const STRONG_MEDIAN = 85;

/** Gate-judged (ue-test) ladder — conservative, empirical proof from the L3/L4 runner.
 *  `proven` demands a high pass rate AND real volume (a single passing gate isn't a
 *  proven runtime capability); `strong` a majority with moderate volume; anything below
 *  that with declared gates is `capped` (the gap names the deferred/failing count). */
const GATE_PROVEN_RATE = 0.9;
const GATE_PROVEN_N = 10;
const GATE_STRONG_RATE = 0.7;
const GATE_STRONG_N = 5;

const SCORE_JUDGES = new Set<StepFact['judge']>(['llm-panel', 'vlm']);
const GATE_TIERS = new Set(['L3', 'L4']);

export type CapabilityProvenance = 'derived-from-project-instances' | 'neutral-benchmark';
export type CapabilityGradeLevel = 'proven' | 'strong' | 'capped' | 'unproven';
/** Which evidence stream fed the row's grade — the honest sub-label under provenance.
 *  `mixed` = a class whose cells split across llm-panel and vlm steps (each cell scored
 *  by its own step's judge). `none` = a class with no judgeable evidence stream at all. */
export type CapabilityStream = 'llm-panel' | 'vlm' | 'gates' | 'human' | 'none' | 'mixed';
/** Per-class evidence mode, resolved from the class's dominant audited judge (excluding
 *  `none`): score-judged (median ladder), gate-judged (L3/L4 pass-rate), or human/none. */
type EvidenceMode = 'score' | 'gate' | 'human-none';

function modeOfJudge(judge: string): EvidenceMode {
  if (judge === 'ue-test') return 'gate';
  if (judge === 'llm-panel' || judge === 'vlm') return 'score';
  return 'human-none'; // human | none
}

/** Historical Qwen-VL verdicts recorded 2D/3D/icon craft on the raw 0-10 scale before the
 *  scores were moved onto the 0-100 axis the llm-panel ladder uses. Current stored rows are
 *  already 0-100 (their values are not all multiples of 10), so this only rescues a genuinely
 *  legacy 0-10 row; the `<=10` boundary is the conservative cut (a true 10/100 vlm pass — a
 *  near-worst image — is implausible, so treating <=10 as the 0-10 scale is safe). */
function normalizeVlmScore(score: number): number {
  return score <= 10 ? score * 10 : score;
}

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

/** One neutral-benchmark result row (Phase 2) — the TECHNIQUE STACK run on a canon-FREE brief,
 *  strict-judged WITHOUT canon/sibling context, median-of-3. A scored row (numeric `score`) makes
 *  its class project-portable — graded from the benchmark median instead of project instances. A
 *  `deferred` row carries an honest note and NO score (its class stays instance-graded; the note is
 *  surfaced in the gap statement). Written by scripts/capability-benchmark.ts. */
export interface CapabilityBenchmarkRow {
  class: string;
  briefId: string | null;
  score: number | null;
  draws?: number[];
  model?: string;
  effort?: string;
  engine?: string;
  styleDna?: boolean;
  deferred?: boolean;
  note?: string;
}

export const CAPABILITY_BENCHMARKS: CapabilityBenchmarkRow[] =
  (capabilityBenchmarksJson.rows as CapabilityBenchmarkRow[]) ?? [];

interface BenchEvidence {
  /** Numeric benchmark medians, one per scored brief. */
  scores: number[];
  /** Honest notes (deferred rationale, or a scored row's benchmark-unavailable reason). */
  notes: string[];
}

/** Pool benchmark rows by capability class into scored medians + notes. Pure. */
function benchmarkByClass(rows: CapabilityBenchmarkRow[]): Map<string, BenchEvidence> {
  const out = new Map<string, BenchEvidence>();
  for (const r of rows) {
    let e = out.get(r.class);
    if (!e) { e = { scores: [], notes: [] }; out.set(r.class, e); }
    if (typeof r.score === 'number') e.scores.push(r.score);
    if (r.note) e.notes.push(r.note);
  }
  return out;
}

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
  /** Median of INCLUDED (non-excluded) judged scores; null for gate-judged rows (they
   *  report gatesPassed/gatesDeclared instead) and for classes with no score evidence. */
  median: number | null;
  /** Evidence count — included cells feeding the median (0 for gate rows). */
  n: number;
  /** Cells excluded as project-data / checker-structural. */
  excluded: number;
  /** Gate-judged rows only: L3/L4 gates that passed vs declared (pass + deferred + fail). */
  gatesPassed?: number;
  gatesDeclared?: number;
  /** Which evidence stream fed the grade (llm-panel / vlm / gates / human / mixed / none). */
  stream: CapabilityStream;
  /** Dominant true engine(s) powering the class (technique stack). */
  techniqueStack: string[];
  /** Dominant judge class for the class's steps (excluding `none`). */
  judgeClass: string;
  /** A documented technique wall exists for this class (score/human rows only). */
  cappedByTechnique: boolean;
  gapStatement: string;
  provenance: CapabilityProvenance;
  /** Secondary project-instance median, kept visible when a NEUTRAL benchmark drives the grade
   *  (provenance 'neutral-benchmark') so the view can show "benchmark 84 · project 82". Null when
   *  the instance stream has no included score, undefined when the row is instance-graded. */
  projectMedian?: number | null;
}

function gradeScore(med: number | null, n: number, cappedByTechnique: boolean): CapabilityGradeLevel {
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

function gradeGate(passed: number, declared: number): CapabilityGradeLevel {
  if (declared === 0) return 'unproven';
  const rate = passed / declared;
  if (rate >= GATE_PROVEN_RATE && passed >= GATE_PROVEN_N) return 'proven';
  if (rate >= GATE_STRONG_RATE && passed >= GATE_STRONG_N) return 'strong';
  return 'capped';
}

const GRADE_RANK: Record<CapabilityGradeLevel, number> = { proven: 0, strong: 1, capped: 2, unproven: 3 };

/** Dominant judge for a class EXCLUDING `none` (an absent judge isn't an evidence stream).
 *  Resolves the class's evidence mode. Falls back to `none` when every step is un-judged. */
function dominantJudge(judges: Map<string, number>): string {
  let best = 'none';
  let bestN = -1;
  for (const [j, c] of judges) {
    if (j === 'none') continue;
    if (c > bestN) {
      best = j;
      bestN = c;
    }
  }
  return best;
}

/**
 * The CONTENT axis of the shared provenance rule, asked with the rubric axis neutralized.
 *
 * `verdictProvenance` checks rubric FIRST and returns `superseded` before it ever compares
 * hashes — correct for acceptance, where superseded and stale have the same consequence (do
 * not condemn). Here they do NOT: this module governs its own rubric policy (`MIN_PANEL_RUBRIC`,
 * with vlm/human deliberately un-gated because they predate the column), so asking the raw
 * function would have every vlm verdict answer `superseded` and the staleness check would be
 * dead code across the entire 2d-art / 3d-mesh / ui-glyph evidence base.
 *
 * Stamping the current rubric on the COPY isolates the one question this module is asking —
 * "does this verdict still bind to the content on record?" — while keeping ONE staleness
 * implementation. Nothing is written back; the verdict itself is untouched.
 */
function contentBinding(v: JudgeVerdict, content: JudgedContent | undefined) {
  return verdictProvenance({ ...v, rubricVersion: RUBRIC_VERSION }, content);
}

/**
 * Latest verdict per (judge, catalog|entity|step), skipping synthetic fixtures. llm-panel
 * verdicts must carry rubric>=3 (the strict canon-aware bar); vlm/human verdicts are NOT
 * rubric-gated (both predate the rubric column). Each judge stream is kept independently so
 * a cell can be scored by its OWN step's audited judge class.
 *
 * ── Content binding ────────────────────────────────────────────────────────────
 * A verdict is dropped when it is `stale`: its recorded `contentHash` disagrees with what
 * the step holds now, or (legacy, hash-less) it was judged BEFORE the artifact's last write.
 * Such a verdict demonstrably scored content that no longer exists, so it measures nothing
 * about current capability — it used to sit in the median regardless, exactly the gap
 * `deriveCell` had. THE shared rule (`verdictProvenance`, @/lib/catalog/acceptance) decides,
 * never a second staleness implementation.
 *
 * Only `stale` is dropped. `superseded` is a RUBRIC judgment and this module already states
 * its own rubric policy above (`MIN_PANEL_RUBRIC`, and vlm/human deliberately un-gated);
 * re-deciding it here would silently retire every pre-rubric-column vlm verdict — the whole
 * 2d-art / 3d-mesh / ui-glyph evidence base — on a question this function does not own.
 * `unknown` (no binding recorded, or one from a superseded hash scheme) is kept for the same
 * reason acceptance keeps it: it is real evidence nobody can refute, and it is labelled.
 * Filtering happens BEFORE "latest wins", so a step whose newest verdict went stale falls
 * back to an older BINDING one instead of losing its evidence entirely.
 *
 * See {@link contentBinding} for why the shared rule is asked with the rubric axis neutralized.
 */
function latestVerdictsByJudge(
  verdicts: JudgeVerdict[],
  content: (v: JudgeVerdict) => JudgedContent | undefined = () => undefined,
): Map<string, JudgeVerdict> {
  const latest = new Map<string, JudgeVerdict>();
  for (const v of verdicts) {
    if (isSyntheticEntity(v.entityId)) continue;
    if (v.judge === 'llm-panel' && (v.rubricVersion ?? 1) < MIN_PANEL_RUBRIC) continue;
    if (contentBinding(v, content(v)) === 'stale') continue;
    const key = `${v.judge}|${v.catalogId}|${v.entityId}|${v.step}`;
    const prev = latest.get(key);
    if (!prev || (v.judgedAt ?? '') > (prev.judgedAt ?? '')) latest.set(key, v);
  }
  return latest;
}

interface ClassEvidence {
  score: number[];
  scoreStreams: Set<'llm-panel' | 'vlm'>;
  human: number[];
  excluded: number;
  gatePassed: number;
  gateDeclared: number;
}

function emptyEvidence(): ClassEvidence {
  return { score: [], scoreStreams: new Set(), human: [], excluded: 0, gatePassed: 0, gateDeclared: 0 };
}

/**
 * Build one capability row per class. Each class draws from the evidence stream its steps'
 * AUDITED `judge` class demands (step-facts), never a new judgment. Pure — no I/O.
 *
 *  - score-judged (llm-panel / vlm): median of the latest matching-judge verdict per cell
 *    (each cell scored by its OWN step's judge, so a mixed class aggregates both streams),
 *    minus project-data / checker-structural cells; graded on the median ladder.
 *  - gate-judged (ue-test → ue-runtime / animation): declared L3/L4 gate artifacts —
 *    passRate = gatesPassed/gatesDeclared (declared = pass + deferred + fail; deferred =
 *    declared-not-run) — graded on the conservative gate ladder, shown as "N/M gates pass".
 *  - human/none (audio, vfx): unproven unless human verdicts exist for the human-judged cells.
 */
export function buildCapabilityRows(
  verdicts: JudgeVerdict[],
  artifacts: PipelineArtifact[] = [],
  benchmarks: CapabilityBenchmarkRow[] = CAPABILITY_BENCHMARKS,
): CapabilityRow[] {
  const ev = new Map<string, ClassEvidence>();
  const get = (k: string): ClassEvidence => {
    let e = ev.get(k);
    if (!e) {
      e = emptyEvidence();
      ev.set(k, e);
    }
    return e;
  };

  // The artifacts this view already receives ARE the content each verdict is checked against
  // (same (catalog, entity, step) key), so the binding costs no new input.
  const byCell = new Map(artifacts.map((a) => [`${a.catalogId}|${a.entityId}|${a.step}`, a]));
  const contentOf = (v: JudgeVerdict): JudgedContent | undefined => {
    const a = byCell.get(`${v.catalogId}|${v.entityId}|${v.step}`);
    return a ? judgedContentOf(a.data, a.updatedAt) : undefined;
  };

  for (const v of latestVerdictsByJudge(verdicts, contentOf).values()) {
    const fact = getStepFact(v.catalogId, v.step);
    if (!fact || v.judge !== fact.judge) continue; // score a cell only by its OWN step's judge
    const klass = capabilityClassOf(fact.deliverable, v.catalogId);
    if (v.judge === 'human') {
      get(klass).human.push(v.score);
      continue;
    }
    if (!SCORE_JUDGES.has(v.judge)) continue;
    if (ceilingFor(v.catalogId, v.step, v.entityId, EXCLUDE_KINDS)) {
      get(klass).excluded += 1;
      continue;
    }
    const e = get(klass);
    e.score.push(v.judge === 'vlm' ? normalizeVlmScore(v.score) : v.score);
    e.scoreStreams.add(v.judge);
  }

  for (const a of artifacts) {
    if (isSyntheticEntity(a.entityId) || !a.tier || !GATE_TIERS.has(a.tier)) continue;
    const fact = getStepFact(a.catalogId, a.step);
    if (!fact) continue;
    const e = get(capabilityClassOf(fact.deliverable, a.catalogId));
    if (a.status === 'pass') {
      e.gatePassed += 1;
      e.gateDeclared += 1;
    } else if (a.status === 'deferred' || a.status === 'fail') {
      e.gateDeclared += 1; // declared but unproven (deferred = not-run, fail = failing)
    }
  }

  const stats = computeClassStats();
  const capped = cappedClasses();
  const bench = benchmarkByClass(benchmarks);
  const classes = new Set<string>([...stats.keys(), ...ev.keys(), ...bench.keys()]);

  const rows = [...classes].map((klass) =>
    applyBenchmark(buildRow(klass, ev.get(klass) ?? emptyEvidence(), stats.get(klass), capped.has(klass)), bench.get(klass)));
  return rows.sort(
    (a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || (b.median ?? -1) - (a.median ?? -1) || a.label.localeCompare(b.label),
  );
}

/** Assemble one row from its class's pooled evidence + static stats. Pure. */
function buildRow(klass: string, e: ClassEvidence, s: ClassStats | undefined, hasTechniqueCap: boolean): CapabilityRow {
  const judgeClass = s ? dominantJudge(s.judges) : 'none';
  const mode = modeOfJudge(judgeClass);
  const techniqueStack = s ? topKeys(s.engines, 2) : [];
  const base = {
    klass,
    label: CLASS_LABEL[klass] ?? klass,
    excluded: e.excluded,
    techniqueStack: techniqueStack.length ? techniqueStack : ['—'],
    judgeClass,
    provenance: 'derived-from-project-instances' as const,
  };

  if (mode === 'gate') {
    const grade = gradeGate(e.gatePassed, e.gateDeclared);
    const unproven = e.gateDeclared - e.gatePassed;
    const gapStatement =
      e.gateDeclared === 0
        ? GAP[klass] ?? 'No declared L3/L4 gates recorded for this class yet.'
        : `${e.gatePassed}/${e.gateDeclared} declared L3/L4 gates pass — ${unproven} still deferred or failing. Runtime capability is provable only by these gates, not the panel.`;
    return { ...base, grade, median: null, n: 0, gatesPassed: e.gatePassed, gatesDeclared: e.gateDeclared, stream: 'gates', cappedByTechnique: false, gapStatement };
  }

  if (mode === 'human-none') {
    const n = e.human.length;
    const med = median(e.human);
    const grade = n === 0 ? 'unproven' : gradeScore(med, n, hasTechniqueCap);
    const gapStatement = GAP[klass] ?? (n === 0 ? 'No human review recorded for this class yet.' : `Graded ${grade} from ${n} human verdicts (median ${med ?? '—'}).`);
    return { ...base, grade, median: med, n, stream: n === 0 ? 'none' : 'human', cappedByTechnique: hasTechniqueCap && n > 0, gapStatement };
  }

  // score mode
  const n = e.score.length;
  const med = median(e.score);
  const grade = gradeScore(med, n, hasTechniqueCap);
  const stream: CapabilityStream = e.scoreStreams.size > 1 ? 'mixed' : (e.scoreStreams.values().next().value ?? (judgeClass === 'vlm' ? 'vlm' : 'llm-panel'));
  const gapStatement =
    GAP[klass] ??
    (n === 0 ? 'No strict-judge evidence recorded for this class yet.' : `Graded ${grade} from ${n} judged cells (median ${med ?? '—'}); no documented technique wall.`);
  return { ...base, grade, median: med, n, stream, cappedByTechnique: hasTechniqueCap, gapStatement };
}

/**
 * Overlay the neutral benchmark (Phase 2) onto an instance-derived row. When the class has SCORED
 * benchmark briefs the neutral median DRIVES the grade (project-portable — provenance flips to
 * 'neutral-benchmark') and the instance median is kept visible as `projectMedian`. The documented
 * project technique cap is NOT re-applied: the neutral canon-free score IS the direct technique
 * measurement, so double-penalizing with a recorded project ceiling would understate portable
 * capability (the flag stays visible for context). A benchmark row with only NOTES (deferred /
 * unavailable, no score) leaves the grade untouched and just surfaces the note in the gap
 * statement. Pure. */
function applyBenchmark(instance: CapabilityRow, b: BenchEvidence | undefined): CapabilityRow {
  if (!b) return instance;
  const noteSuffix = b.notes.length ? ` Neutral benchmark: ${b.notes.join(' ')}` : '';

  if (b.scores.length > 0) {
    const benchMed = median(b.scores);
    const grade = gradeScore(benchMed, b.scores.length, false);
    const gapStatement =
      `Graded from the canon-free neutral benchmark: median ${benchMed} across ${b.scores.length} `
      + `brief${b.scores.length === 1 ? '' : 's'} (project-instance median ${instance.median ?? '—'}). `
      + `Answers whether the stack can ship this class for ANY project, not just PoF.${noteSuffix} `
      + instance.gapStatement;
    return {
      ...instance,
      grade,
      median: benchMed,
      n: b.scores.length,
      projectMedian: instance.median,
      provenance: 'neutral-benchmark',
      gapStatement: gapStatement.trim(),
    };
  }

  // Notes-only (deferred / unavailable): keep the instance grade, surface the honest note.
  return noteSuffix ? { ...instance, gapStatement: `${instance.gapStatement}${noteSuffix}` } : instance;
}
