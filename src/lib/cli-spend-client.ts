'use client';

import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { PreflightVerdict } from '@/lib/cli-spend/preflight';

/** Fields the terminal captures for one completed CLI run. */
export interface CliSpendInput {
  moduleId: string;
  taskType: string;
  taskLabel?: string | null;
  sessionKey?: string | null;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  durationMs?: number;
  success?: boolean;
}

/**
 * Persist one run's spend (fire-and-forget). Skips no-op results that carry no
 * cost and no tokens (e.g. synthetic completion events) to keep the table clean.
 */
export function recordCliSpend(input: CliSpendInput): void {
  if (input.costUsd <= 0 && input.tokensIn <= 0 && input.tokensOut <= 0) return;
  void apiFetch('/api/cli-spend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, recordedAt: new Date().toISOString() }),
  }).catch((e) => logger.warn('Failed to record CLI spend:', e));
}

/**
 * Fetch the pre-flight guardrail verdict for a task type. Returns null on any
 * failure so callers never block a dispatch on a guardrail error.
 */
export async function fetchPreflightVerdict(taskType: string): Promise<PreflightVerdict | null> {
  const result = await tryApiFetch<PreflightVerdict>(
    `/api/cli-spend?action=preflight&taskType=${encodeURIComponent(taskType)}`,
  );
  return result.ok ? result.data : null;
}
