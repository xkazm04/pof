/**
 * Qwen-Image cloud 2D runner — a text-to-image route next to the Leonardo
 * (`scripts/visual-gen/pof_leonardo.mjs`) front of the pipeline.
 *
 * Why add it: Qwen-Image 3.0's stated strength is the one thing the Leonardo
 * `gpt-image-2` front is weakest at — READABLE TEXT IN THE IMAGE (down to ~10px,
 * 12 languages, 20+ fonts) and multi-layer UI / infographic layouts in a single
 * pass. That maps onto the UI-facing catalog steps (icon sets, HUD mockups,
 * labelled sheets) rather than onto character concepts, where Leonardo stays the
 * keeper. It also reuses `QWEN_API_KEY` — the SAME DashScope account as the
 * Qwen-VL recognition seam (`src/lib/anim-critique/qwen.ts`), but a DIFFERENT
 * endpoint and a SEPARATE per-model quota, so generation spend never eats the
 * critique/gate budget.
 *
 * NOT a recognition model: the `qwen-image-*` family is generation + editing only
 * (no VQA). Recognition stays on `makeQwenVision`.
 *
 * Same testability shape as `tripo-runner.ts`: pure cores (body builder + response
 * parser) plus an injectable HTTP/fs seam, so the generate→download→write
 * orchestration is unit-tested without the network, credits, or disk.
 */
import { isQuotaError } from '@/lib/anim-critique/qwen';

export const QWEN_IMAGE_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';
export const QWEN_IMAGE_ENDPOINT = `${QWEN_IMAGE_BASE}/services/aigc/multimodal-generation/generation`;
/** Strongest text-rendering / semantic-adherence tier of the Qwen-Image family. */
export const DEFAULT_QWEN_IMAGE_MODEL = 'qwen-image-2.0-pro';
/** Each model carries its own quota — same separate-quota assumption as the VL chain. */
export const DEFAULT_QWEN_IMAGE_FALLBACKS = ['qwen-image-max', 'qwen-image-plus'];

export interface QwenImageSpec {
  prompt: string;
  /** Full output path; DashScope returns a PNG. */
  outputPath: string;
  model?: string;
  /** Quota-exceeded chain; unset → DEFAULT_QWEN_IMAGE_FALLBACKS. */
  fallbackModels?: string[];
  negativePrompt?: string;
  /** e.g. '1328*1328'; unset → the model default. */
  size?: string;
  /** Let the model enrich a short prompt. Default true (DashScope default). */
  promptExtend?: boolean;
  watermark?: boolean;
  apiKey?: string;
}

export interface QwenImageResult {
  ok: boolean;
  error?: string;
  imagePath?: string;
  imageUrl?: string;
  /** Which model in the chain actually produced the image. */
  model?: string;
  durationMs: number;
}

export interface QwenImageDeps {
  fetch: typeof globalThis.fetch;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  now: () => number;
  env?: Record<string, string | undefined>;
}

interface QwenImageBody {
  model: string;
  input: { messages: { role: 'user'; content: { text: string }[] }[] };
  parameters: Record<string, unknown>;
}

/** Build the DashScope multimodal-generation request body. Pure. */
export function buildQwenImageBody(spec: QwenImageSpec, model: string): QwenImageBody {
  const parameters: Record<string, unknown> = {};
  if (spec.size) parameters.size = spec.size;
  if (spec.negativePrompt) parameters.negative_prompt = spec.negativePrompt;
  if (spec.promptExtend !== undefined) parameters.prompt_extend = spec.promptExtend;
  if (spec.watermark !== undefined) parameters.watermark = spec.watermark;
  return {
    model,
    input: { messages: [{ role: 'user', content: [{ text: spec.prompt }] }] },
    parameters,
  };
}

/** Pull the generated image URL out of the response envelope. Pure. */
export function parseImageUrl(json: unknown): string | undefined {
  const choices = (json as { output?: { choices?: { message?: { content?: { image?: string }[] } }[] } })?.output
    ?.choices;
  for (const choice of choices ?? []) {
    for (const part of choice.message?.content ?? []) {
      if (typeof part.image === 'string' && part.image) return part.image;
    }
  }
  return undefined;
}

async function defaultWriteFile(path: string, data: Uint8Array): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/**
 * Generate one image and write it to `spec.outputPath`. Never throws and never
 * writes a partial file: a failure comes back as `{ ok: false, error }` with the
 * reason, so a Produce step can surface it (catalog Rule 4).
 */
export async function runQwenImage(spec: QwenImageSpec, deps?: Partial<QwenImageDeps>): Promise<QwenImageResult> {
  const d: QwenImageDeps = {
    fetch: deps?.fetch ?? globalThis.fetch,
    writeFile: deps?.writeFile ?? defaultWriteFile,
    now: deps?.now ?? Date.now,
    env: deps?.env ?? process.env,
  };
  const started = d.now();
  const done = (r: Omit<QwenImageResult, 'durationMs'>): QwenImageResult => ({ ...r, durationMs: d.now() - started });

  const apiKey = spec.apiKey || d.env?.QWEN_API_KEY || d.env?.DASHSCOPE_API_KEY;
  if (!apiKey) return done({ ok: false, error: 'QWEN_API_KEY (or DASHSCOPE_API_KEY) not set' });

  const primary = spec.model ?? DEFAULT_QWEN_IMAGE_MODEL;
  const fallbacks = spec.fallbackModels ?? DEFAULT_QWEN_IMAGE_FALLBACKS;
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];

  let lastErr = '';
  for (const model of models) {
    const res = await d.fetch(QWEN_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildQwenImageBody(spec, model)),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      lastErr = `Qwen-Image ${model} HTTP ${res.status}: ${body.slice(0, 200)}`;
      // A real error must not burn the rest of the chain; only quota falls through.
      if (!isQuotaError(res.status, body)) return done({ ok: false, error: lastErr });
      continue;
    }

    const url = parseImageUrl(await res.json());
    if (!url) {
      lastErr = `no image in the ${model} response`;
      continue;
    }

    const img = await d.fetch(url);
    if (!img.ok) {
      return done({ ok: false, error: `image download failed: HTTP ${img.status}`, imageUrl: url, model });
    }
    await d.writeFile(spec.outputPath, new Uint8Array(await img.arrayBuffer()));
    return done({ ok: true, imagePath: spec.outputPath, imageUrl: url, model });
  }

  return done({ ok: false, error: `all Qwen-Image models exhausted. last: ${lastErr}` });
}
