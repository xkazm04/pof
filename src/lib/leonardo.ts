/**
 * Leonardo AI client — server-side only.
 * Generates images using the Lucid Origin model at low resolution.
 */

import { logger } from '@/lib/logger';
import { pollUntilReady } from '@/lib/visual-gen/poll';

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const LEONARDO_API_BASE_V2 = 'https://cloud.leonardo.ai/api/rest/v2';
const LUCID_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
export const LUCID_REALISM_MODEL_ID = '05ce0082-2d80-4a2d-8653-4d1c85e2418e';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
export const MAX_PROMPT_LENGTH = 1500;

interface GenerationResponse {
  sdGenerationJob: {
    generationId: string;
  };
}

interface PollResponse {
  generations_by_pk: {
    status: string;
    generated_images: { url: string; id: string }[];
  } | null;
}

function getApiKey(): string {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error('LEONARDO_API_KEY not set in environment');
  return key;
}

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${getApiKey()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * A single ControlNet guidance input for `POST /generations`. Field names match
 * Leonardo's documented `controlnets[]` shape (doc-derived; the advanced controls
 * below are key-gated and were not live-verified — only basic `tiling`/
 * `transparency` generation has been smoke-tested. Each capability is isolated so
 * a field-name correction is a one-line change, mirroring scenario.ts).
 */
export interface ControlNetInput {
  /** Id of an uploaded/generated init image to guide from. */
  initImageId: string;
  initImageType?: 'GENERATED' | 'UPLOADED';
  /** Preprocessor id selects the ControlNet type (depth/normal/edge/pose/style/…). */
  preprocessorId: number;
  weight?: number;
  strengthType?: string;
}

/** Inpaint a region of an existing image (Leonardo canvas request). */
export interface InpaintInput {
  /** Id of the base image to inpaint into. */
  initImageId: string;
  /** Id of the mask image marking the region to regenerate. */
  maskImageId?: string;
}

export interface GenerateImageOptions {
  modelId?: string;
  width?: number;
  height?: number;
  tiling?: boolean;
  transparency?: 'disabled' | 'foreground' | 'foreground_only';
  contrast?: number;
  numImages?: number;
  /** ControlNet guidance inputs (depth/normal/edge/pose/style/…). */
  controlnets?: ControlNetInput[];
  /** Inpaint a region of an existing image via a canvas request. */
  inpaint?: InpaintInput;
  /** Download bytes + delete the generation after completion. Default true. */
  cleanup?: boolean;
  /** Poll interval; defaults to POLL_INTERVAL_MS. Lowered in tests. */
  pollIntervalMs?: number;
}

export interface GenerateImageResult {
  imageUrl: string;
  generationId: string;
  /** base64 of the downloaded bytes — present when cleanup ran. */
  imageBase64?: string;
}

