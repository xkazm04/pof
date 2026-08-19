/**
 * Mesh critique — Tier-1 (free, local, deterministic) quality gate for a generated 3D
 * mesh. The asset analog of the experiment lab's behavioralVerdict: trimesh emits
 * structural metrics (scripts/visual-gen/pof_mesh_critique.py), `scoreMesh` turns them
 * into a pass/warn/fail scorecard with reasons. No model, no cost. A render→CLIP
 * similarity tier (and an optional local VLM) can stack on top later.
 *
 * Pure cores (parse/score) + an injectable spawn seam, same pattern as the runner.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gradeFaceBudget, type BudgetGrade, type BudgetRequest } from './face-budget';
import { gradeWorldScale, type ScaleGrade, type SizeRequest } from './world-scale';

export interface MeshMetrics {
  verts: number;
  faces: number;
  watertight: boolean;
  windingConsistent: boolean;
  components: number;
  euler: number;
  bbox: [number, number, number];
  volume: number | null;
  area: number;
  degenerateFaces: number;
  /**
   * Faces per connected component, largest first. Absent when the critique script
   * predates the histogram — never defaulted to `[]`, which would read as "measured,
   * and there are none".
   */
  componentFaces?: number[];
  /** Components the capped histogram left out (each no larger than the smallest kept). */
  componentFacesOmitted?: number;
}

