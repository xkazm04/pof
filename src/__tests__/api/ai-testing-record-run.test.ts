/**
 * POST /api/ai-testing `record-run-results` grades every dispatched scenario from
 * UE's automation report (`<reportDir>/index.json`), not from the CLI's claim, and
 * closes every scenario of the run - an omitted one is never left 'running'.
 * Throwaway DB + temp report dir only.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/ai-testing-record-run-${process.pid}/pof.db`;
});

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST, PUT } from '@/app/api/ai-testing/route';
import {
  createSuite,
  createScenario,
  bulkUpdateScenarioStatus,
  getSuite,
} from '@/lib/ai-testing-db';

const URL_BASE = 'http://localhost/api/ai-testing';
const RUN_ID = 'r-abc12345';
const ROOT = join(tmpdir(), `pof-vitest-ai-record-run-${process.pid}`).replace(/\\/g, '/');
const REPORT_DIR = `${ROOT}/Saved/Automation/PoF-AITests/${RUN_ID}`;

function send(method: 'POST' | 'PUT', body: unknown) {
  const req = new NextRequest(URL_BASE, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return method === 'POST' ? POST(req) : PUT(req);
}

function seedRunningSuite() {
  const suite = createSuite({ name: `Suite ${Date.now()}-${Math.random()}`, description: '', targetClass: 'C' });
  const a = createScenario({ suiteId: suite.id, name: 'Chase', description: '' })!;
  const b = createScenario({ suiteId: suite.id, name: 'Flee', description: '' })!;
  bulkUpdateScenarioStatus([a.id, b.id], 'running');
  return { suiteId: suite.id, a: a.id, b: b.id };
}

function statuses(suiteId: number): Record<number, { status: string; output: string }> {
  const out: Record<number, { status: string; output: string }> = {};
  for (const s of getSuite(suiteId)!.scenarios) out[s.id] = { status: s.status, output: s.lastRunOutput };
  return out;
}

beforeAll(() => mkdirSync(REPORT_DIR, { recursive: true }));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe('POST record-run-results - verdicts from the automation report', () => {
  it('grades from index.json (UTF-8 BOM): the reported scenario passes, the one the CLI omitted is closed as error', async () => {
    const { suiteId, a, b } = seedRunningSuite();
    const report = { tests: [{ fullTestPath: `AI.BehaviorTests.C.S${a}_Chase`, state: 'Success', errors: 0 }] };
    writeFileSync(join(REPORT_DIR, 'index.json'), `﻿${JSON.stringify(report)}`, 'utf-8');

    const res = await send('POST', {
      action: 'record-run-results',
      runId: RUN_ID,
      reportDir: REPORT_DIR,
      scenarioIds: [a, b],
      results: [{ scenarioId: a, status: 'passed' }],
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect([...body.data.updated].sort((x: number, y: number) => x - y)).toEqual([a, b].sort((x, y) => x - y));

    const after = statuses(suiteId);
    expect(after[a].status).toBe('passed');
    expect(after[b].status).toBe('error');
    expect(after[b].output).toContain(`AI.BehaviorTests.C.S${b}_`);
  });

  it('rejects a reportDir with ".." or outside Saved/Automation/PoF-AITests/<runId> -> 400, no row changes', async () => {
    const { suiteId, a, b } = seedRunningSuite();
    const before = statuses(suiteId);
    const bad = [
      `${ROOT}/Saved/Automation/PoF-AITests/../../../../${RUN_ID}`,
      `${ROOT}/Saved/Automation/Elsewhere/${RUN_ID}`,
      `${ROOT}/Saved/Automation/PoF-AITests/r-zzz99999`,
    ];
    for (const reportDir of bad) {
      const res = await send('POST', {
        action: 'record-run-results',
        runId: RUN_ID,
        reportDir,
        scenarioIds: [a, b],
        results: [{ scenarioId: a, status: 'passed' }, { scenarioId: b, status: 'passed' }],
      });
      expect(res.status).toBe(400);
    }
    expect(statuses(suiteId)).toEqual(before);
  });
});

describe('[guard] other ai-testing write paths are unchanged', () => {
  it('apply-stimuli merges stimuli and PUT bulk-status transitions many rows', async () => {
    const { suiteId, a, b } = seedRunningSuite();
    const stimuli = [{ id: 's1', type: 'perception_sight', label: 'Sees', description: 'd', params: {} }];
    const r1 = await send('POST', { action: 'apply-stimuli', scenarioId: a, stimuli });
    const b1 = await r1.json();
    expect(r1.status).toBe(200);
    expect(b1.data.scenario.stimuli).toEqual(stimuli);

    const r2 = await send('PUT', { action: 'bulk-status', ids: [a, b], status: 'ready' });
    const b2 = await r2.json();
    expect(r2.status).toBe(200);
    expect(b2.data.updated).toEqual([a, b]);
    const after = statuses(suiteId);
    expect(after[a].status).toBe('ready');
    expect(after[b].status).toBe('ready');
  });
});
