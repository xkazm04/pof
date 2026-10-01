/**
 * The operator's Tripo CLI (`scripts/visual-gen/pof_tripo.mjs`) as a planner + executor
 * over the app's ONE Tripo client (`tripo-runner.ts`) and model pin (`tripo-models.ts`).
 *
 * The script used to be a hand-copied second client that knew none of what the app had
 * learned: it sent no `model_version` unless `--model` was passed (the account default the
 * character-pipeline arena graded FAIL), passed the benchmarked-and-rejected
 * `smart_low_poly` straight through, had no preview, and printed "timed out" for a paid task
 * that was still running with no flag that could collect it. Now:
 *  - every create is pinned by `tripoModelFor`; `--model` overrides and is warned unaudited;
 *  - `--dry` prints the exact POST /task body and spends nothing (no key, no network);
 *  - `--resume <taskId>` collects an existing task through `awaitTripoTask` (never pays);
 *  - a recoverable failure prints the exact resume command (`POF_TRIPO_RESUME=`).
 *
 * Imports are TYPE-ONLY so node strips them and loads this file straight from the .mjs
 * (the `pof_tripo_animate.mjs` → `tripo-rig-models.ts` precedent); the runtime pieces are
 * injected. Marker keys are declared in `SCRIPT_MARKERS.tripo` (`script-markers.ts`).
 */
import type { TripoDeps, TripoPollOptions, TripoResult, TripoSpec } from '@/lib/visual-gen/tripo-runner';
import type { TripoModelPin } from '@/lib/visual-gen/tripo-models';

export type TripoCliArgs = Readonly<Record<string, string | true>>;

/** Same shape the script always accepted: `--key value`, or `--flag` when no value follows. */
export function parseTripoCliArgs(argv: readonly string[]): TripoCliArgs {
  const o: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n !== undefined && !n.startsWith('--')) { o[k] = n; i++; } else o[k] = true;
  }
  return o;
}

export interface TripoCliGuards {
  /** `SMART_LOW_POLY_VERDICT` — the completed negative audit the flag is refused with. */
  smartLowPoly: { benchmarked: string; verdict: string; reason: string };
  /** `isTripoTaskId` — the runner's own task-id shape check. */
  isTripoTaskId: (id: unknown) => id is string;
}

interface Planned { preview: string[]; warnings: string[] }
export type TripoCliPlan =
  | (Planned & { kind: 'create'; spec: TripoSpec; renderPath?: string })
  | (Planned & { kind: 'dry'; spec: TripoSpec; renderPath?: string })
  | (Planned & { kind: 'resume'; taskId: string; outputPath: string; poll: TripoPollOptions; renderPath?: string })
  | { kind: 'refuse'; error: string; preview: string[]; warnings: string[] };

export const TRIPO_CLI_DEFAULT_MAX_MS = 600_000;
const POLL_INTERVAL_MS = 4000;
const KNOWN = new Set([
  'prompt', 'image', 'output', 'model', 'face-limit', 'pbr', 'quad', 'texture-quality', 'smart-low-poly',
  'force-smart-low-poly', 'max-ms', 'render', 'dry', 'resume',
]);
const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined);
const refuse = (error: string, warnings: string[] = []): TripoCliPlan => ({ kind: 'refuse', error, preview: [], warnings });
const posInt = (v: string | true | undefined) => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return n > 0 ? n : undefined;
};

