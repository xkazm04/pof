/**
 * Vision-model seam for animation critique: Qwen-VL via the OpenAI-compatible
 * DashScope (Alibaba Model Studio, intl endpoint) API. Drop-in alternative to
 * gemini.ts — same `(images, prompt) => Promise<string>` seam — so the loop can
 * run Gemini-free. Several of these are THINKING VL models: they return their
 * chain-of-thought in `reasoning_content` and the answer in `content`; we use
 * `content` only (the prompt forces JSON; parse.ts strips any fences).
 *
 * QUOTA FALLBACK: the free tier is 1M tokens / 90 days. When the primary model
 * hits its quota (HTTP 429 / "quota" markers), we transparently fall back to the
 * other models — different models have separate quota — so the loop keeps running.
 * Uses fetch (no SDK dep) — the endpoint is OpenAI-compatible.
 *
 * CHAIN ORDER IS MEASURED, NOT GUESSED (2026-08-22). The chain was benchmarked on
 * the real `input-gate` prompt over 13 ground-truthed image→3D concepts (5 good /
 * 8 bad, 2 repeats = 26 scored calls per model), scoring pass/fail agreement at the
 * gate's own `passAt: 7` line:
 *
 *   model           acc    falsePASS  avgMs  avgTok
 *   qwen3.8-27b     0.96       1      19349    2767   <- primary
 *   qwen3.7-flash   1.00       0      43670    7108
 *   qwen3.6-flash   0.85       4      14135    3177
 *   qwen3.8-max     0.85       4      32644    3261
 *   qwen3.6-plus    0.81       5      30647    3116
 *   qwen3.7-plus    0.77       6      17619    2366   <- the PREVIOUS default
 *
 * Two facts drove the re-tier. (1) EVERY error across every model was a false PASS
 * — never a false fail — so the gate's only real failure mode is letting a bad
 * concept through, which costs image→3D credits and yields fused-limb meshes.
 * False-pass count, not raw accuracy, is the metric that matters here. (2) The old
 * primary `qwen3.7-plus` ranked LAST: it scored a confident 10/10 on a concept whose
 * arms are entirely buried in drapery and 10/10 on one engulfed in hair — it is
 * specifically blind to the heavy-occlusion defect the gate exists to catch.
 *
 * `qwen3.7-flash` is the only model that got everything right, but it is placed
 * SECOND on purpose: ~2.3x the latency and ~2.6x the token burn of the primary, and
 * it was the one model with reproducible hard failures (a concept every other model
 * graded fine failed on it 5/5 attempts across two runs). Excellent as a fallback,
 * too fragile as the front door.
 *
 * NOTE `qwen3.7-max` is TEXT-ONLY — it rejects image content with HTTP 400. It must
 * never enter this chain despite outranking its siblings on text benchmarks.
 */
import type { VisionImage } from './critique';

export interface QwenVisionOptions {
  apiKey?: string;
  /** Primary model; default qwen3.8-27b, or $QWEN_CRITIQUE_MODEL. */
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
/**
 * Ranked by MEASURED false-pass count then cost (see the header table). Each model
 * carries its own free-tier quota, so a longer chain buys more total gate capacity
 * — the ordering decides which model answers while quota remains.
 */
const DEFAULT_FALLBACKS = [
  'qwen3.7-flash',
  'qwen3.6-flash',
  'qwen3.8-max',
  'qwen3.6-plus',
  // Last resort. Worst grader measured, but an exhausted chain gates NOTHING (every
  // concept passes through ungraded), so a 0.77 grader still beats no grader at all.
  'qwen3.7-plus',
];
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
  const primary = opts.model ?? process.env.QWEN_CRITIQUE_MODEL ?? 'qwen3.8-27b';
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
