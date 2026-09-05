/**
 * Once a provider mesh CAN reach this server's disk, the MCP job stops projecting
 * "ungated" and reports the Tier-1 verdict — in the same `summarizeGate` vocabulary the
 * runner stores use.
 *
 * Forced-failure suite for `mcp-mesh-download-and-grade`. At HEAD~1 `mcp-gate.ts` had one
 * pure function that answered "delivered, ungated, reason named" for EVERY completed job,
 * because there was no download seam and therefore no file to grade. `mcpGateForJob` did
 * not exist; every assertion below is red.
 *
 * Both the fetch and the critique are injected — no network, no trimesh, and no live
 * provider download happened in the session that wrote this.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mcpGateForJob,
  mcpGateProjection,
  MCP_CRITIQUE_UNAVAILABLE_REASON,
  __resetMcpGrades,
} from '@/lib/blender-mcp/mcp-gate';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

const PASS: CritiqueResult = { ok: true, verdict: 'pass', score: 88, reasons: [], metrics: undefined };
const FAIL: CritiqueResult = { ok: true, verdict: 'fail', score: 31, reasons: ['floaters: 14 components'], metrics: undefined };

function deps(fetchOut: unknown, critique: CritiqueResult = PASS) {
  return {
    fetchMesh: vi.fn().mockResolvedValue(fetchOut),
    critique: vi.fn().mockResolvedValue(critique),
  };
}

const JOB = { jobId: 'j1', status: 'completed' as const, resultUrl: 'https://hyperhuman.deemos.com/x.glb' };
const FETCHED = { ok: true, path: '/generated/mcp/j1.glb', name: 'j1.glb', bytes: 2048 };

beforeEach(() => __resetMcpGrades());

describe('mcpGateForJob', () => {
  it('grades a downloaded mesh and stops calling it ungated', async () => {
    const d = deps(FETCHED);
    const gate = await mcpGateForJob(JOB, d);
    expect(d.fetchMesh).toHaveBeenCalledWith(JOB.resultUrl, 'j1');
    expect(d.critique).toHaveBeenCalledWith('/generated/mcp/j1.glb');
    expect(gate.ungated).toBe(false);
    expect(gate.accepted).toBe(true);
    // The runner stores' words, not a second vocabulary.
    expect(gate.gateReason).toContain('Tier-1 gate pass');
    // The graded file is servable through the shared asset route.
    expect(gate.meshUrl).toContain('/api/visual-gen/asset/j1.glb');
    expect(gate.meshUrl).toContain('dir=mcp');
  });

  it('reports a graded FAILURE as a failure, never as ungated', async () => {
    const gate = await mcpGateForJob(JOB, deps(FETCHED, FAIL));
    expect(gate.accepted).toBe(false);
    expect(gate.ungated).toBe(false);
    expect(gate.gateReason).toContain('Tier-1 gate FAIL');
    expect(gate.gateReason).toContain('floaters');
  });

  it('stays delivered-ungated with the REFUSAL named when the download was refused', async () => {
    const d = deps({ ok: false, reason: 'refused: cdn.evil.com is not on the provider allow-list' });
    const gate = await mcpGateForJob(JOB, d);
    expect(gate.accepted).toBe(false);
    expect(gate.ungated).toBe(true);
    expect(gate.gateReason).toContain('delivered ungated');
    expect(gate.gateReason).toContain('not on the provider allow-list');
    expect(gate.meshUrl).toBeUndefined();
    expect(d.critique).not.toHaveBeenCalled();
  });

  it('stays delivered-ungated with the ORIGINAL reason when the job has no URL at all', async () => {
    const d = deps(FETCHED);
    const gate = await mcpGateForJob({ jobId: 'j1', status: 'completed' }, d);
    expect(gate.ungated).toBe(true);
    expect(gate.gateReason).toContain(MCP_CRITIQUE_UNAVAILABLE_REASON);
    expect(d.fetchMesh).not.toHaveBeenCalled();
  });

  it('stamps nothing on a job that has produced nothing to grade', async () => {
    for (const status of ['pending', 'processing', 'failed'] as const) {
      expect(await mcpGateForJob({ jobId: 'j1', status, resultUrl: JOB.resultUrl }, deps(FETCHED))).toEqual({});
    }
  });

  it('does not re-download or re-grade the same job on every poll', async () => {
    const d = deps(FETCHED);
    await mcpGateForJob(JOB, d);
    const again = await mcpGateForJob(JOB, d);
    expect(d.fetchMesh).toHaveBeenCalledTimes(1);
    expect(d.critique).toHaveBeenCalledTimes(1);
    expect(again.accepted).toBe(true);
  });

  it('keeps the pure no-file projection for callers that never had a URL', () => {
    const gate = mcpGateProjection('completed');
    expect(gate.ungated).toBe(true);
    expect(gate.accepted).toBe(false);
  });
});
