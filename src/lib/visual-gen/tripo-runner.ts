/**
 * Tripo3D cloud runner — the CLOUD 3D-generation route that sits next to PoF's
 * open-source LOCAL route (TripoSR / Hunyuan3D). Instead of spawning a python
 * process on the local GPU, it drives Tripo's REST API (api.tripo3d.ai):
 * upload → create task → poll to completion → download the resulting .glb.
 *
 * Why add it next to the local route:
 *  - it brings TEXT-to-3D, which the local route lacks (TripoSR/Hunyuan are image-only);
 *  - its image-to-3D competes with Hunyuan (higher fidelity + PBR textures + game-ready
 *    quad topology) with zero local VRAM.
 * License caveat: the Tripo FREE tier is NON-COMMERCIAL (CC BY 4.0) — same class as
 * Hunyuan3D. TripoSR (MIT) stays the commercial-safe local fallback behind the same
 * generate-route interface.
 *
 * Same testability shape as the local runners (triposr-runner / hunyuan-runner):
 * pure cores (body-builder + response parsers) + an injectable HTTP seam so the
 * create→poll→download orchestration is unit-tested without the network or credits.
 */
import { existsSync } from 'node:fs';

export const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

export interface TripoSpec {
  mode: 'text-to-3d' | 'image-to-3d';
  /** Full output mesh path; Tripo returns a .glb. */
  outputPath: string;
  /** text-to-3d: the natural-language prompt. */
  prompt?: string;
  /** image-to-3d: a local image file (uploaded to get a token). */
  imagePath?: string;
  /** image-to-3d: a pre-uploaded Tripo image token (skip the upload step). */
  imageToken?: string;
  /** image-to-3d: a public image URL (skip the upload step). */
  imageUrl?: string;
  /** Image MIME sub-type Tripo expects (png/jpg/webp); derived from imagePath if unset. */
  imageType?: string;
  /** Tripo model version, e.g. 'v2.5-20250123'. Omitted → account default. */
  modelVersion?: string;
  /**
   * Face budget handed to the provider. Authored in TRIANGLES (see `face-budget.ts`);
   * convert with `providerFaceLimit` when requesting `quad` topology, because the
   * provider counts FACES and a quad is two triangles.
   */
  faceLimit?: number;
  texture?: boolean;
  pbr?: boolean;
  /** Quad (game-ready) topology instead of triangles. */
  quad?: boolean;
  /**
   * Asset class this mesh is being generated as (`character`, `prop`, …). Carried so the
   * Tier-1 gate can grade it class-aware; never sent to the provider.
   */
  assetClass?: string;
  /** Override the API key; else env.TRIPO_API_KEY. */
  apiKey?: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
  /** Hard cap on poll iterations (defaults to maxPollMs/pollIntervalMs). */
  maxPolls?: number;
}

export interface TripoResult {
  ok: boolean;
  error?: string;
  meshPath?: string;
  taskId?: string;
  status?: string;
  modelUrl?: string;
  /**
   * Set when the format Tripo delivered does not match the extension we wrote it to.
   * `quad: true` is documented to change the delivered container, so a `.glb` path can
   * end up holding FBX bytes — the extension would then lie to every consumer
   * (`mesh-critique`'s trimesh load, the GLB viewer, the UE import). Reported rather
   * than assumed: the check reads the delivered URL instead of trusting the option.
   */
  formatMismatch?: string;
  durationMs: number;
}

/** Mesh extension carried by a model URL, lowercased. Query/fragment stripped
 *  (signed CDN URLs carry both). Undefined when the URL states none — never guessed. */
