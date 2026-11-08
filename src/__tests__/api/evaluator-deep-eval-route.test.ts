/**
 * /api/evaluator/deep-eval — the Deep Eval tab's server job.
 *
 * POST starts a job for a project (409 while one is already running there), GET
 * ?project= returns its progress snapshot, DELETE cancels it and kills every in-flight
 * CLI execution. Each pass spawns through cli-service with the model-policy pin and the
 * spend attribution the claude-terminal query route gives its own spawns.
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card code-quality-evaluation/A.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

let execSeq = 0;
const startExecution = vi.fn<(...args: unknown[]) => string>(() => `exec-${++execSeq}`);
const abortExecution = vi.fn<(id: string) => boolean>(() => true);

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: (...args: unknown[]) => startExecution(...args),
  abortExecution: (id: string) => abortExecution(id),
  // A live run as the settlement seam (run-settle.ts) reads it: no backlog, no process.
  getExecution: () => ({ status: 'running', events: [], listeners: new Set(), process: null }),
}));

import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '@/app/api/evaluator/deep-eval/route';

const URL_BASE = 'http://localhost/api/evaluator/deep-eval';

function post(body: unknown): NextRequest {
  return new NextRequest(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/evaluator/deep-eval', () => {
  it('case 6: start, poll, refuse a second start, cancel and abort every in-flight execution', async () => {
    const started = await POST(post({ projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.5', moduleIds: ['audio'] }));
    expect(started.status).toBe(200);
    const startedJson = await started.json();
    expect(startedJson.success).toBe(true);
    expect(typeof startedJson.data.scanId).toBe('string');

    // Every pass spawns through cli-service with a pinned model + spend attribution.
    await Promise.resolve();
    expect(startExecution).toHaveBeenCalledTimes(4);
    const [projectPath, prompt, resume, onEvent, options] = startExecution.mock.calls[0] as [
      string, string, unknown, unknown, { model?: string; effort?: string; attribution?: Record<string, unknown> },
    ];
    expect(projectPath).toBe('C:/p');
    expect(prompt).toContain('EVALUATION task');
    expect(resume).toBeUndefined();
    // Events reach the pass through the settlement seam, not an onEvent callback.
    expect(onEvent).toBeUndefined();
    expect(options.model).toBe('opus');
    expect(options.effort).toBe('high');
    expect(options.attribution).toMatchObject({ taskType: 'deep-eval', moduleId: 'audio' });

    const polled = await GET(new NextRequest(`${URL_BASE}?project=${encodeURIComponent('C:/p')}`));
    const polledJson = await polled.json();
    expect(polledJson.data.job.status).toBe('running');
    expect(polledJson.data.job.scanId).toBe(startedJson.data.scanId);
    expect(polledJson.data.job.progress.passStatuses.audio).toBeDefined();

    const again = await POST(post({ projectPath: 'C:/p', ueVersion: '5.5', moduleIds: ['audio'] }));
    expect(again.status).toBe(409);

    const cancelled = await DELETE(new NextRequest(`${URL_BASE}?project=${encodeURIComponent('C:/p')}`, { method: 'DELETE' }));
    const cancelledJson = await cancelled.json();
    expect(cancelledJson.data.job.status).toBe('cancelled');
    expect(abortExecution.mock.calls.map((c) => c[0]).sort()).toEqual(['exec-1', 'exec-2', 'exec-3', 'exec-4']);
    // The cancel contract: nothing unfinished is claimed as evaluated.
    expect(cancelledJson.data.job.result.modulesEvaluated).toEqual([]);
    expect(cancelledJson.data.job.result.failedModules).toEqual(['audio']);
  });

  it('refuses a start with no project path', async () => {
    const res = await POST(post({ moduleIds: ['audio'] }));
    expect(res.status).toBe(400);
  });

  it('GET for a project with no job returns job null', async () => {
    const res = await GET(new NextRequest(`${URL_BASE}?project=${encodeURIComponent('C:/none')}`));
    const json = await res.json();
    expect(json.data.job).toBeNull();
  });
});

describe('POST /api/evaluator/deep-eval refuses a ueVersion no pass can run under', () => {
  for (const ueVersion of [undefined, '', 'abc', '4.27', 42]) {
    it(`answers ${JSON.stringify(ueVersion)} with a 400 naming the field, starting no job`, async () => {
      const before = startExecution.mock.calls.length;
      const res = await POST(post({ projectPath: 'C:/refused', moduleIds: ['audio'], ...(ueVersion === undefined ? {} : { ueVersion }) }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('ueVersion');
      expect(startExecution.mock.calls.length).toBe(before);
      const polled = await GET(new NextRequest(`${URL_BASE}?project=${encodeURIComponent('C:/refused')}`));
      expect((await polled.json()).data.job).toBeNull();
    });
  }
});

describe('POST /api/evaluator/deep-eval refuses module ids outside the module universe', () => {
  for (const ids of [['nope'], ['audio', 'arpg-combt'], ['constructor']]) {
    it(`answers ${JSON.stringify(ids)} with a 400 naming the unknown id, starting no job`, async () => {
      const before = startExecution.mock.calls.length;
      const project = `C:/unknown-${ids.join('-')}`;
      const res = await POST(post({ projectPath: project, ueVersion: '5.5', moduleIds: ids }));
      expect(res.status).toBe(400);
      const unknown = ids.filter((id) => id !== 'audio');
      expect((await res.json()).error).toContain(unknown.join(', '));
      expect(startExecution.mock.calls.length).toBe(before);
      const polled = await GET(new NextRequest(`${URL_BASE}?project=${encodeURIComponent(project)}`));
      expect((await polled.json()).data.job).toBeNull();
    });
  }
});