/** Decide what a CLI invocation will do — and what it would buy — before any call. Pure. */
export function planTripoCli(args: TripoCliArgs, pin: TripoModelPin, guards: TripoCliGuards): TripoCliPlan {
  const warnings = Object.keys(args).filter((k) => !KNOWN.has(k)).map((k) => `unknown flag --${k} ignored`);
  const output = str(args.output);
  if (!output) return refuse('need --output <path.glb>', warnings);
  const maxMs = args['max-ms'] === undefined ? TRIPO_CLI_DEFAULT_MAX_MS : posInt(args['max-ms']);
  if (maxMs === undefined) return refuse('--max-ms must be a positive number of milliseconds', warnings);
  const poll: TripoPollOptions = { pollIntervalMs: POLL_INTERVAL_MS, maxPollMs: maxMs };
  const renderPath = str(args.render);
  const window = `poll every ${POLL_INTERVAL_MS / 1000}s for up to ${Math.round(maxMs / 1000)}s`;

  if (args.resume !== undefined) {
    const taskId = str(args.resume);
    if (!guards.isTripoTaskId(taskId)) return refuse(`invalid Tripo task id ${JSON.stringify(taskId ?? '')} (letters, digits and dashes only)`, warnings);
    if (args.prompt !== undefined || args.image !== undefined) return refuse('--resume collects an existing task; drop --prompt / --image', warnings);
    if (args.dry !== undefined) return refuse('--resume never pays (it only polls and downloads); drop --dry', warnings);
    const preview = [`resume task ${taskId} -> ${output} (no upload, no new task, no credits)`, window];
    return { kind: 'resume', taskId, outputPath: output, poll, renderPath, preview, warnings };
  }

  const prompt = str(args.prompt);
  const image = str(args.image);
  if (!prompt && !image) return refuse('need one of --prompt <text> / --image <path> (or --resume <taskId>)', warnings);
  const v = guards.smartLowPoly;
  if (args['smart-low-poly'] !== undefined && args['force-smart-low-poly'] === undefined) {
    return refuse(`--smart-low-poly was benchmarked ${v.benchmarked} and ${v.verdict}: ${v.reason} Pass --force-smart-low-poly to spend on it anyway.`, warnings);
  }
  const faceLimit = args['face-limit'] === undefined ? undefined : posInt(args['face-limit']);
  if (args['face-limit'] !== undefined && faceLimit === undefined) return refuse('--face-limit must be a positive whole number', warnings);
  const tq = args['texture-quality'] === undefined ? pin.textureQuality : str(args['texture-quality']);
  if (tq !== 'standard' && tq !== 'detailed') return refuse('--texture-quality must be standard or detailed', warnings);

  const model = str(args.model) ?? pin.modelVersion;
  if (model !== pin.modelVersion) warnings.push(`model ${model} is unaudited: only ${pin.modelVersion} has cleared PoF's arena (the v2.5 account default was graded FAIL)`);
  if (tq !== pin.textureQuality) warnings.push(`texture_quality ${tq} is unaudited: both recorded pass recipes use ${pin.textureQuality}`);
  const smartLowPoly = args['smart-low-poly'] !== undefined ? true : undefined;
  if (smartLowPoly) warnings.push(`--smart-low-poly forced against the ${v.benchmarked} verdict (${v.verdict}): ${v.reason}`);

  const spec: TripoSpec = {
    mode: image ? 'image-to-3d' : 'text-to-3d',
    outputPath: output,
    ...(image ? { imagePath: image } : { prompt }),
    modelVersion: model,
    textureQuality: tq,
    ...(faceLimit !== undefined ? { faceLimit } : {}),
    ...(args.pbr !== undefined ? { pbr: true } : {}),
    ...(args.quad !== undefined ? { quad: true } : {}),
    ...(smartLowPoly ? { smartLowPoly } : {}),
    ...poll,
  };
  const preview = [
    model === pin.modelVersion
      ? `model ${model} (${pin.audited ? 'audited' : 'pinned, not yet audited'}: ${pin.rationale})`
      : `model ${model} (UNAUDITED override of the audited ${pin.modelVersion})`,
    image ? `image ${image} -> upload pending (performed only on a paid run)` : `text prompt ${JSON.stringify(prompt)}`,
    `output ${output}${renderPath ? `, preview render -> ${renderPath}` : ''}; ${window}`,
    'submits ungated: no Tier-1 mesh gate runs on this CLI\'s output',
  ];
  return args.dry !== undefined
    ? { kind: 'dry', spec, renderPath, preview, warnings }
    : { kind: 'create', spec, renderPath, preview, warnings };
}

