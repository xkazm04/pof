/**
 * ai_test_run_history: one row per (scenario, run), written ONLY by a
 * report-graded run write-back (recordRunVerdicts, reached from POST
 * record-run-results) and keyed by that run's runId. Edits, dispatch, a
 * client-set status and the ungraded bulk 'error' fallback are not runs.
 * Throwaway DB only - never ~/.pof/pof.db.
 */
import { vi, describe, it, expect, afterAll } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/ai-testing-db-history-${process.pid}/pof.db`;
});

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai-testing/route';
import {
  createSuite,
  createScenario,
  updateScenario,
  deleteScenario,
  bulkUpdateScenarioStatus,
  recordRunVerdicts,
  getAllSuites,
  getSuite,
} from '@/lib/ai-testing-db';
import { getDb } from '@/lib/db';

const ROOT = join(tmpdir(), `pof-vitest-ai-history-${process.pid}`).replace(/\\/g, '/');
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function seed() {
  const suite = createSuite({ name: `Suite ${Date.now()}-${Math.random()}`, description: '', targetClass: 'C' });
  const a = createScenario({ suiteId: suite.id, name: 'Chase', description: 'sees player' })!;
  const b = createScenario({ suiteId: suite.id, name: 'Flee', description: 'low hp' })!;
  return { suiteId: suite.id, a: a.id, b: b.id };
}

function scenarioOf(id: number) {
  return getAllSuites().flatMap((s) => s.scenarios).find((s) => s.id === id)!;
}

describe('run history recorded by report-graded runs, keyed by runId', () => {
  it('case 1: two graded runs -> getAllSuites carries history newest first; getSuite agrees', () => {
    const { suiteId, a } = seed();
    const T1 = '2026-09-30T10:00:00.000Z';
    const T2 = '2026-09-30T11:00:00.000Z';
    recordRunVerdicts('r-aaaa0001', T1, [{ scenarioId: a, status: 'passed', output: 'ok' }]);
    recordRunVerdicts('r-aaaa0002', T2, [{ scenarioId: a, status: 'failed', output: 'x' }]);

    const s = scenarioOf(a);
    expect(s.status).toBe('failed');
    expect(s.lastRunOutput).toBe('x');
    expect(s.lastRunAt).toBe(T2);
    expect(s.history).toHaveLength(2);
    expect(s.history![0]).toMatchObject({ runId: 'r-aaaa0002', status: 'failed', ranAt: T2 });
    expect(s.history![1]).toMatchObject({ runId: 'r-aaaa0001', status: 'passed', ranAt: T1 });
    expect(getSuite(suiteId)!.scenarios.find((x) => x.id === a)!.history).toEqual(s.history);
  });

  it('case 2: an edit, a dispatch, a client-set status and the ungraded bulk error reset are not runs', () => {
    const { a, b } = seed();
    recordRunVerdicts('r-bbbb0001', '2026-09-30T10:00:00.000Z', [
      { scenarioId: a, status: 'passed', output: '' },
      { scenarioId: b, status: 'passed', output: '' },
    ]);
    updateScenario({ id: a, description: 'sees player at 50m' });
    bulkUpdateScenarioStatus([a, b], 'running');
    updateScenario({ id: a, status: 'failed', lastRunOutput: 'CLI says fail', lastRunAt: '2026-09-30T12:00:00.000Z' });
    bulkUpdateScenarioStatus([a, b], 'error', { lastRunOutput: 'could not be graded', lastRunAt: '2026-09-30T12:00:00.000Z' });

    expect(scenarioOf(a).history).toHaveLength(1);
    expect(scenarioOf(b).history).toHaveLength(1);
    expect(scenarioOf(a).status).toBe('error'); // the row itself still moved
  });

  it('case 3: the same run graded twice keeps one row (latest grade); 10 runs -> the 8 newest; delete cascades', () => {
    const { a } = seed();
    recordRunVerdicts('r-cccc0000', '2026-09-30T09:00:00.000Z', [{ scenarioId: a, status: 'error', output: 'no report' }]);
    recordRunVerdicts('r-cccc0000', '2026-09-30T09:00:05.000Z', [{ scenarioId: a, status: 'passed', output: 'report landed' }]);
    expect(scenarioOf(a).history).toEqual([
      expect.objectContaining({ runId: 'r-cccc0000', status: 'passed' }),
    ]);

    for (let i = 1; i <= 9; i++) {
      recordRunVerdicts(`r-cccc000${i}`, `2026-09-30T10:0${i}:00.000Z`, [{ scenarioId: a, status: i % 2 ? 'failed' : 'passed', output: '' }]);
    }
    const history = scenarioOf(a).history!;
    expect(history.map((h) => h.runId)).toEqual(
      ['r-cccc0009', 'r-cccc0008', 'r-cccc0007', 'r-cccc0006', 'r-cccc0005', 'r-cccc0004', 'r-cccc0003', 'r-cccc0002'],
    );

    deleteScenario(a);
    const left = getDb().prepare('SELECT COUNT(*) AS n FROM ai_test_run_history WHERE scenario_id = ?').get(a) as { n: number };
    expect(left.n).toBe(0);
  });

  it('case 3b: POST record-run-results with no UE report records one error row per scenario under that runId', async () => {
    const { a, b } = seed();
    const runId = 'r-dddd0001';
    const reportDir = `${ROOT}/Saved/Automation/PoF-AITests/${runId}`;
    mkdirSync(reportDir, { recursive: true });
    bulkUpdateScenarioStatus([a, b], 'running');

    const res = await POST(new NextRequest('http://localhost/api/ai-testing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record-run-results', runId, reportDir, scenarioIds: [a, b], results: [{ scenarioId: a, status: 'passed' }] }),
    }));
    expect(res.status).toBe(200);
    for (const id of [a, b]) {
      const s = scenarioOf(id);
      expect(s.history).toHaveLength(1);
      expect(s.history![0]).toMatchObject({ runId, status: 'error' });
    }
  });

  it('records the definition the run graded: an edit between runs changes the stored hash', () => {
    const { a } = seed();
    recordRunVerdicts('r-eeee0001', '2026-09-30T10:00:00.000Z', [{ scenarioId: a, status: 'passed', output: '' }]);
    updateScenario({ id: a, expectedActions: [{ id: 'e', action: 'Chase', btNode: '', timeoutSeconds: 5 }] });
    recordRunVerdicts('r-eeee0002', '2026-09-30T11:00:00.000Z', [{ scenarioId: a, status: 'failed', output: '' }]);
    const [newest, older] = scenarioOf(a).history!;
    expect(newest.definitionHash).not.toBe(older.definitionHash);
  });
});