/** Start an image generation, poll to completion, optionally download-then-delete. */
export async function generateImage(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`);
  }
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;

  const body: Record<string, unknown> = {
    modelId: opts.modelId ?? LUCID_ORIGIN_MODEL_ID,
    prompt,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    num_images: opts.numImages ?? 1,
    contrast: opts.contrast ?? 3.5,
  };
  if (opts.tiling) body.tiling = true;
  // Leonardo's TransparencyType is 'disabled' | 'foreground_only' — map our historical
  // 'foreground' alias so callers using the documented option don't 400 (API drift fix).
  if (opts.transparency) {
    body.transparency = opts.transparency === 'foreground' ? 'foreground_only' : opts.transparency;
  }
  if (opts.controlnets && opts.controlnets.length > 0) body.controlnets = opts.controlnets;
  if (opts.inpaint) {
    body.init_image_id = opts.inpaint.initImageId;
    body.canvas_request = true;
    body.canvas_request_type = 'INPAINT';
    if (opts.inpaint.maskImageId) body.mask_file_id = opts.inpaint.maskImageId;
  }

  const genRes = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!genRes.ok) {
    const text = await genRes.text();
    throw new Error(`Leonardo generation failed (${genRes.status}): ${text}`);
  }
  const genData = (await genRes.json()) as GenerationResponse;
  const generationId = genData.sdGenerationJob.generationId;
  logger.info(`[leonardo] Generation started: ${generationId}`);

  let pollAttempt = 0;
  const gen = await pollUntilReady<NonNullable<PollResponse['generations_by_pk']>>({
    intervalMs: pollMs,
    maxAttempts: MAX_POLL_ATTEMPTS,
    fetchStatus: async () => {
      const attempt = pollAttempt++;
      const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
        headers: authHeaders(),
      });
      if (!pollRes.ok) {
        logger.warn(`[leonardo] Poll attempt ${attempt + 1} failed (${pollRes.status})`);
        return undefined;
      }
      const pollData = (await pollRes.json()) as PollResponse;
      return pollData.generations_by_pk ?? undefined;
    },
    isDone: (g) => g.status === 'COMPLETE' && g.generated_images.length > 0,
    isFailed: (g) => g.status === 'FAILED',
    onFailed: () => new Error('Leonardo generation failed'),
    onTimeout: () => new Error(`Leonardo generation timed out after ${(MAX_POLL_ATTEMPTS * pollMs) / 1000}s`),
  });

  const imageUrl = gen.generated_images[0].url;
  logger.info(`[leonardo] Generation complete: ${imageUrl}`);
  if (opts.cleanup === false) return { imageUrl, generationId };
  const bytes = await downloadThenDelete(imageUrl, generationId);
  return { imageUrl, generationId, imageBase64: Buffer.from(bytes).toString('base64') };
}

/**
 * Leonardo video models (project policy): text-to-video uses **hailuo-2_3**;
 * image-to-video (start frame) uses **hailuo-2_3-fast**. Both are on the v2
 * `/generations` endpoint; image-to-video adds `parameters.guidances.start_frame`.
 */
export const LEONARDO_VIDEO_MODELS = {
  hailuo23: 'hailuo-2_3', // text-to-video
  hailuo23Fast: 'hailuo-2_3-fast', // image-to-video (start frame)
} as const;

export interface GenerateVideoOptions {
  /** Override the model. Default: hailuo-2_3 (T2V) / hailuo-2_3-fast (I2V). */
  model?: string;
  durationSeconds?: number; // default 6
  width?: number; // default 1376
  height?: number; // default 768
  promptEnhance?: boolean; // default false
  audio?: boolean; // default false
  /** Download bytes + delete the generation after completion. Default true. */
  cleanup?: boolean;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface GenerateVideoResult {
  videoUrl: string;
  generationId: string;
  /** base64 of the downloaded mp4 — present when cleanup ran. */
  videoBase64?: string;
}

interface VideoPollRecord {
  status: string;
  generated_images: { motionMP4URL?: string; id: string }[];
}

/** Pull the rendered mp4 url out of a Leonardo motion-generation poll record (field name varies). */
function extractVideoUrl(g: VideoPollRecord): string | null {
  const direct = g.generated_images?.find((i) => i.motionMP4URL)?.motionMP4URL;
  if (direct) return direct;
  const m = JSON.stringify(g ?? {}).match(/https?:\/\/[^"']+\.mp4[^"']*/);
  return m ? m[0] : null;
}

/** Poll a video generation (v1 generations/{id}) to COMPLETE with a downloadable mp4. */
async function pollVideo(generationId: string, pollMs: number, maxAttempts: number): Promise<VideoPollRecord> {
  let attempt = 0;
  return pollUntilReady<VideoPollRecord>({
    intervalMs: pollMs,
    maxAttempts,
    fetchStatus: async () => {
      attempt++;
      const r = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, { headers: authHeaders() });
      if (!r.ok) {
        logger.warn(`[leonardo] video poll ${attempt} -> ${r.status}`);
        return undefined;
      }
      const d = (await r.json()) as { generations_by_pk: VideoPollRecord | null };
      return d.generations_by_pk ?? undefined;
    },
    isDone: (g) => g.status === 'COMPLETE' && extractVideoUrl(g) !== null,
    isFailed: (g) => g.status === 'FAILED',
    onFailed: () => new Error('Leonardo video generation failed'),
    onTimeout: () => new Error('Leonardo video generation timed out'),
  });
}

/**
 * Shared v2 video submit: create -> `{ generate: { generationId } }`, poll v1
 * generations/{id} to COMPLETE, then download-then-delete. Confirmed live 2026-06-23.
 */
async function submitV2Video(
  model: string,
  parameters: Record<string, unknown>,
  opts: GenerateVideoOptions,
): Promise<GenerateVideoResult> {
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = opts.maxPollAttempts ?? 90;
  const res = await fetch(`${LEONARDO_API_BASE_V2}/generations`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ model, public: false, parameters }),
  });
  if (!res.ok) throw new Error(`Leonardo video generation failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { generate?: { generationId?: string } };
  const generationId = data.generate?.generationId;
  if (!generationId) throw new Error('Leonardo video generation returned no generationId');
  logger.info(`[leonardo] Video generation started: ${generationId} (${model})`);
  const gen = await pollVideo(generationId, pollMs, maxAttempts);
  const videoUrl = extractVideoUrl(gen)!;
  if (opts.cleanup === false) return { videoUrl, generationId };
  const bytes = await downloadThenDelete(videoUrl, generationId);
  return { videoUrl, generationId, videoBase64: Buffer.from(bytes).toString('base64') };
}

