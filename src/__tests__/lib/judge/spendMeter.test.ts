/**
 * Judge-fleet spend metering (Direction: judge-spend-is-metered).
 *
 * The judge harness spawned the Claude CLI directly, so an Opus/high fleet run never reached
 * `recordSpend` and could not be refused by a configured budget. These tests pin both halves:
 * a judge invocation's metrics reach the SAME spend table the Spend tab reads, and a budget
 * that is exceeded refuses the run.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import {
  judgeBudgetGate,
  judgeSpendRecord,
  judgeTaskType,
  parseCliJsonRun,
  JUDGE_SPEND_MODULE,
} from '@/lib/judge/spendMeter';
import { EXPENSIVE_TASK_TYPES, taskTypeLabel } from '@/lib/cli-spend/preflight';
import {
  recordSpend,
  getSpendDashboard,
  setBudgetConfig,
  getBudgetStatus,
  getTaskTypeEstimate,
  ensureCliSpendTables,
} from '@/lib/cli-spend-db';
import { getDb } from '@/lib/db';

/** A realistic `claude -p --output-format json` envelope. */
const CLI_JSON = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  duration_ms: 41230,
  result: '{"score": 87, "verdict": "fail", "findings": "thin", "fix": "deepen"}',
  session_id: 'sess-abc',
  total_cost_usd: 1.2345,
  usage: {
    input_tokens: 9100,
    output_tokens: 640,
    cache_read_input_tokens: 22000,
    cache_creation_input_tokens: 1500,
  },
});

describe('judge spend metering — parsing', () => {
  it('extracts the judge text plus cost/usage from the CLI json envelope', () => {
    const m = parseCliJsonRun(CLI_JSON);
    expect(m.text).toContain('"score": 87');
    expect(m.costUsd).toBeCloseTo(1.2345, 4);
    expect(m.costKnown).toBe(true);
    expect(m.tokensIn).toBe(9100);
    expect(m.tokensOut).toBe(640);
    expect(m.cacheReadTokens).toBe(22000);
    expect(m.cacheCreationTokens).toBe(1500);
    expect(m.durationMs).toBe(41230);
    expect(m.sessionKey).toBe('sess-abc');
    expect(m.isError).toBe(false);
  });

  it('tolerates leading CLI noise before the json object', () => {
    const m = parseCliJsonRun(`warning: something\n${CLI_JSON}\n`);
    expect(m.costKnown).toBe(true);
    expect(m.costUsd).toBeCloseTo(1.2345, 4);
  });

  it('degrades honestly when the envelope is unparseable — never a fabricated $0 measurement', () => {
    const m = parseCliJsonRun('score: 90 — plain text, no envelope');
    expect(m.text).toContain('score: 90');
    expect(m.costKnown).toBe(false);
    expect(m.costUsd).toBe(0);
  });

  it('flags an errored run so it is recorded as failed (and excluded from estimates)', () => {
    const m = parseCliJsonRun(JSON.stringify({ is_error: true, result: 'boom', total_cost_usd: 0.4 }));
    expect(m.isError).toBe(true);
    const rec = judgeSpendRecord('judge-content', 'x::y [z]', m);
    expect(rec.status).toBe('failed');
    expect(rec.success).toBe(false);
  });
});

describe('judge spend metering — task-type vocabulary', () => {
  it('bills text configs to judge-content and media to judge-visual', () => {
    expect(judgeTaskType('text-config')).toBe('judge-content');
    expect(judgeTaskType('2d-art')).toBe('judge-visual');
    expect(judgeTaskType('3d-mesh')).toBe('judge-visual');
    expect(judgeTaskType('ui-glyph')).toBe('judge-visual');
  });

  it('both judge task types are known-expensive and labelled for the dashboard', () => {
    expect(EXPENSIVE_TASK_TYPES.has('judge-content')).toBe(true);
    expect(EXPENSIVE_TASK_TYPES.has('judge-visual')).toBe(true);
    expect(taskTypeLabel('judge-content')).toBe('Strict content judge');
    expect(taskTypeLabel('judge-visual')).toBe('Strict visual judge');
  });
});

