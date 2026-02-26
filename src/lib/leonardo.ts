/**
 * Leonardo AI client — server-side only.
 * Generates images using the Lucid Origin model at low resolution.
 */

import { logger } from '@/lib/logger';

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const LUCID_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start an image generation and poll until complete.
 * Returns the URL of the first generated image.
 */
export async function generateImage(prompt: string): Promise<{ imageUrl: string; generationId: string }> {
  const apiKey = getApiKey();
  const trimmedPrompt = prompt.slice(0, 1500);

  // Start generation
  const genRes = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId: LUCID_ORIGIN_MODEL_ID,
      prompt: trimmedPrompt,
      width: 512,
      height: 512,
      num_images: 1,
      contrast: 3.5,
    }),
  });

  if (!genRes.ok) {
    const text = await genRes.text();
    throw new Error(`Leonardo generation failed (${genRes.status}): ${text}`);
  }

  const genData = (await genRes.json()) as GenerationResponse;
  const generationId = genData.sdGenerationJob.generationId;

  logger.info(`[leonardo] Generation started: ${generationId}`);

  // Poll for completion
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
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
      return { imageUrl, generationId };
    }

    if (gen?.status === 'FAILED') {
      throw new Error('Leonardo generation failed');
    }
  }

  throw new Error(`Leonardo generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}