/** Common Hailuo `parameters` block shared by T2V and I2V. */
function hailuoParams(prompt: string, opts: GenerateVideoOptions): Record<string, unknown> {
  return {
    prompt,
    duration: opts.durationSeconds ?? 6,
    prompt_enhance: opts.promptEnhance ? 'ON' : 'OFF',
    quantity: 1,
    width: opts.width ?? 1376,
    height: opts.height ?? 768,
    audio: opts.audio ?? false,
  };
}

/**
 * Text-to-video via Hailuo 2.3 (v2 /generations). ~180 credits for a 6s clip.
 * Honors the download-then-delete cleanup protocol.
 */
export async function generateVideo(prompt: string, opts: GenerateVideoOptions = {}): Promise<GenerateVideoResult> {
  return submitV2Video(opts.model ?? LEONARDO_VIDEO_MODELS.hailuo23, hailuoParams(prompt, opts), opts);
}

export interface GenerateVideoFromImageOptions extends GenerateVideoOptions {
  /** GENERATED (a Leonardo-generated image id) or UPLOADED (an init-image upload). Default GENERATED. */
  imageType?: 'GENERATED' | 'UPLOADED';
}

/**
 * Image-to-video via Hailuo 2.3 Fast (v2 /generations + `guidances.start_frame`) —
 * animate a start frame. Cheaper + more controllable than text-to-video (generate one
 * image, then drive the motion). Same v2 submit + download-then-delete cleanup.
 */
export async function generateVideoFromImage(
  imageId: string,
  prompt: string,
  opts: GenerateVideoFromImageOptions = {},
): Promise<GenerateVideoResult> {
  const parameters = {
    ...hailuoParams(prompt, opts),
    guidances: { start_frame: [{ image: { id: imageId, type: opts.imageType ?? 'GENERATED' } }] },
  };
  return submitV2Video(opts.model ?? LEONARDO_VIDEO_MODELS.hailuo23Fast, parameters, opts);
}

