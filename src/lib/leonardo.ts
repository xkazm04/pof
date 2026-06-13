/**
 * Leonardo AI client — server-side only.
 * Generates images using the Lucid Origin model at low resolution.
 */

import { logger } from '@/lib/logger';

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(pollMs);
    const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: authHeaders(),
    });
    if (!pollRes.ok) {
      logger.warn(`[leonardo] Poll attempt ${attempt + 1} failed (${pollRes.status})`);
      continue;
    }
    const pollData = (await pollRes.json()) as PollResponse;
    const gen = pollData.generations_by_pk;
    if (gen?.status === 'COMPLETE' && gen.generated_images.length > 0) {
      const imageUrl = gen.generated_images[0].url;
      logger.info(`[leonardo] Generation complete: ${imageUrl}`);
      if (opts.cleanup === false) return { imageUrl, generationId };
      const bytes = await downloadThenDelete(imageUrl, generationId);
      return { imageUrl, generationId, imageBase64: Buffer.from(bytes).toString('base64') };
    }
    if (gen?.status === 'FAILED') throw new Error('Leonardo generation failed');
  }
  throw new Error(`Leonardo generation timed out after ${(MAX_POLL_ATTEMPTS * pollMs) / 1000}s`);
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
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(pollMs);
      const pollRes = await fetch(`${LEONARDO_API_BASE}/generations-texture/${jobId}`, {
        headers: authHeaders(),
      });
      if (!pollRes.ok) continue;
      const data = (await pollRes.json()) as {
        texture_generation?: { status?: string; albedo?: string; normal?: string; roughness?: string };
      };
      const t = data.texture_generation;
      if (t?.status === 'COMPLETE' && t.albedo) {
        return { modelAssetId, albedoUrl: t.albedo, normalUrl: t.normal, roughnessUrl: t.roughness };
      }
      if (t?.status === 'FAILED') throw new Error('Leonardo texture generation failed');
    }
    throw new Error('Leonardo texture generation timed out');
  } finally {
    // Cleanup: delete the uploaded model asset (mirrors the cleanup protocol).
    const del = await fetch(`${LEONARDO_API_BASE}/models-3d/${modelAssetId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (!del.ok) logger.warn(`[leonardo] model asset ${modelAssetId} delete returned ${del.status}`);
  }
}
