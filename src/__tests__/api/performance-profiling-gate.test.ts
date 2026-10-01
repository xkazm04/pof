/**
 * POST /api/performance-profiling — the stateless 'perf-gate' action: N baseline captures
 * against M candidate captures, gated on the baseline's own run-to-run spread.
 * Captures are SIMULATED (no engine ran).
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/performance-profiling/route';
import { PERF_CAPTURE_EVENTS } from '@/types/observation';
import { simulateCaptureCsv, simulateRun } from '../lib/profiling/simulated-frames';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/performance-profiling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown) {
  const res = await POST(post(body));
  return { status: res.status, json: await res.json() as { success: boolean; data: { gate: { verdict: string; reason: string; runs: unknown[] } }; error?: string } };
}

const capture = (seed: number, inject = 0) =>
  simulateCaptureCsv(simulateRun(seed, { frames: 60 }), simulateRun(seed + 1, { frames: 400 }, inject), PERF_CAPTURE_EVENTS);
const side = (seed: number, inject = 0) => [0, 1, 2, 3, 4].map((r) => capture(seed + r * 11, inject));

describe('POST /api/performance-profiling perf-gate', () => {
  it('SIMULATED: a +2 ms candidate set fails the gate', async () => {
    const r = await call({ action: 'perf-gate', baselineCsvs: side(100), candidateCsvs: side(900, 2), expectedWindowFrames: 400 });
    expect(r.status).toBe(200);
    expect(r.json.data.gate.verdict).toBe('fail');
    expect(r.json.data.gate.runs).toHaveLength(10);
  });

  it('captures with no scenario markers are unverifiable, not a verdict', async () => {
    const noMarkers = 'EVENTS,FrameTime\n' + Array.from({ length: 400 }, () => ',8').join('\n');
    const r = await call({ action: 'perf-gate', baselineCsvs: [noMarkers, noMarkers, noMarkers], candidateCsvs: [noMarkers, noMarkers, noMarkers] });
    expect(r.status).toBe(200);
    expect(r.json.data.gate.verdict).toBe('unverifiable');
    expect(r.json.data.gate.reason).toContain('no-window-start');
  });

  it('rejects a missing or empty capture list with 400', async () => {
    expect((await call({ action: 'perf-gate', baselineCsvs: [], candidateCsvs: ['x'] })).status).toBe(400);
    expect((await call({ action: 'perf-gate', baselineCsvs: ['x'] })).status).toBe(400);
    expect((await call({ action: 'perf-gate', baselineCsvs: ['x', 3], candidateCsvs: ['x'] })).status).toBe(400);
  });
});
