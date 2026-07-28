/**
 * Tripo skin sets — ONE geometry, N texture sets.
 *
 * How game skins actually work: the mesh ships once and a skin is a different
 * set of textures (and their material settings — a gold skin is more metallic
 * than the base one) swapped over the same geometry. PoF generated a character
 * as a single textured mesh and had no way to express a second colourway, so a
 * variant meant re-generating the model and losing geometry parity.
 *
 * Tripo's `texture_model` task is exactly this operation: it re-textures a mesh
 * that a PREVIOUS Tripo task produced, keyed by `original_model_task_id`. Vary
 * `texture_seed` / `texture_quality` / the prompt-side alignment per run and the
 * outputs are N texture sets over identical topology.
 *
 * ⚠ Hard API limit, ground-truthed against the Tripo SDK reference: `texture_model`
 * accepts a task id ONLY. There is no way to texture a user-supplied mesh — so an
 * externally finished low-poly (our `mesh-finish.ts` output) or a Hunyuan3D shape
 * CANNOT be sent here. Texturing those needs a different engine entirely.
 *
 * Same testability shape as `tripo-runner.ts`, whose HTTP seam it reuses: pure
 * cores (body builder, plan, geometry check) + injected HTTP so the fan-out is
 * unit-tested without the network or credits.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TRIPO_BASE, parseTaskCreate, parseTaskStatus, type TripoHttp } from './tripo-runner';

export const TEXTURE_QUALITIES = ['standard', 'detailed'] as const;
export type TextureQuality = (typeof TEXTURE_QUALITIES)[number];

/** `original_image` keeps the concept's colours; `geometry` re-reads the surface. */
export type TextureAlignment = 'original_image' | 'geometry';

export interface SkinVariant {
  /** Human name for the skin — becomes the output filename ('gold', 'crimson'). */
  name: string;
  /** Vary this to get a genuinely different texture set off the same geometry. */
  textureSeed?: number;
  quality?: TextureQuality;
  alignment?: TextureAlignment;
  /** Default true — a skin without a PBR set can't carry a metallic difference. */
  pbr?: boolean;
}

export interface SkinSetSpec {
  /** A PRIOR Tripo generation task id — the shared geometry every skin re-textures. */
  originalTaskId: string;
  variants: SkinVariant[];
  /** Directory the per-skin .glb files are written to. */
  outputDir: string;
  apiKey?: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
  maxPolls?: number;
}

export interface SkinResult {
  name: string;
  ok: boolean;
  meshPath?: string;
  taskId?: string;
  error?: string;
  faces?: number;
  verts?: number;
}

export type GeometryStatus = 'consistent' | 'divergent' | 'unmeasured';

export interface GeometryVerdict {
  status: GeometryStatus;
  reason?: string;
}

export interface SkinSetResult {
  ok: boolean;
  error?: string;
  geometryTaskId: string;
  skins: SkinResult[];
  geometry: GeometryVerdict;
  durationMs: number;
}

/** Build the POST /task body for one skin. Pure. */
export function buildTextureTaskBody(originalTaskId: string, v: SkinVariant): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: 'texture_model',
    original_model_task_id: originalTaskId,
    texture: true,
    pbr: v.pbr ?? true,
    texture_quality: v.quality ?? 'standard',
    texture_alignment: v.alignment ?? 'original_image',
  };
  if (v.textureSeed !== undefined) body.texture_seed = v.textureSeed;
  return body;
}

/** Variant name → a safe, stable filename stem. Pure. */
export function skinSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SkinJob {
  name: string;
  slug: string;
  outputPath: string;
  variant: SkinVariant;
}

export interface SkinPlan {
  ok: boolean;
  error?: string;
  jobs?: SkinJob[];
}

/**
 * Validate the set and resolve each skin's output file. Rejects up front rather
 * than mid-fan-out, because every skin costs credits: a collision would silently
 * overwrite an already-paid-for skin.
 */
export function planSkinSet(spec: SkinSetSpec): SkinPlan {
  if (!spec.originalTaskId?.trim()) {
    return { ok: false, error: 'originalTaskId is required — a skin set re-textures an existing Tripo geometry task' };
  }
  if (!spec.variants?.length) {
    return { ok: false, error: 'a skin set needs at least one variant' };
  }
  const jobs: SkinJob[] = [];
  const seen = new Set<string>();
  for (const variant of spec.variants) {
    const slug = skinSlug(variant.name ?? '');
    if (!slug) return { ok: false, error: `skin name ${JSON.stringify(variant.name)} has no usable characters` };
    if (seen.has(slug)) return { ok: false, error: `duplicate skin name "${slug}" — skins would overwrite each other` };
    seen.add(slug);
    jobs.push({ name: variant.name, slug, outputPath: join(spec.outputDir, `${slug}.glb`), variant });
  }
  return { ok: true, jobs };
}

/**
 * A skin set is only a skin set if every variant shares the geometry. Verified
 * locally from the produced files — the API makes no such promise, and a silently
 * re-meshed variant breaks in-engine material swapping.
 */
