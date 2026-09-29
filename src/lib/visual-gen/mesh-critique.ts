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
import type { BudgetRequest } from './face-budget';
import type { SizeRequest, OrientationRequest } from './world-scale';
import { assessStage, type MeshStage } from './critique-stage';
import { classifyComponents } from './component-split';
import { scoreMesh, type MeshMetrics, type CritiqueThresholds, type Scorecard } from './mesh-score';

// The pure scorer lives in the node-free `mesh-score.ts` so a client view can grade with the
// gate itself; every symbol is re-exported here so no importer changes.
export {
  DEFAULT_THRESHOLDS, scoreMesh, scoreGeometry, GEOMETRY_CODES, GATE_ONLY_CODES,
  type MeshMetrics, type CritiqueThresholds, type FindingCode, type Finding, type Scorecard, type CritiqueCard,
  type GeometryFacts, type GeometryRequest,
} from './mesh-score';

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

// Parts vs specks lives in the node-free `component-split.ts` so the UE import plan (rendered
// by a client view) can count shells without reaching this module's node:* imports.
export { FLOATER_FACE_SHARE, FLOATER_MIN_FACES, classifyComponents, type ComponentSplit } from './component-split';
/** Separable shells a head needs before expression work is even attempted. */
export const FACE_RIG_MIN_SHELLS = 4;

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
  /**
   * The pipeline stage the graded mesh was at, as DECLARED by the caller. Never inferred
   * — an absent stage stays absent, and `assessStage` reports it as undeclared rather
   * than guessing that dense output must be raw.
   */
  stage?: MeshStage;
}

/**
 * The FALLBACK caveat beside a failing Tier-1 verdict — used only when the verdict
 * carries no `findings` to derive a specific one from (a `CritiqueResult` assembled by an
 * older path). Prefer `assessStage(critique, stage).caveat`, which names this verdict's
 * actual defect classes.
 *
 * The previous text — *"raw provider output may fail on face count alone"* — was
 * measurably FALSE and shipped beside every failing verdict. `scoreMesh` files
 * `face-count` as a WARN and has no fail rule for it at any threshold: a 1,492,072-face
 * mesh graded against the 12,000-face `modular-part` ceiling scores warn/85. Re-measured
 * 2026-08-20 over all 52 `.glb` under `generated/` — 10 fails, and all 10 were `floaters`.
 * See `critique-stage.ts` for the full measurement.
 */
export const CRITIQUE_CALIBRATION_CAVEAT =
  'gate thresholds are authored for FINISHED game-tier meshes; the pipeline stage of this mesh was not declared, so the verdict cannot say whether it is a defect or an un-finished input';

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
export function summarizeGate(critique: CritiqueResult | undefined, stage: MeshStage = 'unknown'): GateSummary {
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
      // Derived from THIS verdict's own defect classes where possible. The blanket
      // constant is the fallback for a card with no findings — never the default.
      note: assessStage(critique, stage).caveat ?? CRITIQUE_CALIBRATION_CAVEAT,
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
  /**
   * Which pipeline stage this mesh is at. Supplying it is what lets a failing verdict say
   * whether it is condemning a defect or an un-finished input (see `critique-stage.ts`).
   */
  stage?: MeshStage;
  /**
   * Whether the subject should stand (see `expectsUprightFor`). Supplying it is what lets a
   * lying character draw the `orientation-lying` WARN; absent, orientation stays `unmeasured`.
   * Build it with `gateRequestFor` (`gate-request.ts`) rather than by hand.
   */
  orientation?: OrientationRequest;
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
  return {
    ok: true,
    metrics: parsed.metrics,
    ...(deps.stage ? { stage: deps.stage } : {}),
    ...scoreMesh(parsed.metrics, deps.thresholds, deps.budget, deps.size, deps.orientation),
  };
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
