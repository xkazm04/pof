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
  const gen = await deleteIfThrows(generationId, opts.cleanup !== false, () => pollUntilReady<NonNullable<PollResponse['generations_by_pk']>>({
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
  }));

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
  const gen = await deleteIfThrows(generationId, opts.cleanup !== false, () => pollVideo(generationId, pollMs, maxAttempts));
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
  // On a failed/timed-out poll the caller never receives the id, so it cannot clean up — delete here.
  const gen = await deleteIfThrows(generationId, true, () => pollUntilReady<ImgRecord>({
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
  }));
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
  const bytes = await deleteIfThrows(generationId, true, async () => {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Leonardo image download failed (${imgRes.status})`);
    return new Uint8Array(await imgRes.arrayBuffer());
  });
  await deleteGeneration(generationId);
  return bytes;
}

/**
 * Run `step`; if it throws after the generation exists, delete the generation (when
 * `enabled`) and rethrow the ORIGINAL error. Keeps download-then-delete true on every
 * exit (poll timeout, FAILED, failed download), not only the happy path. A failing
 * delete is logged, never allowed to mask the step's error.
 */
async function deleteIfThrows<T>(generationId: string, enabled: boolean, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (err) {
    if (enabled) {
      try {
        await deleteGeneration(generationId);
      } catch (delErr) {
        logger.warn(`[leonardo] cleanup delete of ${generationId} failed: ${String(delErr)}`);
      }
    }
    throw err;
  }
}

/** Variation jobs (upscale above all) outlast an image generation; 2 minutes at the default interval. */
const MAX_VARIATION_POLL_ATTEMPTS = 60;

/**
 * The source of an upscale or unzoom must be a live Leonardo image, and every generation PoF
 * makes is deleted right after download. Leonardo's refusal alone would not tell the operator
 * why an id from a PoF run stopped working.
 */
const LIVE_IMAGE_ID_HINT =
  'The image id must still exist on the Leonardo account: PoF deletes its own generations after download, so ids from PoF runs no longer resolve.';

export interface VariationPollOptions {
  /** Library seams, lowered in tests. Never forwarded from a request. */
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface VariationImageResult {
  /** Leonardo's URL for the result. Dead once the variation is deleted; use `imageBase64`. */
  imageUrl: string;
  variationId: string;
  /** base64 of the downloaded bytes: the only retained copy. */
  imageBase64: string;
  /** False when Leonardo refused the delete, so the variation is still on the account. */
  variationDeleted: boolean;
}

interface VariationPollResponse {
  generated_image_variation_generic?: { status?: string; url?: string | null }[];
}
type VariationSnapshot = NonNullable<VariationPollResponse['generated_image_variation_generic']>[number];

/**
 * Never throws: the outcome is a value because a failed cleanup must not cost the caller the
 * bytes. UNVERIFIED ROUTE: Leonardo's SDK (4.21.3) publishes no variation delete; this is the
 * best guess, and `variationDeleted: false` is how a refusal reaches the operator.
 */
async function deleteVariation(variationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${LEONARDO_API_BASE}/variations/${variationId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) return true;
    logger.warn(`[leonardo] deleteVariation ${variationId} returned ${res.status}`);
  } catch (err) {
    logger.warn(`[leonardo] deleteVariation ${variationId} failed: ${String(err)}`);
  }
  return false;
}

/** Poll a variation to completion, download it, and delete it on every exit. */
async function collectVariation(
  variationId: string,
  label: string,
  opts: VariationPollOptions,
): Promise<VariationImageResult> {
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = opts.maxPollAttempts ?? MAX_VARIATION_POLL_ATTEMPTS;
  let imageUrl: string;
  let bytes: Uint8Array;
  try {
    const variation = await pollUntilReady<VariationSnapshot>({
      intervalMs: pollMs,
      maxAttempts,
      fetchStatus: async () => {
        const res = await fetch(`${LEONARDO_API_BASE}/variations/${variationId}`, { headers: authHeaders() });
        if (!res.ok) return undefined;
        const data = (await res.json()) as VariationPollResponse;
        return data.generated_image_variation_generic?.[0];
      },
      isDone: (v) => v.status === 'COMPLETE' && !!v.url,
      isFailed: (v) => v.status === 'FAILED',
      onFailed: () => new Error(`Leonardo ${label} failed`),
      onTimeout: () => new Error(`Leonardo ${label} timed out after ${(maxAttempts * pollMs) / 1000}s`),
    });
    imageUrl = variation.url!;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Leonardo ${label} download failed (${imgRes.status})`);
    bytes = new Uint8Array(await imgRes.arrayBuffer());
  } catch (err) {
    if (await deleteVariation(variationId)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${message} (variation ${variationId} is still on the Leonardo account: its delete failed)`, { cause: err });
  }
  const variationDeleted = await deleteVariation(variationId);
  return { imageUrl, variationId, imageBase64: Buffer.from(bytes).toString('base64'), variationDeleted };
}

/** POST a variation job; nothing exists on the account until this returns an id. */
async function startVariation(path: string, label: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${LEONARDO_API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const hint = [400, 404, 422].includes(res.status) ? ` ${LIVE_IMAGE_ID_HINT}` : '';
    throw new Error(`Leonardo ${label} failed (${res.status}): ${text}.${hint}`);
  }
  return res.json();
}

/** Universal Upscaler: upscale a live Leonardo image, download the result, delete the variation. */
export async function upscaleImage(
  generatedImageId: string,
  style: string = 'GENERAL',
  opts: VariationPollOptions = {},
): Promise<VariationImageResult> {
  const data = (await startVariation('/variations/universal-upscaler', 'upscale', {
    generatedImageId,
    upscalerStyle: style,
  })) as { universalUpscaler?: { id?: string } };
  const variationId = data.universalUpscaler?.id;
  if (!variationId) throw new Error('Leonardo upscale returned no job id');
  return collectVariation(variationId, 'upscale', opts);
}

export interface UnzoomOptions extends VariationPollOptions {
  /** Optional prompt describing what to paint into the extended border region. */
  prompt?: string;
}

/** Unzoom (outpaint) a live Leonardo image, download the result, delete the variation. */
export async function unzoomImage(
  generatedImageId: string,
  opts: UnzoomOptions = {},
): Promise<VariationImageResult> {
  const body: Record<string, unknown> = { id: generatedImageId, isVariation: false };
  if (opts.prompt) body.prompt = opts.prompt;
  const data = (await startVariation('/variations/unzoom', 'unzoom', body)) as { sdUnzoomJob?: { id?: string } };
  const variationId = data.sdUnzoomJob?.id;
  if (!variationId) throw new Error('Leonardo unzoom returned no job id');
  return collectVariation(variationId, 'unzoom', opts);
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