/** Parse the `POF_CRITIQUE_*` marker block into typed metrics. Pure. */
export function parseCritiqueMetrics(stdout: string): { ok: boolean; metrics?: MeshMetrics; error?: string } {
  const get = (k: string): string | undefined => {
    const m = stdout.match(new RegExp(`^POF_CRITIQUE_${k}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };
  const error = get('ERROR');
  if (error) return { ok: false, error };
  const verts = get('VERTS');
  if (!get('DONE') || verts === undefined) return { ok: false, error: 'no critique markers in output' };
  const bbox = (get('BBOX') ?? '0,0,0').split(',').map(Number);
  const vol = get('VOLUME');
  const compFaces = get('COMPONENT_FACES');
  return {
    ok: true,
    metrics: {
      verts: Number(verts),
      faces: Number(get('FACES') ?? 0),
      watertight: get('WATERTIGHT') === '1',
      windingConsistent: get('WINDING_CONSISTENT') === '1',
      components: Number(get('COMPONENTS') ?? 1),
      euler: Number(get('EULER') ?? 0),
      bbox: [bbox[0] ?? 0, bbox[1] ?? 0, bbox[2] ?? 0],
      volume: vol && vol !== 'nan' ? Number(vol) : null,
      area: Number(get('AREA') ?? 0),
      degenerateFaces: Number(get('DEGENERATE_FACES') ?? 0),
      componentFaces: compFaces
        ? compFaces.split(',').map(Number).filter((n) => Number.isFinite(n))
        : undefined,
      componentFacesOmitted: get('COMPONENT_FACES_OMITTED') !== undefined
        ? Number(get('COMPONENT_FACES_OMITTED'))
        : undefined,
    },
  };
}

/** Below this share of the total faces a component is a speck, not a body part. */
export const FLOATER_FACE_SHARE = 0.005;
/** …and never call something a part on face share alone when it is this tiny. */
export const FLOATER_MIN_FACES = 8;
/** Separable shells a head needs before expression work is even attempted. */
export const FACE_RIG_MIN_SHELLS = 4;

export interface ComponentSplit {
  /** False when the script emitted no histogram — callers must not infer from counts. */
  measured: boolean;
  parts: number;
  floaters: number;
  floaterFaces: number;
}

/**
 * Split connected components into real parts and specks.
 *
 * An assembled character is legitimately multi-shell (head, lashes, brows, eye layers,
 * mouth interior, teeth, tongue, body, hands, hair, cape, accessories) — a raw component
 * COUNT cannot tell that apart from a shattered mesh. Face share can.
 */
export function classifyComponents(componentFaces: number[] | undefined, omitted = 0): ComponentSplit {
  if (!componentFaces?.length) return { measured: false, parts: 0, floaters: 0, floaterFaces: 0 };
  const total = componentFaces.reduce((a, b) => a + b, 0);
  const floor = Math.max(FLOATER_MIN_FACES, total * FLOATER_FACE_SHARE);
  const floaterList = componentFaces.filter((f) => f < floor);

  // The histogram is capped and sorted largest-first, so anything omitted is no bigger
  // than the smallest entry we kept. When that entry is already a speck, every omitted
  // one is too. When it is substantial we cannot tell — so count them as parts, which
  // pushes toward the harsher verdict. Neither branch can manufacture a pass.
  const smallestKept = componentFaces[componentFaces.length - 1];
  const omittedAreSpecks = smallestKept < floor;

  return {
    measured: true,
    parts: componentFaces.length - floaterList.length + (omittedAreSpecks ? 0 : omitted),
    floaters: floaterList.length + (omittedAreSpecks ? omitted : 0),
    floaterFaces: floaterList.reduce((a, b) => a + b, 0),
  };
}

export interface FaceRigReadiness {
  /** `null` when unmeasured — readiness is never claimed from data we do not have. */
  ready: boolean | null;
  separableParts: number | null;
  reason: string;
}

/**
 * Can this head be given expressions at all? Blend shapes and gaze need the eyes,
 * lashes, brows and mouth interior to exist as separable shells; a head that arrived
 * welded into one shell cannot be rigged for them no matter which tool is used. That is
 * knowable from geometry alone, before any MetaHuman/Faceit attempt spends time.
 *
 * Display/routing only — deliberately NOT folded into `scoreMesh`, since a prop with one
 * shell is perfect and a head with one shell is merely unsuitable for a different job.
 */
export function faceRigReadiness(m: MeshMetrics): FaceRigReadiness {
  const split = classifyComponents(m.componentFaces, m.componentFacesOmitted);
  if (!split.measured) {
    return { ready: null, separableParts: null, reason: 'unmeasured — the critique script emitted no per-component faces' };
  }
  if (split.parts >= FACE_RIG_MIN_SHELLS) {
    return { ready: true, separableParts: split.parts, reason: `${split.parts} separable shells — eyes/lashes/brows/mouth interior can be driven independently` };
  }
  return {
    ready: false,
    separableParts: split.parts,
    reason: split.parts <= 1
      ? 'single welded shell — no separable eyes, lashes, brows or interior mouth to drive expressions'
      : `only ${split.parts} separable shells (need ${FACE_RIG_MIN_SHELLS}) — eyes/lashes/brows/mouth interior are not independently addressable`,
  };
}

export interface CritiqueThresholds {
  minVerts: number;
  maxComponentsFail: number;
  maxFacesWarn: number;
  minExtent: number;
  /** Specks tolerated before the mesh is called shattered (histogram path only). */
  maxFloatersFail: number;
}

const DEFAULT_THRESHOLDS: CritiqueThresholds = {
  minVerts: 100, maxComponentsFail: 8, maxFacesWarn: 200_000, minExtent: 1e-4, maxFloatersFail: 4,
};

export interface Scorecard {
  verdict: 'pass' | 'warn' | 'fail';
  score: number;
  reasons: string[];
  /**
   * How the delivered mesh compared to the face budget that was REQUESTED for it.
   * Distinct from `maxFacesWarn`, which is the class CEILING: a 55k-triangle character
   * sits under the 60k ceiling while still being 1.4x the 40k that was asked for, and
   * only this grade can say so. Absent when no budget was supplied — silence about a
   * budget must never read as compliance with one.
   */
  budget?: BudgetGrade;
  /**
   * How the delivered mesh compared to the real-world SIZE that was requested for it.
   * Every generator normalises to a ~1 m box, so without this a 1 m hero passed clean
   * next to a 1.8 m Mannequin. Absent when no size was supplied — same silence rule.
   */
  scale?: ScaleGrade;
}

/** A scorecard plus the metrics behind it — the shape surfaced to the UI / job result. */
export type CritiqueCard = Scorecard & { metrics?: MeshMetrics };

/**
 * Score a mesh's structural health into a deterministic pass/warn/fail card. Pure.
 *
 * `budget` is the face budget the caller ASKED the generator for. Supplying it adds a
 * warn when the delivery overshot it — the check that catches a provider quietly
 * ignoring a low-poly request, and the quad/triangle unit trap that doubles a budget.
 * `size` is the longest extent (m) the mesh was supposed to have; supplying it catches
 * the generator-normalised 1 m box shipping at the wrong world scale.
 */
export function scoreMesh(
  m: MeshMetrics,
  thresholds: Partial<CritiqueThresholds> = {},
  budget?: BudgetRequest,
  size?: SizeRequest,
): Scorecard {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const fails: string[] = [];
  const warns: string[] = [];

  if (m.verts < t.minVerts || m.faces < 1) fails.push(`empty/degenerate mesh (${m.verts} verts, ${m.faces} faces)`);
  if (m.bbox.some((e) => e < t.minExtent)) fails.push(`degenerate bounding box (flat: ${m.bbox.map((e) => e.toFixed(2)).join('×')})`);
  // Component health. With a per-component face histogram we can tell a body part from
  // a speck, so an assembled character (head + lashes + brows + eye layers + mouth
  // interior + teeth + tongue + body + hands + hair + cape + accessories) is judged on
  // its SPECK count rather than rejected for having parts. Without the histogram the
  // original blunt count rule stands unchanged — no silent loosening on old data.
  const split = classifyComponents(m.componentFaces, m.componentFacesOmitted);
  if (split.measured) {
    if (split.floaters > t.maxFloatersFail) {
      fails.push(`${split.floaters} floater fragments (${split.floaterFaces} faces of specks)`);
    }
    if (split.parts > t.maxComponentsFail) {
      fails.push(`${split.parts} substantial disconnected parts (above the ${t.maxComponentsFail} budget for this class)`);
    }
    if (split.floaters > 0 && split.floaters <= t.maxFloatersFail) {
      warns.push(`${split.floaters} floater fragments (${split.floaterFaces} faces of specks)`);
    }
  } else if (m.components > t.maxComponentsFail) {
    fails.push(`${m.components} disconnected components (fragmented / floaters)`);
  }

  if (!m.watertight) warns.push('not watertight (open boundary / holes)');
  if (!split.measured && m.components > 1 && m.components <= t.maxComponentsFail) {
    warns.push(`${m.components} disconnected components (possible floaters)`);
  }
  if (!m.windingConsistent) warns.push('inconsistent face winding (normals may flip)');
  if (m.degenerateFaces > 0) warns.push(`${m.degenerateFaces} degenerate faces`);
  if (m.faces > t.maxFacesWarn) warns.push(`high face count (${m.faces}) — needs decimation for game use`);

  // Budget honoured? trimesh triangulates on load, so `m.faces` is a triangle count.
  const budgetGrade = budget ? gradeFaceBudget(m.faces, budget) : undefined;
  if (budgetGrade?.verdict === 'over' && budgetGrade.reason) warns.push(budgetGrade.reason);

  // Right size? bbox is trimesh extents in glTF metres. Always graded so the card can
  // say "generator-normalised, size unknown" even when no target was requested.
  const scaleGrade = gradeWorldScale(m.bbox, size);
  if (scaleGrade.verdict === 'off' && scaleGrade.reason) warns.push(scaleGrade.reason);

  const verdict = fails.length ? 'fail' : warns.length ? 'warn' : 'pass';
  const score = Math.max(0, Math.min(100, 100 - fails.length * 50 - warns.length * 15));
  return { verdict, score, reasons: [...fails, ...warns], budget: budgetGrade, scale: scaleGrade };
}

export interface CritiqueResult extends Partial<Scorecard> {
  ok: boolean;
  metrics?: MeshMetrics;
  error?: string;
  /**
   * The critic could not RUN at all (missing env var / missing binary / missing script)
   * — categorically different from `ok: false`, which means it ran and the mesh failed.
   *
   * Nothing downstream could previously tell those apart, so an absent critic read as a
   * mesh problem: an errored critique is never "acceptable", so a retry loop spent every
   * paid attempt against a gate structurally incapable of passing, and the delivered
   * reason blamed the mesh. `error` carries WHAT is missing in this state.
   */
  unavailable?: boolean;
}

/**
 * The one honest caveat that belongs beside any FAILING Tier-1 verdict.
 *
 * On record from the smart-low-poly arena: the gate reads RAW pre-retopo generator
 * output against thresholds authored for finished, game-ready meshes, so it fails near
 * 100% of raw deliveries on face count alone regardless of how good the mesh is.
 * Recalibrating the thresholds is a separate tuning decision; saying so is not.
 */
export const CRITIQUE_CALIBRATION_CAVEAT =
  'gate calibrated for finished meshes; raw provider output may fail on face count alone';

/** Build the distinct "the critic could not run" outcome. Pure. */
export function critiqueUnavailable(reason: string): CritiqueResult {
  return { ok: false, unavailable: true, error: reason };
}

/** The sentence a delivered-but-ungraded mesh is reported with. Pure. */
export function ungatedReason(critique: CritiqueResult | undefined): string {
  return `critique unavailable: ${critique?.error ?? 'reason not reported'} — mesh delivered ungated`;
}

export interface GateSummary {
  /** True ONLY when a critique actually ran and did not fail the mesh. */
  accepted: boolean;
  /** True when nothing graded the mesh — it was delivered, not passed. */
  ungated: boolean;
  reason: string;
  /** The calibration caveat, present only where a real failing verdict is shown. */
  note?: string;
}

/**
 * Turn one critique into the gate fields a job reports. Pure.
 *
 * Single-shot stores (TripoSR / Hunyuan) have no retry loop to derive these from, and
 * without them a job that was never graded looked exactly like one that passed.
 */
export function summarizeGate(critique: CritiqueResult | undefined): GateSummary {
  if (!critique) {
    return { accepted: false, ungated: true, reason: 'no mesh was produced, so nothing was graded' };
  }
  if (critique.unavailable) {
    return { accepted: false, ungated: true, reason: ungatedReason(critique) };
  }
  if (!critique.ok) {
    return { accepted: false, ungated: true, reason: `critique did not complete: ${critique.error ?? 'unknown error'} — mesh delivered ungated` };
  }
  if (critique.verdict === undefined) {
    return { accepted: false, ungated: true, reason: 'critique returned no verdict — mesh delivered ungated' };
  }
  if (critique.verdict === 'fail') {
    return {
      accepted: false,
      ungated: false,
      reason: `Tier-1 gate FAIL (score ${critique.score ?? 0}): ${critique.reasons?.[0] ?? 'no reason reported'}`,
      note: CRITIQUE_CALIBRATION_CAVEAT,
    };
  }
  return { accepted: true, ungated: false, reason: `Tier-1 gate ${critique.verdict} (score ${critique.score ?? 0})` };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface CritiqueDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  env?: Record<string, string | undefined>;
  triposrRoot?: string;
  /** Class-aware gate overrides (see polycount-presets `critiqueThresholdsFor`). */
  thresholds?: Partial<CritiqueThresholds>;
  /** The face budget this mesh was generated against, so the delivery can be held to it. */
  budget?: BudgetRequest;
  /** The real-world size (longest extent, m) this mesh should have. */
  size?: SizeRequest;
}

/**
 * Critique a generated mesh: run the trimesh script (via the TripoSR venv) + score it.
 *
 * Three outcomes, deliberately distinct: `unavailable` (the critic could not run — the
 * caller must NOT read this as a mesh problem, and must not pay for a re-roll against
 * it), `ok: false` (it ran and could not produce metrics), and a scored card.
 */
export async function critiqueMesh(glbPath: string, deps: CritiqueDeps = {}): Promise<CritiqueResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const run = deps.run ?? defaultRun;
  const root = deps.triposrRoot ?? env.POF_TRIPOSR_ROOT;
  if (!root) return critiqueUnavailable('POF_TRIPOSR_ROOT is not set (the TripoSR venv is where trimesh lives)');
  const py = join(root, '.venv', 'Scripts', 'python.exe');
  if (!fileExists(py)) return critiqueUnavailable(`venv python not found at ${py}`);
  const script = join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_critique.py');
  if (!fileExists(script)) return critiqueUnavailable(`critique script not found at ${script}`);

  const { stdout } = await run(py, [script, '--mesh', glbPath], 60_000);
  const parsed = parseCritiqueMetrics(stdout);
  if (!parsed.ok || !parsed.metrics) return { ok: false, error: parsed.error ?? 'critique produced no metrics' };
  return { ok: true, metrics: parsed.metrics, ...scoreMesh(parsed.metrics, deps.thresholds, deps.budget, deps.size) };
}

const defaultRun: RunFn = async (cmd, args, timeoutMs) => {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); resolve({ stdout, code }); });
    child.on('error', () => { clearTimeout(timer); resolve({ stdout, code: null }); });
  });
};