export function deliveredFormat(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const path = url.split(/[?#]/)[0];
  const last = path.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return undefined;
  return last.slice(dot + 1).toLowerCase();
}

/**
 * Compare what the provider delivered against the file we are about to write it to.
 * Returns a named reason on a mismatch (or when the delivered format is unknowable),
 * and undefined when they agree. Pure.
 */
export function formatMismatchReason(modelUrl: string | undefined, outputPath: string): string | undefined {
  const want = deliveredFormat(outputPath);
  const got = deliveredFormat(modelUrl);
  if (!got) {
    return `delivered format could not be determined from the model URL — the bytes were written to a ${want ?? 'extension-less'} path without confirming they are ${want ?? 'that format'}`;
  }
  if (!want || got === want) return undefined;
  return `Tripo delivered ${got} but the mesh was written to a .${want} path — the extension misreports the contents (quad topology can change the delivered container); convert it or write it to a .${got} path`;
}

function tripoErr(json: unknown): string {
  const j = json as { code?: number; message?: string; suggestion?: string } | undefined;
  if (j && typeof j.code === 'number') {
    return `Tripo error ${j.code}: ${j.message ?? 'unknown'}${j.suggestion ? ` (${j.suggestion})` : ''}`;
  }
  return 'unexpected Tripo response';
}

/** File extension → the image `type` Tripo expects (jpeg→jpg). Pure. */
export function imageTypeFromPath(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext || 'png';
}

/** Build the POST /task JSON body. Pure. */
export function buildCreateTaskBody(spec: TripoSpec): Record<string, unknown> {
  const opt: Record<string, unknown> = {};
  if (spec.modelVersion) opt.model_version = spec.modelVersion;
  if (spec.faceLimit !== undefined) opt.face_limit = spec.faceLimit;
  if (spec.texture !== undefined) opt.texture = spec.texture;
  if (spec.pbr !== undefined) opt.pbr = spec.pbr;
  if (spec.quad !== undefined) opt.quad = spec.quad;

  if (spec.mode === 'text-to-3d') {
    return { type: 'text_to_model', prompt: spec.prompt ?? '', ...opt };
  }
  const type = spec.imageType ?? (spec.imagePath ? imageTypeFromPath(spec.imagePath) : 'png');
  const file = spec.imageToken
    ? { type, file_token: spec.imageToken }
    : { type, url: spec.imageUrl };
  return { type: 'image_to_model', file, ...opt };
}

export interface ParsedCreate { ok: boolean; taskId?: string; error?: string }

/** Parse POST /task → task id. Pure. */
export function parseTaskCreate(json: unknown): ParsedCreate {
  const j = json as { code?: number; data?: { task_id?: string } } | undefined;
  if (j && j.code === 0 && j.data?.task_id) return { ok: true, taskId: j.data.task_id };
  return { ok: false, error: tripoErr(json) };
}

export type TripoState = 'pending' | 'success' | 'failed';
export interface ParsedStatus {
  state: TripoState;
  status?: string;
  progress?: number;
  modelUrl?: string;
  pbrModelUrl?: string;
  error?: string;
}
const TERMINAL_FAIL = new Set(['failed', 'cancelled', 'banned', 'expired', 'unknown']);

/** Parse GET /task/{id} → normalized state + the download URL. Pure. */
export function parseTaskStatus(json: unknown): ParsedStatus {
  const j = json as { code?: number; data?: { status?: string; progress?: number; output?: Record<string, string> } } | undefined;
  if (!j || j.code !== 0 || !j.data) return { state: 'failed', error: tripoErr(json) };
  const status = String(j.data.status ?? '').toLowerCase();
  const out = j.data.output ?? {};
  const modelUrl = out.pbr_model || out.model || out.base_model;
  if (status === 'success') {
    return { state: 'success', status, progress: 100, modelUrl, pbrModelUrl: out.pbr_model };
  }
  if (TERMINAL_FAIL.has(status)) return { state: 'failed', status, error: `task ${status}` };
  return { state: 'pending', status, progress: typeof j.data.progress === 'number' ? j.data.progress : undefined };
}

export interface ParsedUpload { ok: boolean; imageToken?: string; error?: string }

/** Parse POST /upload → the reusable image token. Pure. */
export function parseUpload(json: unknown): ParsedUpload {
  const j = json as { code?: number; data?: { image_token?: string } } | undefined;
  if (j && j.code === 0 && j.data?.image_token) return { ok: true, imageToken: j.data.image_token };
  return { ok: false, error: tripoErr(json) };
}

export interface TripoHttp {
  postJson: (url: string, headers: Record<string, string>, body: unknown) => Promise<{ status: number; json: unknown }>;
  getJson: (url: string, headers: Record<string, string>) => Promise<{ status: number; json: unknown }>;
  uploadImage: (url: string, headers: Record<string, string>, filePath: string) => Promise<{ status: number; json: unknown }>;
  download: (url: string, destPath: string) => Promise<boolean>;
}

export interface TripoDeps {
  http?: TripoHttp;
  env?: Record<string, string | undefined>;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function terr(message: string, start: number, now: () => number, taskId?: string): TripoResult {
  return { ok: false, error: message, taskId, durationMs: now() - start };
}

/** Run a Tripo cloud generation (text/image → .glb) and return the observed result. */
export async function runTripo(spec: TripoSpec, deps: TripoDeps = {}): Promise<TripoResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const http = deps.http ?? defaultHttp;
  const start = now();

  const key = spec.apiKey ?? env.TRIPO_API_KEY;
  if (!key) return terr('TRIPO_API_KEY not set (get a free key at https://platform.tripo3d.ai)', start, now);
  const auth = { Authorization: `Bearer ${key}` };

  if (spec.mode === 'text-to-3d' && !spec.prompt?.trim()) return terr('text-to-3d needs a prompt', start, now);
  if (spec.mode === 'image-to-3d' && !spec.imagePath && !spec.imageToken && !spec.imageUrl) {
    return terr('image-to-3d needs imagePath, imageToken, or imageUrl', start, now);
  }

  // Upload a local image → token (skipped when a token or public URL is supplied).
  let resolved = spec;
  if (spec.mode === 'image-to-3d' && spec.imagePath && !spec.imageToken && !spec.imageUrl) {
    if (!fileExists(spec.imagePath)) return terr(`image not found: ${spec.imagePath}`, start, now);
    const up = await http.uploadImage(`${TRIPO_BASE}/upload`, auth, spec.imagePath);
    const pu = parseUpload(up.json);
    if (!pu.ok) return terr(`upload failed: ${pu.error}`, start, now);
    resolved = { ...spec, imageToken: pu.imageToken, imageType: spec.imageType ?? imageTypeFromPath(spec.imagePath) };
  }

  const body = buildCreateTaskBody(resolved);
  const created = await http.postJson(`${TRIPO_BASE}/task`, { ...auth, 'Content-Type': 'application/json' }, body);
  const pc = parseTaskCreate(created.json);
  if (!pc.ok) return terr(pc.error ?? 'task creation failed', start, now);
  const taskId = pc.taskId!;

  const pollInterval = spec.pollIntervalMs ?? 4000;
  const maxPoll = spec.maxPollMs ?? 300_000;
  const maxPolls = spec.maxPolls ?? Math.max(1, Math.ceil(maxPoll / pollInterval));
  for (let i = 0; i < maxPolls; i++) {
    const s = await http.getJson(`${TRIPO_BASE}/task/${taskId}`, auth);
    const ps = parseTaskStatus(s.json);
    if (ps.state === 'success') {
      if (!ps.modelUrl) return terr('task succeeded but no model URL in output', start, now, taskId);
      const ok = await http.download(ps.modelUrl, spec.outputPath);
      if (!ok || !fileExists(spec.outputPath)) return terr('model download failed', start, now, taskId);
      return {
        ok: true,
        meshPath: spec.outputPath,
        taskId,
        status: ps.status,
        modelUrl: ps.modelUrl,
        formatMismatch: formatMismatchReason(ps.modelUrl, spec.outputPath),
        durationMs: now() - start,
      };
    }
    if (ps.state === 'failed') return terr(ps.error ?? 'task failed', start, now, taskId);
    if (i < maxPolls - 1) await sleep(pollInterval);
  }
  return terr(`timed out after ${maxPolls} polls (~${maxPoll}ms)`, start, now, taskId);
}

// ── default HTTP seam (not unit-tested; exercised by the live smoke run) ───────
const defaultHttp: TripoHttp = {
  postJson: async (url, headers, body) => {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => undefined) };
  },
  getJson: async (url, headers) => {
    const res = await fetch(url, { headers });
    return { status: res.status, json: await res.json().catch(() => undefined) };
  },
  uploadImage: async (url, headers, filePath) => {
    const { readFile } = await import('node:fs/promises');
    const { basename } = await import('node:path');
    const bytes = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([bytes]), basename(filePath));
    const res = await fetch(url, { method: 'POST', headers, body: form });
    return { status: res.status, json: await res.json().catch(() => undefined) };
  },
  download: async (url, destPath) => {
    const { writeFile } = await import('node:fs/promises');
    const res = await fetch(url);
    if (!res.ok) return false;
    await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
    return true;
  },
};
