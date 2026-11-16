/**
 * Field-level refusals on the quality-evaluation writes: a value the handler cannot honour is a
 * 400 naming the field, before any store write, spawn or paid vision call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

const { calls, reach } = vi.hoisted(() => {
  const calls = { reached: 0 };
  const reach = (value: unknown) => () => { calls.reached += 1; return value; };
  return { calls, reach };
});

vi.mock('@/lib/regression-tracker', () => ({
  processSession: reach({}), getAllFingerprints: reach([]), getOccurrences: reach([]), getActiveAlerts: reach([]),
  getAllAlerts: reach([]), dismissAlert: reach(undefined), markResolved: reach(undefined),
  getRegressionStats: reach({}), getSessionAnalysisStates: reach(new Map()),
}));
vi.mock('@/lib/game-director-db', () => ({ getSession: reach(null), listSessions: reach([]) }));
vi.mock('@/lib/ue-experiment/job-store', () => ({ startExperimentJob: reach('job-1') }));
vi.mock('@/lib/evaluator/git-attribution', () => ({ attributeFilesSince: async () => { calls.reached += 1; return {}; } }));
vi.mock('@/lib/vision/router', () => ({ recognize: async () => { calls.reached += 1; throw new Error('must not be reached'); } }));

import { POST as postResults } from '@/app/api/evaluator/results/route';
import { POST as postRegression } from '@/app/api/regression-tracker/route';
import { POST as postProfiling } from '@/app/api/performance-profiling/route';
import { POST as postExperiment } from '@/app/api/experiment/run/route';
import { POST as postAttribution } from '@/app/api/evaluator/git-attribution/route';
import { POST as postVisual } from '@/app/api/verify/visual/route';
import { POST as postAnimation } from '@/app/api/verify/animation/route';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { calls.reached = 0; });

async function refuses(res: Response, field: string) {
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain(field);
  expect(calls.reached).toBe(0);
}

const FINDING = { moduleId: 'audio', severity: 'high', description: 'x' };

describe('evaluator/results POST', () => {
  const base = { scanId: 's1', modulesEvaluated: ['audio'] };

  for (const [label, entry] of [['null', null], ['a string', 'x'], ['no moduleId', { severity: 'high' }], ['unknown severity', { moduleId: 'audio', severity: 'dire' }]] as const) {
    it(`refuses a findings entry that is ${label}`, async () => {
      await refuses(await postResults(req({ ...base, findings: [entry] })), 'findings');
    });
  }

  it('refuses a scannedAt that is not a date, which would sort as the newest scan forever', async () => {
    await refuses(await postResults(req({ ...base, findings: [FINDING], scannedAt: 'zzz' })), 'scannedAt');
  });

  it('stores a valid scan', async () => {
    const res = await postResults(req({ ...base, findings: [FINDING], scannedAt: '2026-11-08T00:00:00.000Z' }));
    expect(res.status).toBe(200);
  });
});

describe('regression-tracker POST', () => {
  for (const [action, field] of [['process-session', 'sessionId'], ['dismiss', 'alertId'], ['resolve', 'fingerprintId']] as const) {
    for (const bad of [42, true, { a: 1 }]) {
      it(`${action} refuses ${field}=${JSON.stringify(bad)}`, async () => {
        await refuses(await postRegression(req({ action, [field]: bad })), field);
      });
    }
  }
});

describe('performance-profiling POST', () => {
  const sample = { action: 'generate-sample', scenarioType: 'menu', enemyCount: 5, targetFPS: 60 };

  for (const [field, bad] of [['scenarioType', 'nope'], ['scenarioType', 7], ['enemyCount', 'many'], ['enemyCount', -1], ['targetFPS', 0], ['targetFPS', 'fast']] as const) {
    it(`generate-sample refuses ${field}=${JSON.stringify(bad)}`, async () => {
      await refuses(await postProfiling(req({ ...sample, [field]: bad })), field);
    });
  }

  it('generate-sample keeps its defaults and a valid request', async () => {
    expect((await postProfiling(req({ action: 'generate-sample' }))).status).toBe(200);
    expect((await postProfiling(req(sample))).status).toBe(200);
  });

  it('import-csv refuses non-text content and name', async () => {
    await refuses(await postProfiling(req({ action: 'import-csv', csvContent: 42, sessionName: 'n' })), 'csvContent');
    await refuses(await postProfiling(req({ action: 'import-csv', csvContent: 'a,b', sessionName: 7 })), 'sessionName');
  });
});

describe('experiment/run POST', () => {
  for (const [field, bad] of [['resX', 'wide'], ['resY', -1], ['settleMs', 0], ['settleMs', 'soon'], ['capture', 'yes'], ['allowRunningEditor', 1], ['python', 7]] as const) {
    it(`refuses ${field}=${JSON.stringify(bad)}`, async () => {
      await refuses(await postExperiment(req({ python: 'print(1)', [field]: bad })), field);
    });
  }

  it('still starts a valid experiment', async () => {
    const res = await postExperiment(req({ python: 'print(1)', capture: true, resX: 1280, resY: 720, settleMs: 1000 }));
    expect(res.status).toBe(202);
    expect(calls.reached).toBe(1);
  });
});

describe('evaluator/git-attribution POST', () => {
  it('refuses a files value that is not an array instead of answering an empty attribution', async () => {
    await refuses(await postAttribution(req({ projectPath: 'C:/p', files: 'a.ts' })), 'files');
  });

  it('refuses a since that is neither a string nor null, which would widen to all history', async () => {
    await refuses(await postAttribution(req({ projectPath: 'C:/p', files: ['a.ts'], since: 7 })), 'since');
  });

  it('still attributes a valid request with a null since', async () => {
    const res = await postAttribution(req({ projectPath: 'C:/p', files: ['a.ts'], since: null }));
    expect(res.status).toBe(200);
    expect(calls.reached).toBe(1);
  });
});

describe('verify routes refuse an unknown enum instead of silently running another check', () => {
  const visual = { moduleId: 'm', itemId: 'i', screenshotPath: 'C:/missing.png' };

  it('visual refuses an unknown mode before reading the screenshot', async () => {
    await refuses(await postVisual(req({ ...visual, mode: 'textures' })), 'mode');
  });

  it('visual keeps its known modes and the hud default', async () => {
    for (const mode of [undefined, 'hud', 'texture', 'lighting', 'character']) {
      expect((await postVisual(req({ ...visual, ...(mode ? { mode } : {}) }))).status).toBe(404);
    }
  });

  const anim = { name: 'n', intent: 'i', frameDir: 'C:/missing' };

  for (const [field, bad] of [['provider', 'openai'], ['cam', 'top'], ['loopIntent', 'sometimes'], ['maxFrames', 1.5], ['maxFrames', -1], ['name', 42], ['intent', true]] as const) {
    it(`animation refuses ${field}=${JSON.stringify(bad)}`, async () => {
      await refuses(await postAnimation(req({ ...anim, [field]: bad })), field);
    });
  }

  it('animation keeps its accepted values', async () => {
    const res = await postAnimation(req({ ...anim, provider: 'qwen', cam: 'side', loopIntent: 'oneshot', maxFrames: 8 }));
    expect(res.status).toBe(404);
  });
});
