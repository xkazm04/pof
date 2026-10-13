/**
 * POST /api/experiment/run runs caller-supplied Python inside a launched UE editor, and
 * DELETE /api/experiment/runs/:id removes a stored run. Both sit behind `requireOperator`:
 * a cross-site browser request is refused before anything starts, and the run route never
 * forwards a caller-chosen `uproject` or `engine` to the job (the runner resolves both
 * from the environment).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const startExperimentJob = vi.fn<(spec: unknown) => string>(() => 'job-1');
const deleteExperimentRun = vi.fn<(id: string) => boolean>(() => true);

vi.mock('@/lib/ue-experiment/job-store', () => ({ startExperimentJob: (spec: unknown) => startExperimentJob(spec) }));
vi.mock('@/lib/ue-experiment/experiment-db', () => ({
  getExperimentRun: () => null,
  deleteExperimentRun: (id: string) => deleteExperimentRun(id),
}));

const { POST } = await import('@/app/api/experiment/run/route');
const { DELETE } = await import('@/app/api/experiment/runs/[id]/route');

function postRun(body: unknown, headers: Record<string, string> = {}) {
  return POST(new NextRequest('http://localhost:3001/api/experiment/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  }));
}

function deleteRun(id: string, headers: Record<string, string> = {}) {
  return DELETE(
    new NextRequest(`http://localhost:3001/api/experiment/runs/${id}`, { method: 'DELETE', headers: { host: 'localhost:3001', ...headers } }),
    { params: Promise.resolve({ id }) },
  );
}

const savedToken = process.env.POF_OPERATOR_TOKEN;

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  startExperimentJob.mockClear();
  deleteExperimentRun.mockClear();
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('POST /api/experiment/run — operator guard', () => {
  it('refuses a foreign Origin with 403 and starts no job', async () => {
    const res = await postRun({ python: "unreal.log('x')" }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(startExperimentJob).not.toHaveBeenCalled();
  });

  it('refuses a call without the operator token when one is configured', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await postRun({ python: "unreal.log('x')" });
    expect(res.status).toBe(401);
    expect(startExperimentJob).not.toHaveBeenCalled();
  });

  it('starts a same-origin run and never forwards uproject or engine', async () => {
    const res = await postRun(
      { python: "unreal.log('x')", uproject: 'C:/elsewhere/Other.uproject', engine: 'C:/evil/UE' },
      { origin: 'http://localhost:3001' },
    );
    expect(res.status).toBe(202);
    expect(startExperimentJob).toHaveBeenCalledTimes(1);
    const spec = startExperimentJob.mock.calls[0][0] as Record<string, unknown>;
    expect(spec.python).toBe("unreal.log('x')");
    expect('uproject' in spec).toBe(false);
    expect('engine' in spec).toBe(false);
  });
});

describe('DELETE /api/experiment/runs/:id — operator guard', () => {
  it('refuses a foreign Origin with 403 and deletes nothing', async () => {
    const res = await deleteRun('exp-1', { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(deleteExperimentRun).not.toHaveBeenCalled();
  });

  it('deletes on a same-origin call', async () => {
    const res = await deleteRun('exp-1', { origin: 'http://localhost:3001' });
    expect(res.status).toBe(200);
    expect(deleteExperimentRun).toHaveBeenCalledWith('exp-1');
  });
});
