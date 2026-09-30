/**
 * The ONE server-side dispatch table for runner-backed 3D generation. SERVER-ONLY: it
 * writes temp files and starts GPU/cloud jobs — client code reads `providers.ts` instead.
 *
 * `RUNNER_DISPATCH` is typed as a Record over `RunnerProviderId`, the same tuple that
 * derives each registry entry's `runnerBacked`, so the set the forge offers as runnable
 * and the set this table can start are one set: an id added to the tuple without an
 * entry here is a type error. POST /api/visual-gen/generate starts jobs through
 * {@link runnerDispatchFor}; GET /api/visual-gen/generate/status resolves them through
 * {@link resolveRunnerJob}; a miss refuses with {@link runnerRefusal}, which is the forge
 * button's own `providerExecution(...).reason`.
 *
 * The providers are deliberately NOT unified behind one spec — each entry keeps its own
 * pins (Hunyuan model, Tripo model + texture quality, TripoSR fidelity) and budget rules.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ok, err, type Result } from '@/types/result';
import {
  getProviderById, providerExecution, isRunnerProviderId,
  type GenerationMode, type RunnerProviderId,
} from '@/lib/visual-gen/providers';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob, getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTripoJob, getTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { startTrellisJob, getTrellisJob } from '@/lib/visual-gen/trellis-job-store';
import { generationPlanFor, resolveAssetClass } from '@/lib/visual-gen/polycount-presets';
import { providerFaceLimit } from '@/lib/visual-gen/face-budget';
import { tripoModelFor } from '@/lib/visual-gen/tripo-models';
import { TRIPO_VIEW_ORDER, type TripoView } from '@/lib/visual-gen/tripo-runner';
import { hunyuanModelFor } from '@/lib/visual-gen/hunyuan-models';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

export type RunnerMode = GenerationMode | 'multiview-to-3d';

export interface RunnerStartInput {
  mode: RunnerMode;
  prompt?: string;
  imageDataUrl?: string;
  viewDataUrls?: Partial<Record<TripoView, string>>;
  assetClass?: string;
  mcResolution?: number;
  maxAttempts?: number;
}

export interface RunnerStarted {
  jobId: string;
  /** Provider-specific fields the 202 carries (gradedAs, generationPlan, views). */
  extras: Record<string, unknown>;
}

/** The provider-agnostic view of a job that the status route projects. */
export interface RunnerJob {
  status: 'running' | 'done' | 'error';
  result?: unknown;
  critique?: CritiqueResult;
  error?: string;
}

export interface RunnerDispatch {
  modes: readonly RunnerMode[];
  start(input: RunnerStartInput): Result<RunnerStarted, string>;
  getJob(id: string): RunnerJob | undefined;
}

const outFor = (id: string) => {
  const stamp = Date.now();
  const outDir = join(process.cwd(), 'generated', id).replace(/\\/g, '/');
  mkdirSync(outDir, { recursive: true });
  return { stamp, outputPath: join(outDir, `${stamp}.glb`).replace(/\\/g, '/') };
};

const writeTemp = (name: string, dataUrl: string): string | null => {
  const img = parseImageDataUrl(dataUrl);
  if (!img) return null;
  const path = join(tmpdir(), `${name}.${img.ext}`).replace(/\\/g, '/');
  writeFileSync(path, img.buffer);
  return path;
};

/** The single-image front half every image-to-3d entry shares. */
function singleImage(id: string, input: RunnerStartInput): Result<{ imagePath: string; outputPath: string }, string> {
  if (!input.imageDataUrl) return err('Missing imageDataUrl for image-to-3d');
  const { stamp, outputPath } = outFor(id);
  const imagePath = writeTemp(`pof_${id}_in_${stamp}`, input.imageDataUrl);
  if (!imagePath) return err('imageDataUrl must be a base64 PNG/JPG/WebP data URL');
  return ok({ imagePath, outputPath });
}

// `assetClass` is OPTIONAL and its default is stated, never guessed: absent (or
// unrecognised) input grades class-blind and `gradedAs` says so.
const gradedAs = (assetClass: string | undefined) => resolveAssetClass(assetClass).gradedAs;

