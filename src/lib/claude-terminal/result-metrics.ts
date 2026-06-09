/**
 * Result-metrics normalizer.
 *
 * The Claude Code CLI emits a final `result` stream-json message that carries the
 * run's token usage and dollar cost. Different CLI versions place these under
 * slightly different keys — newer builds use top-level `total_cost_usd` + a
 * top-level `usage` object with snake_case token fields, while the older shape
 * this codebase first integrated against nested them under `result.usage` and
 * used `cost_usd`. This single pure helper reads either shape and returns clean
 * camelCase numbers, so the cost/token data finally reaches the terminal header
 * and the spend dashboard instead of being silently dropped.
 */

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface NormalizedResult {
  sessionId?: string;
  usage: NormalizedUsage;
  costUsd: number;
  durationMs?: number;
  isError: boolean;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** First finite number among the candidate keys, else 0. */
function pickNum(obj: Record<string, unknown> | undefined, keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

/**
 * Normalize a parsed `result` stream-json message into clean metrics.
 *
 * Tolerates both the top-level (`usage`, `total_cost_usd`, `session_id`) and the
 * legacy nested (`result.usage`, `cost_usd`, `result.session_id`) shapes, and
 * both snake_case and camelCase token keys. Unknown / missing values become 0.
 */
export function extractResultMetrics(
  parsed: Record<string, unknown>,
  fallbackSessionId?: string,
): NormalizedResult {
  const nested = (parsed.result && typeof parsed.result === 'object'
    ? (parsed.result as Record<string, unknown>)
    : undefined);

  const usageRaw =
    (parsed.usage && typeof parsed.usage === 'object'
      ? (parsed.usage as Record<string, unknown>)
      : nested?.usage && typeof nested.usage === 'object'
        ? (nested.usage as Record<string, unknown>)
        : undefined);

  const usage: NormalizedUsage = {
    inputTokens: pickNum(usageRaw, ['input_tokens', 'inputTokens']),
    outputTokens: pickNum(usageRaw, ['output_tokens', 'outputTokens']),
    cacheReadTokens: pickNum(usageRaw, ['cache_read_input_tokens', 'cacheReadTokens', 'cache_read_tokens']),
    cacheCreationTokens: pickNum(usageRaw, ['cache_creation_input_tokens', 'cacheCreationTokens', 'cache_creation_tokens']),
  };

  const costUsd = pickNum(parsed, ['total_cost_usd', 'cost_usd', 'totalCostUsd', 'costUsd']);

  const sessionId =
    (typeof parsed.session_id === 'string' && parsed.session_id) ||
    (typeof nested?.session_id === 'string' && nested.session_id) ||
    fallbackSessionId ||
    undefined;

  return {
    sessionId,
    usage,
    costUsd,
    durationMs: num(parsed.duration_ms),
    isError: parsed.is_error === true,
  };
}