export function checkSkinGeometry(entries: Array<{ name: string; faces?: number; verts?: number }>): GeometryVerdict {
  const measured = entries.filter((e) => typeof e.faces === 'number' && typeof e.verts === 'number');
  if (measured.length < 2) {
    return { status: 'unmeasured', reason: 'geometry parity not measured (fewer than two skins carry a mesh measurement)' };
  }
  const [base, ...rest] = measured;
  const odd = rest.filter((e) => e.faces !== base.faces || e.verts !== base.verts);
  if (odd.length === 0) return { status: 'consistent' };
  return {
    status: 'divergent',
    reason: `skins do not share geometry — ${odd
      .map((e) => `${e.name} (${e.faces}f/${e.verts}v)`)
      .join(', ')} differ from ${base.name} (${base.faces}f/${base.verts}v)`,
  };
}

export interface SkinSetDeps {
  http?: TripoHttp;
  env?: Record<string, string | undefined>;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Optional local mesh measurement — enables the geometry-parity verdict. */
  measure?: (path: string) => Promise<{ faces: number; verts: number }>;
}

/** Generate a skin set: N texture sets over the geometry of one prior Tripo task. */
export async function runTripoSkinSet(spec: SkinSetSpec, deps: SkinSetDeps = {}): Promise<SkinSetResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const start = now();
  const bail = (error: string, skins: SkinResult[] = []): SkinSetResult => ({
    ok: false,
    error,
    geometryTaskId: spec.originalTaskId,
    skins,
    geometry: { status: 'unmeasured', reason: error },
    durationMs: now() - start,
  });

  const plan = planSkinSet(spec);
  if (!plan.ok) return bail(plan.error!);

  const key = spec.apiKey ?? env.TRIPO_API_KEY;
  if (!key) return bail('TRIPO_API_KEY not set (get a key at https://platform.tripo3d.ai)');
  const http = deps.http;
  if (!http) return bail('no HTTP seam supplied');
  const auth = { Authorization: `Bearer ${key}` };

  const pollInterval = spec.pollIntervalMs ?? 4000;
  const maxPoll = spec.maxPollMs ?? 300_000;
  const maxPolls = spec.maxPolls ?? Math.max(1, Math.ceil(maxPoll / pollInterval));

  const skins: SkinResult[] = [];
  for (const job of plan.jobs!) {
    skins.push(await runOneSkin(job, spec.originalTaskId, { auth, http, fileExists, sleep, maxPolls, pollInterval, measure: deps.measure }));
  }

  const geometry = checkSkinGeometry(skins.filter((s) => s.ok));
  const failed = skins.filter((s) => !s.ok);
  const error = failed.length
    ? `${failed.length}/${skins.length} skins failed: ${failed.map((s) => `${s.name} (${s.error})`).join('; ')}`
    : geometry.status === 'divergent'
      ? geometry.reason
      : undefined;

  return { ok: !error, error, geometryTaskId: spec.originalTaskId, skins, geometry, durationMs: now() - start };
}

interface OneSkinCtx {
  auth: Record<string, string>;
  http: TripoHttp;
  fileExists: (p: string) => boolean;
  sleep: (ms: number) => Promise<void>;
  maxPolls: number;
  pollInterval: number;
  measure?: (path: string) => Promise<{ faces: number; verts: number }>;
}

async function runOneSkin(job: SkinJob, originalTaskId: string, ctx: OneSkinCtx): Promise<SkinResult> {
  const created = await ctx.http.postJson(
    `${TRIPO_BASE}/task`,
    { ...ctx.auth, 'Content-Type': 'application/json' },
    buildTextureTaskBody(originalTaskId, job.variant),
  );
  const pc = parseTaskCreate(created.json);
  if (!pc.ok) return { name: job.name, ok: false, error: pc.error };
  const taskId = pc.taskId!;

  for (let i = 0; i < ctx.maxPolls; i++) {
    const s = await ctx.http.getJson(`${TRIPO_BASE}/task/${taskId}`, ctx.auth);
    const ps = parseTaskStatus(s.json);
    if (ps.state === 'failed') return { name: job.name, ok: false, taskId, error: ps.error };
    if (ps.state === 'success') {
      if (!ps.modelUrl) return { name: job.name, ok: false, taskId, error: 'task succeeded but no model URL in output' };
      const ok = await ctx.http.download(ps.modelUrl, job.outputPath);
      if (!ok || !ctx.fileExists(job.outputPath)) return { name: job.name, ok: false, taskId, error: 'skin download failed' };
      const result: SkinResult = { name: job.name, ok: true, taskId, meshPath: job.outputPath };
      if (ctx.measure) {
        try {
          const m = await ctx.measure(job.outputPath);
          result.faces = m.faces;
          result.verts = m.verts;
        } catch { /* measurement is best-effort; the verdict stays `unmeasured` */ }
      }
      return result;
    }
    if (i < ctx.maxPolls - 1) await ctx.sleep(ctx.pollInterval);
  }
  return { name: job.name, ok: false, taskId, error: `timed out after ${ctx.maxPolls} polls` };
}
