/**
 * Vision-model seam for animation critique: Qwen-VL via the OpenAI-compatible
 * DashScope (Alibaba Model Studio, intl endpoint) API. Drop-in alternative to
 * gemini.ts — same `(images, prompt) => Promise<string>` seam — so the loop can
 * run Gemini-free. `qwen3.7-plus` is a THINKING VL model: it returns its
 * chain-of-thought in `reasoning_content` and the answer in `content`; we use
 * `content` only (the prompt forces JSON; parse.ts strips any fences).
 *
 * QUOTA FALLBACK: the free tier is 1M tokens / 90 days. When the primary model
 * hits its quota (HTTP 429 / "quota" markers), we transparently fall back to the
 * other models — different models have separate quota — so the loop keeps running.
 * Uses fetch (no SDK dep) — the endpoint is OpenAI-compatible.
 */
import type { VisionImage } from './critique';

export interface QwenVisionOptions {
  apiKey?: string;
  /** Primary model; default qwen3.7-plus, or $QWEN_CRITIQUE_MODEL. */
  model?: string;
  /**
   * Quota-exceeded fallback chain, tried in order when the primary hits its quota.
   * Unset → $QWEN_CRITIQUE_FALLBACKS, else DEFAULT_FALLBACKS.
   */
  fallbackModels?: string[];
  /** Override the base URL; default the intl DashScope endpoint, or $QWEN_BASE_URL. */
  baseUrl?: string;
}

const DEFAULT_BASE = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_FALLBACKS = ['qwen3.6-flash', 'qwen3.6-plus'];
// DashScope signals quota/throttle via HTTP 429 or these markers in the error body.
const QUOTA_MARKERS = /quota|arrearage|exceed|insufficient|throttl|rate.?limit|too many requests|allocated|free.?tier/i;

/**
 * Is this DashScope failure a quota/throttle (→ retry the next model, which has its
 * own quota) rather than a real error (→ fail fast)? Pure; shared with the
 * Qwen-Image generation runner so both sides classify failures identically.
 */
export function isQuotaError(status: number, body: string): boolean {
  return status === 429 || QUOTA_MARKERS.test(body);
}

/**
 * Parse a `QWEN_CRITIQUE_FALLBACKS` value into a chain. Pure.
 * Unset/blank → undefined (caller keeps its default); `none` → [] (primary only).
 */
export function parseFallbackModels(raw: string | undefined): string[] | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'none') return [];
  const models = trimmed.split(',').map((m) => m.trim()).filter(Boolean);
  return models.length > 0 ? models : undefined;
}

export function makeQwenVision(opts: QwenVisionOptions = {}) {
  const apiKey = opts.apiKey ?? process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY;
  const primary = opts.model ?? process.env.QWEN_CRITIQUE_MODEL ?? 'qwen3.7-plus';
  // Explicit opt wins, then the env override, then the hardcoded lineage — so a new
  // Qwen VL tier can be promoted/re-tiered by config, without touching this file.
  const fallbacks =
    opts.fallbackModels ?? parseFallbackModels(process.env.QWEN_CRITIQUE_FALLBACKS) ?? DEFAULT_FALLBACKS;
  // primary first, then any fallbacks not already the primary (dedup).
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];
  const baseUrl = (opts.baseUrl ?? process.env.QWEN_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');

  return async (images: VisionImage[], prompt: string): Promise<string> => {
    if (!apiKey) throw new Error('QWEN_API_KEY (or DASHSCOPE_API_KEY) not set');
    // OpenAI vision format: data-URI image_url blocks + one text block.
    const content = [
      ...images.map((img) => ({
        type: 'image_url' as const,
        image_url: { url: `data:${img.mime};base64,${img.base64}` },
      })),
      { type: 'text' as const, text: prompt },
    ];

    let lastErr = '';
    for (const model of models) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.2, max_tokens: 4096 }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = json.choices?.[0]?.message?.content;
        if (text) return text;
        lastErr = `empty response from ${model}`;
        continue; // empty -> try the next model
      }
      const body = await res.text().catch(() => '');
      lastErr = `Qwen ${model} HTTP ${res.status}: ${body.slice(0, 200)}`;
      if (!isQuotaError(res.status, body)) throw new Error(lastErr); // real error -> don't burn the fallbacks
      // quota/throttle -> fall through to the next model (separate quota)
    }
    throw new Error(`all Qwen models exhausted. last: ${lastErr}`);
  };
}
