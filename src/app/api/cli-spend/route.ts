import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  recordSpend,
  getSpendDashboard,
  getBudgetStatus,
  setBudgetConfig,
  getTaskTypeEstimate,
} from '@/lib/cli-spend-db';
import { evaluatePreflight } from '@/lib/cli-spend/preflight';
import type { BudgetConfig } from '@/types/cli-spend';

// GET /api/cli-spend
//   ?action=dashboard                        → full spend dashboard (default)
//   ?action=budget                           → budget config + live status
//   ?action=preflight&taskType=X&moduleId=Y  → pre-flight guardrail verdict
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'dashboard';

    if (action === 'dashboard') {
      return apiSuccess(getSpendDashboard());
    }

    if (action === 'budget') {
      return apiSuccess(getBudgetStatus());
    }

    if (action === 'preflight') {
      const taskType = searchParams.get('taskType');
      if (!taskType) return apiError('taskType required', 400);
      const estimate = getTaskTypeEstimate(taskType);
      const budgetStatus = getBudgetStatus();
      const hasBudget =
        budgetStatus.config.dailyLimitUsd != null || budgetStatus.config.monthlyLimitUsd != null;
      const verdict = evaluatePreflight({
        taskType,
        estimate,
        budget: hasBudget
          ? {
              dailyExceeded: budgetStatus.dailyExceeded,
              monthlyExceeded: budgetStatus.monthlyExceeded,
              dailyRemainingUsd: budgetStatus.dailyRemainingUsd,
              monthlyRemainingUsd: budgetStatus.monthlyRemainingUsd,
            }
          : null,
      });
      return apiSuccess(verdict);
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    console.error('GET /api/cli-spend error:', err);
    return apiError('Internal error', 500);
  }
}

// POST /api/cli-spend
//   { action: 'set-budget', dailyLimitUsd, monthlyLimitUsd }  → update budget
//   { ...spend fields }                                       → record a run
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'set-budget') {
      const config: BudgetConfig = {
        dailyLimitUsd: normalizeLimit(body.dailyLimitUsd),
        monthlyLimitUsd: normalizeLimit(body.monthlyLimitUsd),
      };
      const saved = setBudgetConfig(config);
      return apiSuccess(saved);
    }

    // Default: record a spend entry.
    if (
      typeof body.costUsd !== 'number' &&
      typeof body.tokensIn !== 'number' &&
      typeof body.tokensOut !== 'number'
    ) {
      return apiError('costUsd or token counts required', 400);
    }

    const record = recordSpend({
      moduleId: body.moduleId,
      taskType: body.taskType,
      taskLabel: body.taskLabel ?? null,
      sessionKey: body.sessionKey ?? null,
      costUsd: Number(body.costUsd) || 0,
      tokensIn: Number(body.tokensIn) || 0,
      tokensOut: Number(body.tokensOut) || 0,
      cacheReadTokens: Number(body.cacheReadTokens) || 0,
      cacheCreationTokens: Number(body.cacheCreationTokens) || 0,
      durationMs: Number(body.durationMs) || 0,
      success: body.success !== false,
      recordedAt: body.recordedAt,
    });
    return apiSuccess({ record }, 201);
  } catch (err) {
    console.error('POST /api/cli-spend error:', err);
    return apiError('Internal error', 500);
  }
}

/** Coerce an incoming limit to a non-negative number, or null for "no limit". */
function normalizeLimit(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