function startTripo(input: RunnerStartInput): Result<RunnerStarted, string> {
  const { mode, prompt, imageDataUrl, viewDataUrls, assetClass, maxAttempts } = input;
  // WHERE the budget is enforced is a per-class decision: a `max-then-finish` class sends
  // NO `face_limit` (the generator's low-poly mode drops the detail the high->low bake
  // recovers), so mesh-finish enforces it instead.
  const generationPlan = assetClass ? generationPlanFor(assetClass) : undefined;
  const faceLimit = generationPlan?.faceLimit !== undefined
    ? providerFaceLimit({ triangleBudget: generationPlan.faceLimit, topology: 'triangles' })
    : undefined;
  // Never leave model_version unset — the arena graded the silent account default a FAIL.
  const pin = tripoModelFor(assetClass);
  const base = { pbr: true, faceLimit, assetClass, maxAttempts, modelVersion: pin.modelVersion, textureQuality: pin.textureQuality };
  const extras = { gradedAs: gradedAs(assetClass), generationPlan };
  const { stamp, outputPath } = outFor('tripo3d');
  if (mode === 'text-to-3d') {
    if (!prompt?.trim()) return err('Missing prompt for text-to-3d');
    return ok({ jobId: startTripoJob({ mode, prompt, outputPath, ...base }), extras });
  }
  if (mode === 'image-to-3d') {
    if (!imageDataUrl) return err('Missing imageDataUrl for image-to-3d');
    const imagePath = writeTemp(`pof_tripo3d_in_${stamp}`, imageDataUrl);
    if (!imagePath) return err('imageDataUrl must be a base64 PNG/JPG/WebP data URL');
    return ok({ jobId: startTripoJob({ mode, imagePath, outputPath, ...base }), extras });
  }
  if (!viewDataUrls?.front) return err('multiview-to-3d needs at least a front view (viewDataUrls.front)');
  const views: Partial<Record<TripoView, { path: string }>> = {};
  for (const slot of TRIPO_VIEW_ORDER) {
    const dataUrl = viewDataUrls[slot];
    if (!dataUrl) continue;
    // One temp file PER SLOT — a single-stamp name would mesh the last view four times.
    const path = writeTemp(`pof_tripo_mv_${slot}_${stamp}`, dataUrl);
    if (!path) return err(`${slot} view must be a base64 PNG/JPG/WebP data URL`);
    views[slot] = { path };
  }
  const jobId = startTripoJob({ mode: 'multiview-to-3d', views, outputPath, ...base });
  return ok({ jobId, extras: { ...extras, views: Object.keys(views) } });
}

// Job lookups are wrapped (never bare references) so a store is only touched when used.
export const RUNNER_DISPATCH = {
  hunyuan3d: {
    modes: ['image-to-3d'],
    // `hunyuanModelFor` states the model that has actually been running instead of
    // leaving it to an argparse default inside pof_hunyuan.py.
    start: (input) => {
      const io = singleImage('hunyuan3d', input);
      if (!io.ok) return io;
      const jobId = startHunyuanJob({ ...io.data, assetClass: input.assetClass, model: hunyuanModelFor(input.assetClass).model });
      return ok({ jobId, extras: { gradedAs: gradedAs(input.assetClass) } });
    },
    getJob: (id) => getHunyuanJob(id),
  },
  triposr: {
    modes: ['image-to-3d'],
    start: (input) => {
      const io = singleImage('triposr', input);
      if (!io.ok) return io;
      const jobId = startTriposrJob({ ...io.data, mcResolution: input.mcResolution, fidelity: true, assetClass: input.assetClass });
      return ok({ jobId, extras: { gradedAs: gradedAs(input.assetClass) } });
    },
    getJob: (id) => getTriposrJob(id),
  },
  tripo3d: {
    modes: ['text-to-3d', 'image-to-3d', 'multiview-to-3d'],
    start: startTripo,
    getJob: (id) => getTripoJob(id),
  },
  trellis2: {
    modes: ['image-to-3d'],
    // The class face limit is derived IN the store (native `decimation_target`), and the
    // delivery is graded against the same limit — so only the class is passed here.
    start: (input) => {
      const io = singleImage('trellis2', input);
      if (!io.ok) return io;
      const jobId = startTrellisJob({ ...io.data, assetClass: input.assetClass });
      return ok({ jobId, extras: { gradedAs: gradedAs(input.assetClass) } });
    },
    getJob: (id) => getTrellisJob(id),
  },
} satisfies Record<RunnerProviderId, RunnerDispatch>;

/** The dispatch entry for a provider id, or undefined when no runner drives it. */
export function runnerDispatchFor(providerId: string): RunnerDispatch | undefined {
  return isRunnerProviderId(providerId) ? RUNNER_DISPATCH[providerId] : undefined;
}

/**
 * Why `providerId` cannot be started for `mode` — the forge's own `providerExecution`
 * reason whenever the registry has one, so the button and the route say the same thing.
 */
export function runnerRefusal(providerId: string, mode: string): string {
  const provider = getProviderById(providerId);
  if (!provider) return `Unknown provider "${providerId}"`;
  const exec = providerExecution(provider, mode as GenerationMode);
  if (exec.reason) return exec.reason;
  if (exec.path === 'mcp') return `${provider.name} runs through Blender MCP — submit it to /api/blender-mcp/generate`;
  const modes = runnerDispatchFor(providerId)?.modes ?? provider.modes;
  return `${provider.name} does not support ${mode} (it supports ${modes.join(', ')}).`;
}

/** Find a job by id across every runner the table dispatches. */
export function resolveRunnerJob(jobId: string): { providerId: RunnerProviderId; job: RunnerJob } | undefined {
  for (const providerId of Object.keys(RUNNER_DISPATCH) as RunnerProviderId[]) {
    const job = RUNNER_DISPATCH[providerId].getJob(jobId);
    if (job) return { providerId, job };
  }
  return undefined;
}