describe('judge spend metering — a judge invocation records spend', () => {
  beforeEach(() => {
    ensureCliSpendTables();
    getDb().exec('DELETE FROM cli_spend; DELETE FROM cli_spend_budget;');
  });

  it('lands in the same table the Spend tab reads, attributable per draw', () => {
    const m = parseCliJsonRun(CLI_JSON);
    recordSpend(judgeSpendRecord('judge-content', 'items::Economy [longsword] draw 1/3', m));
    recordSpend(judgeSpendRecord('judge-visual', 'items::Icon 2D Art [longsword] draw 1/1', m));

    const d = getSpendDashboard();
    expect(d.totalRuns).toBe(2);
    expect(d.totalCostUsd).toBeCloseTo(2.469, 3);
    expect(d.byModule.map((g) => g.key)).toEqual([JUDGE_SPEND_MODULE]);
    expect(d.byTaskType.map((g) => g.key).sort()).toEqual(['judge-content', 'judge-visual']);
    // Per-run attribution: the label names the exact unit of work, not one opaque total.
    expect(d.recent.map((r) => r.taskLabel)).toContain('items::Economy [longsword] draw 1/3');
    expect(d.recent[0].tokensIn).toBe(9100);
  });

  it('a cost the CLI did not report is recorded but labelled as unmeasured', () => {
    recordSpend(judgeSpendRecord('judge-content', 'items::Economy [longsword] draw 1/1', parseCliJsonRun('no envelope')));
    const d = getSpendDashboard();
    expect(d.totalRuns).toBe(1);
    expect(d.recent[0].taskLabel).toContain('cost unreported by CLI');
  });
});

describe('judge spend metering — a budget refusal blocks the run', () => {
  beforeEach(() => {
    ensureCliSpendTables();
    getDb().exec('DELETE FROM cli_spend; DELETE FROM cli_spend_budget;');
  });

  const gateNow = (taskType: 'judge-content' | 'judge-visual') => {
    const b = getBudgetStatus();
    return judgeBudgetGate({
      taskType,
      estimate: getTaskTypeEstimate(taskType),
      budget: {
        dailyExceeded: b.dailyExceeded,
        monthlyExceeded: b.monthlyExceeded,
        dailyRemainingUsd: b.dailyRemainingUsd,
        monthlyRemainingUsd: b.monthlyRemainingUsd,
      },
    });
  };

  it('permits the run when no budget is configured', () => {
    expect(gateNow('judge-content').refuse).toBe(false);
  });

  it('refuses once the daily budget is exceeded, with a stated reason', () => {
    setBudgetConfig({ dailyLimitUsd: 1, monthlyLimitUsd: null });
    recordSpend(judgeSpendRecord('judge-content', 'items::Economy [a] draw 1/1', parseCliJsonRun(CLI_JSON)));
    const gate = gateNow('judge-content');
    expect(gate.refuse).toBe(true);
    expect(gate.reasons.join(' ')).toContain('daily budget is already exceeded');
  });

  it('refuses when this run’s historical estimate would blow the remaining allowance', () => {
    // One prior $1.2345 judge run establishes the estimate; a $2 daily cap leaves ~$0.77.
    recordSpend(judgeSpendRecord('judge-content', 'items::Economy [a] draw 1/1', parseCliJsonRun(CLI_JSON)));
    setBudgetConfig({ dailyLimitUsd: 2, monthlyLimitUsd: null });
    const gate = gateNow('judge-content');
    expect(gate.refuse).toBe(true);
    expect(gate.verdict.expensive).toBe(true);
    expect(gate.reasons.join(' ')).toContain("exceeds today's remaining budget");
  });
});