export interface StartFrameOptions {
  model?: string; // default gpt-image-2
  width?: number; // default 1376 (match the I2V clip)
  height?: number; // default 768
  promptEnhance?: boolean;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface StartFrameResult {
  imageId: string;
  generationId: string;
  imageUrl: string;
}

/**
 * Generate an I2V start frame via GPT Image 2 (v2 /generations). Returns the
 * generated image id (for `generateVideoFromImage`'s `start_frame`) — does NOT
 * delete, since the image is consumed downstream; the caller cleans it up. (~66 credits.)
 */
export async function generateStartFrame(prompt: string, opts: StartFrameOptions = {}): Promise<StartFrameResult> {
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = opts.maxPollAttempts ?? MAX_POLL_ATTEMPTS;
  const res = await fetch(`${LEONARDO_API_BASE_V2}/generations`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      model: opts.model ?? 'gpt-image-2',
      public: false,
      parameters: {
        prompt,
        quantity: 1,
        width: opts.width ?? 1376,
        height: opts.height ?? 768,
        prompt_enhance: opts.promptEnhance ? 'ON' : 'OFF',
      },
    }),
  });
  if (!res.ok) throw new Error(`Leonardo start-frame generation failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { generate?: { generationId?: string } };
  const generationId = data.generate?.generationId;
  if (!generationId) throw new Error('Leonardo start-frame generation returned no generationId');
  type ImgRecord = { status: string; generated_images: { url: string; id: string }[] };
  const gen = await pollUntilReady<ImgRecord>({
    intervalMs: pollMs,
    maxAttempts,
    fetchStatus: async () => {
      const r = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, { headers: authHeaders() });
      if (!r.ok) return undefined;
      const d = (await r.json()) as { generations_by_pk: ImgRecord | null };
      return d.generations_by_pk ?? undefined;
    },
    isDone: (g) => g.status === 'COMPLETE' && g.generated_images.length > 0,
    isFailed: (g) => g.status === 'FAILED',
    onFailed: () => new Error('Leonardo start-frame generation failed'),
    onTimeout: () => new Error('Leonardo start-frame generation timed out'),
  });
  const img = gen.generated_images[0];
  return { imageId: img.id, generationId, imageUrl: img.url };
}

export interface GenerateVideoFromPromptOptions extends GenerateVideoFromImageOptions {
  /** Prompt for the start frame; defaults to the motion prompt. */
  framePrompt?: string;
  /** Start-frame image model. Default gpt-image-2. */
  frameModel?: string;
}

/**
 * One-call prompt → video via image-to-video: generate a GPT Image 2 start frame,
 * animate it with Hailuo 2.3 Fast, and clean up BOTH generations. The cheapest +
 * most controllable path (a sharp full-body start frame, then ~128-credit motion).
 */
export async function generateVideoFromPrompt(
  prompt: string,
  opts: GenerateVideoFromPromptOptions = {},
): Promise<GenerateVideoResult> {
  const frame = await generateStartFrame(opts.framePrompt ?? prompt, {
    model: opts.frameModel,
    width: opts.width,
    height: opts.height,
  });
  try {
    return await generateVideoFromImage(frame.imageId, prompt, { ...opts, imageType: 'GENERATED' });
  } finally {
    await deleteGeneration(frame.generationId); // start frame is consumed — clean it up
  }
}

/** Remove a generation from the Leonardo account (the local copy is the only retained one). */
export async function deleteGeneration(generationId: string): Promise<void> {
  const res = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    logger.warn(`[leonardo] deleteGeneration ${generationId} returned ${res.status}`);
    return;
  }
  logger.info(`[leonardo] Deleted generation ${generationId}`);
}

/**
 * Download an image's bytes, then delete its generation. The returned bytes are
 * the only retained copy — enforces the download-then-delete protocol.
 */
export async function downloadThenDelete(imageUrl: string, generationId: string): Promise<Uint8Array> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Leonardo image download failed (${imgRes.status})`);
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  await deleteGeneration(generationId);
  return bytes;
}

/**
 * Universal Upscaler. The exact response key is endpoint-version-dependent;
 * parse the common candidates and surface the job id.
 */
export async function upscaleImage(
  generatedImageId: string,
  style: string = 'GENERAL',
): Promise<{ upscaleJobId: string }> {
  const res = await fetch(`${LEONARDO_API_BASE}/universal-upscaler`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ generatedImageId, upscalerStyle: style }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Leonardo upscale failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    universalUpscaler?: { id?: string };
    sdUpscaleJob?: { id?: string };
  };
  const upscaleJobId = data.universalUpscaler?.id ?? data.sdUpscaleJob?.id;
  if (!upscaleJobId) throw new Error('Leonardo upscale returned no job id');
  return { upscaleJobId };
}

export interface UnzoomOptions {
  /** Optional prompt describing what to paint into the extended border region. */
  prompt?: string;
}

/**
 * Unzoom (outpaint) a previously-generated image — extends it beyond its borders.
 * Leonardo exposes this as a variation job (`POST /variations/unzoom`); the result
 * is fetched later via the variations API. Returns the variation job id.
 */
export async function unzoomImage(
  generatedImageId: string,
  opts: UnzoomOptions = {},
): Promise<{ unzoomJobId: string }> {
  const body: Record<string, unknown> = { id: generatedImageId, isVariation: false };
  if (opts.prompt) body.prompt = opts.prompt;
  const res = await fetch(`${LEONARDO_API_BASE}/variations/unzoom`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Leonardo unzoom failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    sdUnzoomJob?: { id?: string };
    sdVariationJob?: { id?: string };
  };
  const unzoomJobId = data.sdUnzoomJob?.id ?? data.sdVariationJob?.id;
  if (!unzoomJobId) throw new Error('Leonardo unzoom returned no job id');
  return { unzoomJobId };
}

export interface Texture3DRequest {
  objBytes: Uint8Array;
  prompt: string;
  preview?: boolean;
  pollIntervalMs?: number;
}

export interface Texture3DResult {
  modelAssetId: string;
  albedoUrl: string;
  normalUrl?: string;
  roughnessUrl?: string;
}

