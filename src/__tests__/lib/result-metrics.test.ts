import { describe, it, expect } from 'vitest';
import { extractResultMetrics } from '@/lib/claude-terminal/result-metrics';

describe('extractResultMetrics', () => {
  it('reads the top-level result shape (total_cost_usd + top-level usage)', () => {
    const m = extractResultMetrics({
      type: 'result',
      total_cost_usd: 0.1234,
      duration_ms: 1500,
      is_error: false,
      session_id: 's-top',
      usage: {
        input_tokens: 1200,
        output_tokens: 340,
        cache_read_input_tokens: 90,
        cache_creation_input_tokens: 12,
      },
    });
    expect(m.costUsd).toBe(0.1234);
    expect(m.usage.inputTokens).toBe(1200);
    expect(m.usage.outputTokens).toBe(340);
    expect(m.usage.cacheReadTokens).toBe(90);
    expect(m.usage.cacheCreationTokens).toBe(12);
    expect(m.sessionId).toBe('s-top');
    expect(m.durationMs).toBe(1500);
    expect(m.isError).toBe(false);
  });

  it('reads the legacy nested shape (cost_usd + result.usage)', () => {
    const m = extractResultMetrics({
      type: 'result',
      cost_usd: 0.05,
      duration_ms: 500,
      result: {
        session_id: 's-nested',
        usage: { input_tokens: 7, output_tokens: 3 },
      },
    });
    expect(m.costUsd).toBe(0.05);
    expect(m.usage.inputTokens).toBe(7);
    expect(m.usage.outputTokens).toBe(3);
    expect(m.sessionId).toBe('s-nested');
  });

  it('falls back to provided sessionId and zeroes missing metrics', () => {
    const m = extractResultMetrics({ type: 'result' }, 'fallback-session');
    expect(m.costUsd).toBe(0);
    expect(m.usage.inputTokens).toBe(0);
    expect(m.usage.outputTokens).toBe(0);
    expect(m.usage.cacheReadTokens).toBe(0);
    expect(m.sessionId).toBe('fallback-session');
    expect(m.isError).toBe(false);
  });

  it('treats is_error true as an error result', () => {
    expect(extractResultMetrics({ type: 'result', is_error: true }).isError).toBe(true);
  });
});
