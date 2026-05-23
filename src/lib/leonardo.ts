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

export interface GenerateImageOptions {
  modelId?: string;
  width?: number;
  height?: number;
  tiling?: boolean;
  transparency?: 'disabled' | 'foreground';
  contrast?: number;
  numImages?: number;
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
  const trimmedPrompt = prompt.slice(0, 1500);
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;

  const body: Record<string, unknown> = {
    modelId: opts.modelId ?? LUCID_ORIGIN_MODEL_ID,
    prompt: trimmedPrompt,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    num_images: opts.numImages ?? 1,
    contrast: opts.contrast ?? 3.5,
  };
  if (opts.tiling) body.tiling = true;
  if (opts.transparency) body.transparency = opts.transparency;

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
