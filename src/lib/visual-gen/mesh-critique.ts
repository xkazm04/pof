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
    },
  };
}

export interface CritiqueThresholds {
  minVerts: number;
  maxComponentsFail: number;
  maxFacesWarn: number;
  minExtent: number;
}

const DEFAULT_THRESHOLDS: CritiqueThresholds = { minVerts: 100, maxComponentsFail: 8, maxFacesWarn: 200_000, minExtent: 1e-4 };

export interface Scorecard {
  verdict: 'pass' | 'warn' | 'fail';
  score: number;
  reasons: string[];
}

/** A scorecard plus the metrics behind it — the shape surfaced to the UI / job result. */
export type CritiqueCard = Scorecard & { metrics?: MeshMetrics };

/** Score a mesh's structural health into a deterministic pass/warn/fail card. Pure. */
export function scoreMesh(m: MeshMetrics, thresholds: Partial<CritiqueThresholds> = {}): Scorecard {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const fails: string[] = [];
  const warns: string[] = [];

  if (m.verts < t.minVerts || m.faces < 1) fails.push(`empty/degenerate mesh (${m.verts} verts, ${m.faces} faces)`);
  if (m.bbox.some((e) => e < t.minExtent)) fails.push(`degenerate bounding box (flat: ${m.bbox.map((e) => e.toFixed(2)).join('×')})`);
  if (m.components > t.maxComponentsFail) fails.push(`${m.components} disconnected components (fragmented / floaters)`);

  if (!m.watertight) warns.push('not watertight (open boundary / holes)');
  if (m.components > 1 && m.components <= t.maxComponentsFail) warns.push(`${m.components} disconnected components (possible floaters)`);
  if (!m.windingConsistent) warns.push('inconsistent face winding (normals may flip)');
  if (m.degenerateFaces > 0) warns.push(`${m.degenerateFaces} degenerate faces`);
  if (m.faces > t.maxFacesWarn) warns.push(`high face count (${m.faces}) — needs decimation for game use`);

  const verdict = fails.length ? 'fail' : warns.length ? 'warn' : 'pass';
  const score = Math.max(0, Math.min(100, 100 - fails.length * 50 - warns.length * 15));
  return { verdict, score, reasons: [...fails, ...warns] };
}

export interface CritiqueResult extends Partial<Scorecard> {
  ok: boolean;
  metrics?: MeshMetrics;
  error?: string;
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface CritiqueDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  env?: Record<string, string | undefined>;
  triposrRoot?: string;
}

/** Critique a generated mesh: run the trimesh script (via the TripoSR venv) + score it. */
export async function critiqueMesh(glbPath: string, deps: CritiqueDeps = {}): Promise<CritiqueResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const run = deps.run ?? defaultRun;
  const root = deps.triposrRoot ?? env.POF_TRIPOSR_ROOT;
  if (!root) return { ok: false, error: 'POF_TRIPOSR_ROOT not set (the TripoSR venv has trimesh)' };
  const py = join(root, '.venv', 'Scripts', 'python.exe');
  if (!fileExists(py)) return { ok: false, error: `venv python not found at ${py}` };
  const script = join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_critique.py');

  const { stdout } = await run(py, [script, '--mesh', glbPath], 60_000);
  const parsed = parseCritiqueMetrics(stdout);
  if (!parsed.ok || !parsed.metrics) return { ok: false, error: parsed.error ?? 'critique produced no metrics' };
  return { ok: true, metrics: parsed.metrics, ...scoreMesh(parsed.metrics) };
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
