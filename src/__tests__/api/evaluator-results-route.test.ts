import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/evaluator/results/route';
import { getDb } from '@/lib/db';
import { ensureEvaluatorResultsTable } from '@/lib/evaluator/evaluator-results-db';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

function finding(id: string, severity: EvalFinding['severity'] = 'high'): EvalFinding {
  return {
    id,
    scanId: 'scan',
    moduleId: 'arpg-combat' as EvalFinding['moduleId'],
    pass: 'quality',
    category: 'General',
    severity,
    file: 'C.cpp',
    line: 1,
    description: 'd',
    suggestedFix: 'f',
    effort: 'small',
    timestamp: 1,
  };
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/evaluator/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/evaluator/results', () => {
  beforeEach(() => {
    ensureEvaluatorResultsTable();
    getDb().exec('DELETE FROM evaluator_results;');
  });

  it('POST persists a scan and GET reads it back newest-first', async () => {
    const postRes = await POST(
      postReq({
        scanId: 'scan-1',
        projectId: '/proj',
        durationMs: 500,
        modulesEvaluated: ['arpg-combat'],
        failedModules: [],
        findings: [finding('a', 'critical'), finding('b')],
      }),
    );
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.data.scan.scanId).toBe('scan-1');
    expect(postJson.data.scan.totalFindings).toBe(2);
    expect(postJson.data.scan.severityCounts).toEqual({ critical: 1, high: 1, medium: 0, low: 0 });

    const getRes = await GET(new NextRequest('http://localhost/api/evaluator/results?limit=10'));
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.scans).toHaveLength(1);
    expect(getJson.data.scans[0].findings).toHaveLength(2);
  });

  it('GET ?latest=1 returns the most recent scan', async () => {
    await POST(postReq({ scanId: 's1', scannedAt: '2026-07-15T01:00:00.000Z', modulesEvaluated: [], findings: [] }));
    await POST(postReq({ scanId: 's2', scannedAt: '2026-07-15T02:00:00.000Z', modulesEvaluated: [], findings: [] }));

    const res = await GET(new NextRequest('http://localhost/api/evaluator/results?latest=1'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.scan.scanId).toBe('s2');
  });

  it('GET ?project= scopes the latest scan to that project', async () => {
    await POST(postReq({ scanId: 'a1', projectId: '/proj-a', scannedAt: '2026-07-15T01:00:00.000Z', modulesEvaluated: [], findings: [] }));
    await POST(postReq({ scanId: 'b1', projectId: '/proj-b', scannedAt: '2026-07-15T02:00:00.000Z', modulesEvaluated: [], findings: [] }));

    const res = await GET(new NextRequest('http://localhost/api/evaluator/results?latest=1&project=%2Fproj-a'));
    const json = await res.json();
    expect(json.data.scan.scanId).toBe('a1');
  });

  it('GET with an EMPTY ?project= returns no baseline rather than another project\'s', async () => {
    // The baseline is a verdict input: a request scoped to the no-project rows must
    // never be answered with a scan belonging to a real project.
    await POST(postReq({ scanId: 'b1', projectId: '/proj-b', scannedAt: '2026-07-15T02:00:00.000Z', modulesEvaluated: [], findings: [] }));

    const res = await GET(new NextRequest('http://localhost/api/evaluator/results?latest=1&project='));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.scan).toBeNull();

    const listRes = await GET(new NextRequest('http://localhost/api/evaluator/results?project='));
    const listJson = await listRes.json();
    expect(listJson.data.scans).toEqual([]);
  });

  it('GET without ?project= still spans every project', async () => {
    await POST(postReq({ scanId: 'a1', projectId: '/proj-a', scannedAt: '2026-07-15T01:00:00.000Z', modulesEvaluated: [], findings: [] }));
    await POST(postReq({ scanId: 'b1', projectId: '/proj-b', scannedAt: '2026-07-15T02:00:00.000Z', modulesEvaluated: [], findings: [] }));

    const res = await GET(new NextRequest('http://localhost/api/evaluator/results?latest=1'));
    const json = await res.json();
    expect(json.data.scan.scanId).toBe('b1');
  });

  it('POST rejects a missing scanId with 400', async () => {
    const res = await POST(postReq({ findings: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('POST rejects non-array findings with 400', async () => {
    const res = await POST(postReq({ scanId: 'x', findings: 'nope' }));
    expect(res.status).toBe(400);
  });
});