export interface TripoCliDeps {
  runTripo: (spec: TripoSpec, deps?: TripoDeps) => Promise<TripoResult>;
  awaitTripoTask: (taskId: string, outputPath: string, deps?: TripoDeps & TripoPollOptions) => Promise<TripoResult>;
  buildCreateTaskBody: (spec: TripoSpec) => Record<string, unknown>;
  isRecoverableTripoFailure: (r: TripoResult) => boolean;
  /** Bytes on disk, for POF_TRIPO_BYTES. */
  fileSize?: (path: string) => number | undefined;
  /** Best-effort download of the provider preview render (`--render`). */
  downloadFile?: (url: string, path: string) => Promise<boolean>;
  /** Create the output's folder before a paid run writes into it. */
  ensureParentDir?: (path: string) => void;
  /** Live sink for each marker line as it happens (the CLI passes console.log). */
  print?: (line: string) => void;
}

export interface TripoCliOutcome { lines: string[]; exitCode: 0 | 1 }

const quoteArg = (p: string) => (/\s/.test(p) ? `"${p}"` : p);

/** Run a plan through the injected client and return its marker lines + exit code. */
export async function executeTripoCli(plan: TripoCliPlan, deps: TripoCliDeps): Promise<TripoCliOutcome> {
  const lines: string[] = [];
  const out = (line: string) => { lines.push(line); deps.print?.(line); };
  for (const w of plan.warnings) out(`POF_TRIPO_WARN=${w}`);
  if (plan.kind === 'refuse') {
    out(`POF_TRIPO_ERROR=${plan.error}`);
    return { lines, exitCode: 1 };
  }
  for (const p of plan.preview) out(`POF_TRIPO_PLAN=${p}`);
  if (plan.kind === 'dry') {
    out(`POF_TRIPO_DRY=${JSON.stringify(deps.buildCreateTaskBody(plan.spec))}`);
    return { lines, exitCode: 0 };
  }

  const outputPath = plan.kind === 'create' ? plan.spec.outputPath : plan.outputPath;
  const hooks: TripoDeps = {
    onImageUploaded: (token) => out(`POF_TRIPO_UPLOAD=${token}`),
    onTaskCreated: (id) => out(`POF_TRIPO_TASK=${id}`),
    onStatus: (status, progress) => out(`POF_TRIPO_STATUS=${status} progress=${progress ?? '?'}`),
  };
  let r: TripoResult;
  try {
    deps.ensureParentDir?.(outputPath);
    if (plan.kind === 'create') {
      r = await deps.runTripo(plan.spec, hooks);
    } else {
      out(`POF_TRIPO_TASK=${plan.taskId}`);
      r = await deps.awaitTripoTask(plan.taskId, outputPath, { ...hooks, ...plan.poll });
    }
  } catch (e) {
    out(`POF_TRIPO_ERROR=${e instanceof Error ? e.message : String(e)}`);
    return { lines, exitCode: 1 };
  }

  if (!r.ok) {
    out(`POF_TRIPO_ERROR=${r.error ?? 'Tripo run failed'}`);
    if (r.taskId && deps.isRecoverableTripoFailure(r)) {
      const render = plan.renderPath ? ` --render ${quoteArg(plan.renderPath)}` : '';
      out(`POF_TRIPO_RESUME=--resume ${r.taskId} --output ${quoteArg(outputPath)}${render}`);
    }
    return { lines, exitCode: 1 };
  }
  const meshPath = r.meshPath ?? outputPath;
  const bytes = deps.fileSize?.(meshPath);
  if (bytes !== undefined) out(`POF_TRIPO_BYTES=${bytes}`);
  if (r.formatMismatch) out(`POF_TRIPO_WARN=${r.formatMismatch}`);
  if (r.renderUrl) {
    out(`POF_TRIPO_RENDER=${r.renderUrl}`);
    if (plan.renderPath && deps.downloadFile) {
      // Best-effort, as it always was: a missing preview never fails a delivered mesh.
      const saved = await deps.downloadFile(r.renderUrl, plan.renderPath).catch(() => false);
      if (saved) out(`POF_TRIPO_RENDER_FILE=${plan.renderPath}`);
    }
  }
  out(`POF_TRIPO_DONE=${meshPath}`);
  return { lines, exitCode: 0 };
}
