/**
 * Craft gauge spend metering (direction: craft-spend-metered).
 *
 * Every R-axis judge draw reaches `recordSpend`; the A-axis reached nothing, so craft gauging
 * spent real budget that appeared in no ledger. This pins the seam: craft writes land in the
 * SAME `cli_spend` table under a DISTINCT `craft` module, an unreported cost is recorded as
 * UNKNOWN rather than as a measured $0.00, the API accepts cost OPTIONALLY so the skill-driven
 * writer keeps working — and none of it can touch an R-grade.
 *
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('fs') as typeof import('fs');
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-craft-spend-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  process.env.POF_DB_PATH = dbPath;
});
import { POST } from '@/app/api/craft-verdicts/route';
import {
  upsertCraftVerdict,
  craftGaugeCost,
  craftSpendRecord,
  craftTaskType,
  CRAFT_SPEND_MODULE,
  PROCESS_ENTITY,
  PROCESS_STEP,
  type CraftVerdict,
} from '@/lib/craft/craft-verdicts-db';
import { JUDGE_SPEND_MODULE } from '@/lib/judge/spendMeter';
import { getSpendDashboard, getRecentSpend } from '@/lib/cli-spend-db';

function verdict(over: Partial<CraftVerdict> = {}): CraftVerdict {
  return {
    catalogId: 'items',
    entityId: 'iron-sword',
    step: 'Concept Brief',
    lens: 'game-systems-code',
    lensVersion: 1,
    aLevel: 'A2',
    findings: [{ criterion: 'systemic-depth', detail: 'no interlocking systems named', class: 'content' }],
    model: 'opus-craft-fleet-test',
    ...over,
  };
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/craft-verdicts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('craftGaugeCost — the honesty flag', () => {
  it('an ABSENT cost is unknown, never a measured zero', () => {
    const m = craftGaugeCost();
    expect(m.costKnown).toBe(false);
    expect(m.costUsd).toBe(0);
    expect(craftSpendRecord(verdict(), m).taskLabel).toContain('cost unreported by writer');
  });

  it('an empty cost block is equally unknown', () => {
    expect(craftGaugeCost({}).costKnown).toBe(false);
  });

  it('a reported cost is known and carried verbatim', () => {
    const m = craftGaugeCost({ costUsd: 0.42, tokensIn: 1200, tokensOut: 300, durationMs: 9100, sessionKey: 's1' });
    expect(m).toMatchObject({ costKnown: true, costUsd: 0.42, tokensIn: 1200, tokensOut: 300, durationMs: 9100 });
    expect(craftSpendRecord(verdict(), m).taskLabel).not.toContain('unreported');
  });

  it('an explicit costKnown:false disclaims a reported number rather than trusting it', () => {
    const m = craftGaugeCost({ costUsd: 0.9, costKnown: false });
    expect(m.costKnown).toBe(false);
    expect(m.costUsd).toBe(0);
  });

  it('junk numbers degrade to 0 instead of poisoning the ledger', () => {
    const m = craftGaugeCost({ costUsd: Number.NaN, tokensIn: -5 as number, durationMs: Number.POSITIVE_INFINITY });
    expect(m.costKnown).toBe(false);
    expect(m.tokensIn).toBe(0);
    expect(m.durationMs).toBe(0);
  });
});

describe('craftSpendRecord — attribution', () => {
  it('bills the craft module, never the judge one', () => {
    const rec = craftSpendRecord(verdict(), craftGaugeCost({ costUsd: 0.1 }));
    expect(rec.moduleId).toBe(CRAFT_SPEND_MODULE);
    expect(rec.moduleId).toBe('craft');
    expect(rec.moduleId).not.toBe(JUDGE_SPEND_MODULE);
    expect(rec.taskType).toBe('craft-gauge');
  });

  it('separates the per-catalog process scorecard from a per-step gauge', () => {
    expect(craftTaskType({ entityId: 'iron-sword', step: 'Concept Brief' })).toBe('craft-gauge');
    expect(craftTaskType({ entityId: PROCESS_ENTITY, step: '__process__' })).toBe('craft-process');
    expect(craftTaskType({ entityId: 'x', step: PROCESS_STEP })).toBe('craft-process');
  });

  it('names the unit of work so a campaign is attributable per gauge', () => {
    const rec = craftSpendRecord(verdict(), craftGaugeCost({ costUsd: 0.1 }));
    expect(rec.taskLabel).toContain('items::Concept Brief');
    expect(rec.taskLabel).toContain('[iron-sword]');
    expect(rec.taskLabel).toContain('A2');
  });

  it('a failed run is recorded as failed, not silently completed', () => {
    const rec = craftSpendRecord(verdict(), craftGaugeCost({ costUsd: 0, isError: true }));
    expect(rec.status).toBe('failed');
    expect(rec.success).toBe(false);
  });
});

describe('a craft write reaches the ledger', () => {
  it('records one craft-module run per gauge, with the reported cost', () => {
    upsertCraftVerdict(verdict({ entityId: 'metered', aLevel: 'A3' }), { costUsd: 0.25, tokensIn: 900, tokensOut: 120 });
    const rows = getRecentSpend(50).filter((r) => r.moduleId === CRAFT_SPEND_MODULE);
    expect(rows).toHaveLength(1);
    expect(rows[0].taskType).toBe('craft-gauge');
    expect(rows[0].costUsd).toBeCloseTo(0.25, 6);
    expect(rows[0].taskLabel).toContain('[metered]');

    const d = getSpendDashboard();
    expect(d.byModule.map((g) => g.key)).toContain(CRAFT_SPEND_MODULE);
    expect(d.byTaskType.map((g) => g.key)).toContain('craft-gauge');
  });

  it('a re-gauge is a NEW draw in the ledger (spend accumulates, unlike the verdict row)', () => {
    upsertCraftVerdict(verdict({ entityId: 'metered', aLevel: 'A4', findings: [] }), { costUsd: 0.25 });
    expect(getRecentSpend(50).filter((r) => r.moduleId === CRAFT_SPEND_MODULE)).toHaveLength(2);
  });

  it('the process scorecard bills its own task type', () => {
    upsertCraftVerdict(
      verdict({
        entityId: PROCESS_ENTITY,
        step: PROCESS_STEP,
        lens: 'production-process',
        aLevel: 'A1',
      }),
      { costUsd: 0.5 },
    );
    const rows = getRecentSpend(50).filter((r) => r.taskType === 'craft-process');
    expect(rows).toHaveLength(1);
    expect(rows[0].moduleId).toBe(CRAFT_SPEND_MODULE);
  });
});

describe('POST /api/craft-verdicts — cost is optional (degrade, never reject)', () => {
  it('the existing skill-driven writer (no cost block at all) still succeeds and is metered as unknown', async () => {
    const res = await POST(
      post({
        catalogId: 'items',
        entityId: 'skill-writer',
        step: 'Concept Brief',
        lens: 'game-systems-code',
        lensVersion: 1,
        aLevel: 'A2',
        findings: [{ criterion: 'systemic-depth', detail: 'no interlocking systems named', class: 'content' }],
        model: 'opus-craft-fleet-test',
      }),
    );
    const json = (await res.json()) as { success: boolean; data: CraftVerdict };
    expect(json.success).toBe(true);
    expect(json.data.aLevel).toBe('A2');

    const row = getRecentSpend(50).find((r) => r.taskLabel?.includes('[skill-writer]'))!;
    expect(row).toBeTruthy();
    expect(row.moduleId).toBe(CRAFT_SPEND_MODULE);
    // Unmeasured, and it SAYS so — a $0.00 that reads as free is the failure mode.
    expect(row.costUsd).toBe(0);
    expect(row.taskLabel).toContain('cost unreported by writer');
  });

  it('a writer that CAN report cost has it recorded', async () => {
    const res = await POST(
      post({
        catalogId: 'items',
        entityId: 'costed-writer',
        step: 'Concept Brief',
        lens: 'game-systems-code',
        lensVersion: 1,
        aLevel: 'A4',
        findings: [],
        model: 'opus-craft-fleet-test',
        cost: { costUsd: 1.75, tokensIn: 5000, tokensOut: 800, durationMs: 42000, sessionKey: 'abc' },
      }),
    );
    expect(((await res.json()) as { success: boolean }).success).toBe(true);

    const row = getRecentSpend(50).find((r) => r.taskLabel?.includes('[costed-writer]'))!;
    expect(row.costUsd).toBeCloseTo(1.75, 6);
    expect(row.tokensIn).toBe(5000);
    expect(row.sessionKey).toBe('abc');
    expect(row.taskLabel).not.toContain('unreported');
  });

  it('a malformed cost block is rejected as malformed, not silently billed', async () => {
    const res = await POST(
      post({
        catalogId: 'items',
        entityId: 'bad-cost',
        step: 'Concept Brief',
        lens: 'game-systems-code',
        lensVersion: 1,
        aLevel: 'A4',
        findings: [],
        model: 'opus-craft-fleet-test',
        cost: { costUsd: -3 },
      }),
    );
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
    expect(getRecentSpend(50).some((r) => r.taskLabel?.includes('[bad-cost]'))).toBe(false);
  });
});

describe('metering cannot move an R-grade', () => {
  const ROOT = path.resolve(__dirname, '../../../..');

  it('spend is attributed to a module the judge axis does not use', () => {
    expect(CRAFT_SPEND_MODULE).not.toBe(JUDGE_SPEND_MODULE);
    const craftRows = getRecentSpend(100).filter((r) => r.moduleId === CRAFT_SPEND_MODULE);
    expect(craftRows.length).toBeGreaterThan(0);
    expect(craftRows.every((r) => r.taskType.startsWith('craft-'))).toBe(true);
    expect(craftRows.some((r) => r.taskType.startsWith('judge-'))).toBe(false);
  });

  it('the craft write path does not import the R-axis verdict store', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/craft/craft-verdicts-db.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*(?:import|export)\s[^'"]*from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => /judge-verdicts-db|catalog\/acceptance|statusModel|status\/readiness/.test(s))).toEqual(
      [],
    );
    // It may READ the judge spend meter's contract — that is the point of one shared ledger —
    // but only as a type, never as a value it could write through.
    expect(/import\s+type\s+\{[^}]*CliRunMetrics[^}]*\}\s+from\s+'@\/lib\/judge\/spendMeter'/.test(src)).toBe(true);
  });

  it('the craft metering lives in the craft module — no forked parallel meter', () => {
    // One ledger, two attributions: craft builds its own record and hands it to the SAME
    // `recordSpend`, rather than growing a second spend store the dashboard cannot see.
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/craft/craft-verdicts-db.ts'), 'utf8');
    expect(src).toContain("recordSpend");
    expect(src).toContain("from '@/lib/cli-spend-db'");
    expect(/CREATE TABLE[^;]*spend/i.test(src)).toBe(false);
  });
});