/**
 * Texture a UV-mapped OBJ via Leonardo's 3D pipeline:
 *   1. POST /models-3d/upload { name, modelExtension: 'obj' } -> presigned S3
 *      POST (modelUrl + modelFields) + modelId.
 *   2. multipart/form-data POST the OBJ to the S3 modelUrl (fields + file last).
 *   3. POST /generations-texture { modelId, prompt, preview } -> job id.
 *   4. poll GET /generations-texture/{id} -> PBR maps; then delete the model.
 *
 * NOTE (verified live 2026-05-23): step 3's create endpoint currently returns
 * 404 — Leonardo's public API supports 3D model UPLOAD + retrieval/deletion but
 * NOT PBR texture generation. This function therefore throws a clear error at
 * step 3 against the live API; the upload (steps 1-2) is real and works.
 */
export async function generateTextureOn3DModel(req: Texture3DRequest): Promise<Texture3DResult> {
  const pollMs = req.pollIntervalMs ?? POLL_INTERVAL_MS;

  // 1. init upload
  const upRes = await fetch(`${LEONARDO_API_BASE}/models-3d/upload`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ name: 'arena', modelExtension: 'obj' }),
  });
  if (!upRes.ok) throw new Error(`Leonardo 3D upload init failed (${upRes.status})`);
  const upData = (await upRes.json()) as {
    uploadModelAsset?: { modelId?: string; modelUrl?: string; modelFields?: string };
  };
  const asset = upData.uploadModelAsset;
  const modelAssetId = asset?.modelId;
  if (!modelAssetId || !asset?.modelUrl || !asset?.modelFields) {
    throw new Error('Leonardo 3D upload returned no presigned S3 POST');
  }

  // The model asset now exists on the account — from here on, any failure must
  // still delete it (cleanup protocol), so steps 2-4 run inside the try/finally.
  try {
    // 2. S3 presigned multipart POST (fields first, file last)
    const fields = JSON.parse(asset.modelFields) as Record<string, string>;
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([req.objBytes as unknown as BlobPart]), 'mesh.obj');
    const s3Res = await fetch(asset.modelUrl, { method: 'POST', body: form });
    if (!s3Res.ok && s3Res.status !== 204) throw new Error(`Leonardo OBJ S3 upload failed (${s3Res.status})`);

    // 3. start the texture-generation job
    const startRes = await fetch(`${LEONARDO_API_BASE}/generations-texture`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ modelId: modelAssetId, prompt: req.prompt, preview: req.preview ?? false }),
    });
    if (startRes.status === 404) {
      throw new Error(
        'Leonardo 3D texture-generation is not available: POST /generations-texture returned 404. ' +
        'The current public API supports 3D model upload + retrieval but not PBR texture generation.',
      );
    }
    if (!startRes.ok) throw new Error(`Leonardo texture job start failed (${startRes.status})`);
    const startData = (await startRes.json()) as { textureGenerationJob?: { id?: string } };
    const jobId = startData.textureGenerationJob?.id;
    if (!jobId) throw new Error('Leonardo texture job returned no id');

    // 4. poll for the PBR maps
    type TextureGen = { status?: string; albedo?: string; normal?: string; roughness?: string };
    const t = await pollUntilReady<TextureGen>({
      intervalMs: pollMs,
      maxAttempts: MAX_POLL_ATTEMPTS,
      fetchStatus: async () => {
        const pollRes = await fetch(`${LEONARDO_API_BASE}/generations-texture/${jobId}`, {
          headers: authHeaders(),
        });
        if (!pollRes.ok) return undefined;
        const data = (await pollRes.json()) as { texture_generation?: TextureGen };
        return data.texture_generation ?? undefined;
      },
      isDone: (tg) => tg.status === 'COMPLETE' && !!tg.albedo,
      isFailed: (tg) => tg.status === 'FAILED',
      onFailed: () => new Error('Leonardo texture generation failed'),
      onTimeout: () => new Error('Leonardo texture generation timed out'),
    });
    return { modelAssetId, albedoUrl: t.albedo!, normalUrl: t.normal, roughnessUrl: t.roughness };
  } finally {
    // Cleanup: delete the uploaded model asset (mirrors the cleanup protocol).
    const del = await fetch(`${LEONARDO_API_BASE}/models-3d/${modelAssetId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (!del.ok) logger.warn(`[leonardo] model asset ${modelAssetId} delete returned ${del.status}`);
  }
}
