/**
 * Multi-view renderer seam — the thing PoF never had: a LOOK at a generated asset.
 *
 * `mesh-critique.ts` grades a mesh through trimesh: verts, faces, watertightness,
 * components, euler, bbox. All of it structural, none of it visual. A single-image→3D
 * generator reconstructs the side it was shown and invents the rest, so a mesh whose
 * back is a smeared blob is watertight, single-component and zero-degenerate — and
 * **passes**. Its own header has said since it was written that a render tier "can stack
 * on top later"; this is that tier's harness.
 *
 * It also answers the second question nothing could ask: whether the members of a KIT
 * match each other. `style-dna.ts` shapes what is ASKED for and never inspects what came
 * back (`STYLE_DNA_REACH`). To make that measurable the renderer emits, per view, the
 * dominant palette it measured from the **rendered pixels** — computed in Blender, whose
 * bundled numpy is already there, so no image-decoding dependency enters the app. See
 * `kit-coherence.ts` for the grader that consumes it.
 *
 * Pure cores (`viewsPlan` / `buildMeshViewsArgs` / `parseMeshViewsOutput`) over an
 * injectable spawn seam, the same shape as `mesh-finish.ts` — so every decision here is
 * testable without Blender.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBlenderPath } from './mesh-finish';

/** Yaws rendered by default — enough that no side of a prop goes unseen. */
export const DEFAULT_VIEWS = 6;

/** Square render resolution, matching the filmstrip renderer this forks. */
export const DEFAULT_VIEW_RES = 512;

/**
 * Ceiling on yaws. Each view is a VLM call in the gate downstream, so an unbounded
 * count is an unbounded bill; past this the extra yaws are redundant anyway.
 */
export const MAX_VIEWS = 16;

/** Floor: one view is the situation that produced the defect this gate exists to catch. */
const MIN_VIEWS = 2;

export interface MeshViewsSpec {
  /** Mesh to render — a `.glb` from the generation path. */
  meshPath: string;
  /** Directory the PNGs are written to. */
  outDir: string;
  /** Yaws to render around the mesh (default {@link DEFAULT_VIEWS}). */
  views?: number;
  /** Square render resolution (default {@link DEFAULT_VIEW_RES}). */
  resolution?: number;
  /** Blender executable; else POF_BLENDER; else a known install. */
  blenderPath?: string;
  /** Override the Blender script path (default the repo-committed one). */
  scriptPath?: string;
  timeoutMs?: number;
}

export interface ViewsPlan {
  views: number;
  /** Set only when the request was adjusted, naming what changed and why. */
  reason?: string;
}

/** Clamp a requested yaw count into the honest band, saying so when it moves. Pure. */
export function viewsPlan(requested: number | undefined): ViewsPlan {
  if (requested === undefined || !Number.isFinite(requested)) return { views: DEFAULT_VIEWS };
  const n = Math.floor(requested);
  if (n < MIN_VIEWS) {
    return {
      views: MIN_VIEWS,
      reason: `a view gate needs at least two views — one view is the condition that lets a broken back face pass; raised ${n} to ${MIN_VIEWS}`,
    };
  }
  if (n > MAX_VIEWS) {
    return {
      views: MAX_VIEWS,
      reason: `${n} views exceeds the ${MAX_VIEWS}-view cap — each view costs a VLM call downstream, and past the cap the yaws are redundant`,
    };
  }
  return { views: n };
}

/** Blender argv for one multi-view render. Pure. */
export function buildMeshViewsArgs(scriptPath: string, spec: MeshViewsSpec): string[] {
  const plan = viewsPlan(spec.views);
  return [
    '--background',
    '--factory-startup',
    '--python',
    scriptPath,
    '--',
    spec.meshPath,
    spec.outDir,
    '--views',
    String(plan.views),
    '--res',
    String(spec.resolution ?? DEFAULT_VIEW_RES),
  ];
}

export interface RenderedView {
  index: number;
  /** Camera yaw around the mesh, in degrees. */
  yawDeg: number;
  imagePath: string;
  /**
   * Dominant colours the renderer measured from this view's opaque pixels, as hex.
   * Absent — never `[]` — when the script emitted none, so "not measured" cannot be
   * read as "measured, and there are no colours".
   */
  palette?: string[];
}

export interface ParsedMeshViews {
  ok: boolean;
  error?: string;
  views: RenderedView[];
}

/** Parse the `POF_VIEWS_*` marker block. Pure. */
export function parseMeshViewsOutput(stdout: string): ParsedMeshViews {
  const errorLine = stdout.match(/^POF_VIEWS_ERROR=(.*)$/m);
  if (errorLine) return { ok: false, error: errorLine[1].trim(), views: [] };

  const views: RenderedView[] = [];
  const re = /^POF_VIEWS_(\d+)=([^|\r\n]*)\|([^|\r\n]*)(?:\|([^\r\n]*))?$/gm;
  for (let m = re.exec(stdout); m !== null; m = re.exec(stdout)) {
    const palette = (m[4] ?? '').split(',').map((c) => c.trim()).filter(Boolean);
    views.push({
      index: Number(m[1]),
      yawDeg: Number(m[2]),
      imagePath: m[3].trim(),
      palette: palette.length ? palette : undefined,
    });
  }
  views.sort((a, b) => a.index - b.index);

  const done = stdout.match(/^POF_VIEWS_DONE=(\d+)$/m);
  if (!done) {
    return {
      ok: false,
      error: 'no POF_VIEWS_DONE marker in Blender output — the render did not finish',
      views,
    };
  }
  const claimed = Number(done[1]);
  if (claimed !== views.length) {
    return {
      ok: false,
      error: `render claimed ${claimed} views but emitted ${views.length} — treating the run as failed rather than grading a partial set`,
      views,
    };
  }
  return { ok: true, views };
}

export interface MeshViewsResult {
  ok: boolean;
  error?: string;
  views: RenderedView[];
  /** Set when the requested yaw count was adjusted. */
  viewsPlanReason?: string;
  durationMs?: number;
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface MeshViewsDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
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

/** Render a mesh from N yaws. A marker without a file on disk is not a view. */
export async function runMeshViews(spec: MeshViewsSpec, deps: MeshViewsDeps = {}): Promise<MeshViewsResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;
  const plan = viewsPlan(spec.views);

  const blender = resolveBlenderPath(spec.blenderPath, env, fileExists);
  if (!blender) {
    return { ok: false, error: 'Blender not found — set POF_BLENDER to the blender executable', views: [] };
  }
  if (!fileExists(spec.meshPath)) {
    return { ok: false, error: `mesh not found at ${spec.meshPath}`, views: [] };
  }
  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_views.py');
  if (!fileExists(script)) {
    return { ok: false, error: `pof_mesh_views.py not found at ${script}`, views: [] };
  }

  const start = now();
  const { stdout } = await run(blender, buildMeshViewsArgs(script, spec), spec.timeoutMs ?? 300_000);
  const parsed = parseMeshViewsOutput(stdout);
  const durationMs = now() - start;
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, views: parsed.views, viewsPlanReason: plan.reason, durationMs };
  }

  const missing = parsed.views.filter((v) => !fileExists(v.imagePath));
  if (missing.length) {
    return {
      ok: false,
      error: `${missing.length} of ${parsed.views.length} view images were not written to disk (first: ${missing[0].imagePath}) — a marker is not a file`,
      views: parsed.views.filter((v) => fileExists(v.imagePath)),
      viewsPlanReason: plan.reason,
      durationMs,
    };
  }
  return { ok: true, views: parsed.views, viewsPlanReason: plan.reason, durationMs };
}
