/**
 * `mcpGateForJob` promises ONE verdict per job — a paid provider result is downloaded and
 * critiqued once. The memo only covered a FINISHED grade: two status polls that overlap
 * (the critique spawns python and can outlast the queue's poll interval) both missed the
 * memo and each downloaded and critiqued the mesh. `ledger.importOnce` already joins an
 * in-flight import the same way; this pins the gate to that rule. Injected deps only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpGateForJob, __resetMcpGrades } from '@/lib/blender-mcp/mcp-gate';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import type { MeshFetchOutcome } from '@/lib/visual-gen/mesh-fetch';

const PASS: CritiqueResult = { ok: true, verdict: 'pass', score: 88, reasons: [], metrics: undefined };
const JOB = { jobId: 'j-overlap', status: 'completed' as const, resultUrl: 'https://hyperhuman.deemos.com/x.glb' };
const FETCHED = { ok: true, path: '/generated/mcp/j-overlap.glb', name: 'j-overlap.glb', bytes: 2048 } as MeshFetchOutcome;

beforeEach(() => __resetMcpGrades());

describe('mcpGateForJob in-flight dedupe', () => {
  it('two overlapping polls share one download and one critique', async () => {
    let release!: () => void;
    const gateOpen = new Promise<void>((r) => { release = r; });
    const fetchMesh = vi.fn(async () => { await gateOpen; return FETCHED; });
    const critique = vi.fn(async () => PASS);

    const first = mcpGateForJob(JOB, { fetchMesh, critique });
    const second = mcpGateForJob(JOB, { fetchMesh, critique });
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(fetchMesh).toHaveBeenCalledTimes(1);
    expect(critique).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('a grade that throws is not memoised, so the next poll can retry', async () => {
    const fetchMesh = vi.fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(FETCHED);
    const critique = vi.fn(async () => PASS);

    await expect(mcpGateForJob(JOB, { fetchMesh, critique })).rejects.toThrow('socket hang up');
    const gate = await mcpGateForJob(JOB, { fetchMesh, critique });
    expect(gate.accepted).toBe(true);
    expect(fetchMesh).toHaveBeenCalledTimes(2);
  });
});
