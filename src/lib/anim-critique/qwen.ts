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
 * CHAIN ORDER IS MEASURED, NOT GUESSED (2026-08-22). Benchmarked on the real
 * `input-gate` prompt at the gate's own `passAt: 7` line, over TWO independent
 * blocks so the ranking does not rest on fixtures written for the benchmark:
 *   A = 13 concepts generated for this test (5 good / 8 bad), deliberately loaded
 *       with borderline occlusion cases; ground-truthed BY EYE, never by the
 *       generating prompt (2 of 6 hard fixtures ignored their instruction).
 *   B = 7 REAL assets already in `generated/icons/` that the gate meets in normal
 *       operation (3 good / 4 bad).
 * 2 repeats => 40 scored calls per model.
 *
 *   model           combined  falsePASS   A       B      avgMs  avgTok
 *   qwen3.7-flash     1.00        0     1.00    1.00     43670    7108  <- primary
 *   qwen3.8-27b       0.95        2     0.96    0.93     19349    2767
 *   qwen3.8-max       0.93        3     0.88    1.00     32644    3261
 *   qwen3.6-flash     0.88        5     0.85    0.93     14135    3177
 *   qwen3.6-plus      0.85        6     0.77    1.00     30647    3116
 *   qwen3.7-plus      0.82        7     0.73    1.00     17619    2366  <- OLD default
 *
 * Read block B with care: it barely discriminates (four of six models score 1.00),
 * because real bad inputs here are obvious — a tiling texture, a zone map, a UI
 * wireframe. Its job is to prove the ranking does not INVERT on production data;
 * the separation comes from block A's hard cases, which are themselves realistic
 * (a caped sorcerer and a shield-bearing knight are ordinary game concepts).
 *
 * Two facts drive the order. (1) EVERY error across every model, in both blocks,
 * was a false PASS — never a false fail. The gate cannot be too strict, only too
 * lax, and a false pass costs image→3D credits plus a fused-limb mesh. So false-pass
 * count, not raw accuracy, is the ranking metric. (2) The old primary `qwen3.7-plus`
 * ranks LAST. Note it scores 1.00 on block B: its weakness is not general competence
 * but occlusion specifically — a confident 10/10 on a concept whose arms are buried
 * in drapery, and 10/10 on one engulfed in hair, which is exactly the defect class
 * the gate exists to catch.
 *
 * `qwen3.7-flash` leads on a perfect 40/40 with zero false passes. It costs ~2.3x
 * the latency and ~2.6x the tokens of the runner-up, which is affordable because the
 * gate guards a job that takes minutes and real credits, and because quota is
 * PER-MODEL — order decides who answers first, not total capacity. Its one liability,
 * reproducible transport failures, is now absorbed by the chain itself (see the
 * try/catch in the loop below) rather than by demoting it.
 *
 * NOTE `qwen3.7-max` is TEXT-ONLY — it rejects image content with HTTP 400. It must
 * never enter this chain despite outranking its siblings on text benchmarks.
 */
import type { VisionImage } from './critique';

export interface QwenVisionOptions {
  apiKey?: string;
  /** Primary model; default qwen3.7-flash, or $QWEN_CRITIQUE_MODEL. */
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
  'qwen3.8-27b',
  'qwen3.8-max',
  'qwen3.6-flash',
  'qwen3.6-plus',
  // Last resort. Worst grader measured, but an exhausted chain gates NOTHING (every
  // concept passes through ungraded), so a 0.82 grader still beats no grader at all.
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
  const primary = opts.model ?? process.env.QWEN_CRITIQUE_MODEL ?? 'qwen3.7-flash';
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
      // A TRANSPORT failure (DNS, socket reset, TLS) must fall through to the next
      // model, not escape the chain. Unwrapped, one flaky model threw straight out
      // of makeQwenVision, the gate reported itself unavailable, and the concept was
      // submitted UNGATED to a paid image->3D job — the whole chain defeated by a
      // blip on ONE model while five healthy ones sat behind it. Measured 2026-08-22:
      // qwen3.7-flash returned `TypeError: fetch failed` on a specific image 5/5
      // times while every other model graded it fine.
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.2, max_tokens: 4096 }),
        });
      } catch (e) {
        lastErr = `Qwen ${model} transport failure: ${e instanceof Error ? e.message : String(e)}`;
        continue; // next model — a different endpoint/route may well be reachable
      }
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
