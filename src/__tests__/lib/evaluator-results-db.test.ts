import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import {
  recordScanResult,
  getScanHistory,
  getLatestScan,
  ensureEvaluatorResultsTable,
} from '@/lib/evaluator/evaluator-results-db';
import { getDb } from '@/lib/db';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

function finding(over: Partial<EvalFinding> = {}): EvalFinding {
  return {
    id: over.id ?? 'f1',
    scanId: over.scanId ?? 'scan-1',
    moduleId: (over.moduleId ?? 'arpg-combat') as EvalFinding['moduleId'],
    pass: over.pass ?? 'quality',
    category: over.category ?? 'General',
    severity: over.severity ?? 'high',
    file: over.file ?? 'Combat.cpp',
    line: over.line ?? 10,
    description: over.description ?? 'issue',
    suggestedFix: over.suggestedFix ?? 'fix it',
    effort: over.effort ?? 'small',
    timestamp: over.timestamp ?? 1,
  };
}

describe('evaluator-results-db', () => {
  beforeEach(() => {
    ensureEvaluatorResultsTable();
    getDb().exec('DELETE FROM evaluator_results;');
  });

  it('starts empty', () => {
    expect(getScanHistory()).toEqual([]);
    expect(getLatestScan()).toBeNull();
  });

  it('round-trips a scan with findings, module set, and derived counts', () => {
    const findings = [
      finding({ id: 'a', severity: 'critical' }),
      finding({ id: 'b', severity: 'high' }),
      finding({ id: 'c', severity: 'high' }),
    ];
    const saved = recordScanResult({
      scanId: 'scan-1',
      projectId: '/proj',
      scannedAt: '2026-07-15T10:00:00.000Z',
      durationMs: 1234,
      modulesEvaluated: ['arpg-combat', 'arpg-loot'],
      failedModules: ['physics'],
      findings,
    });

    expect(saved.scanId).toBe('scan-1');
    expect(saved.totalFindings).toBe(3);
    expect(saved.severityCounts).toEqual({ critical: 1, high: 2, medium: 0, low: 0 });
    expect(saved.modulesEvaluated).toEqual(['arpg-combat', 'arpg-loot']);
    expect(saved.failedModules).toEqual(['physics']);
    expect(saved.timestamp).toBe(Date.parse('2026-07-15T10:00:00.000Z'));

    const [read] = getScanHistory();
    expect(read.findings).toHaveLength(3);
    expect(read.findings[0].id).toBe('a');
    expect(read.durationMs).toBe(1234);
  });

  it('is idempotent on scanId (re-submit updates, never duplicates)', () => {
    recordScanResult({ scanId: 'dup', modulesEvaluated: ['m'], findings: [finding()] });
    recordScanResult({ scanId: 'dup', modulesEvaluated: ['m'], findings: [finding(), finding({ id: 'f2' })] });

    const history = getScanHistory();
    expect(history).toHaveLength(1);
    expect(history[0].totalFindings).toBe(2);
  });

  it('returns history newest-first and scopes by project', () => {
    recordScanResult({ scanId: 's1', projectId: '/a', scannedAt: '2026-07-15T01:00:00.000Z', modulesEvaluated: [], findings: [] });
    recordScanResult({ scanId: 's2', projectId: '/a', scannedAt: '2026-07-15T02:00:00.000Z', modulesEvaluated: [], findings: [] });
    recordScanResult({ scanId: 's3', projectId: '/b', scannedAt: '2026-07-15T03:00:00.000Z', modulesEvaluated: [], findings: [] });

    const all = getScanHistory();
    expect(all.map((s) => s.scanId)).toEqual(['s3', 's2', 's1']);
    expect(getLatestScan()?.scanId).toBe('s3');

    const projA = getScanHistory(50, '/a');
    expect(projA.map((s) => s.scanId)).toEqual(['s2', 's1']);
    expect(getLatestScan('/a')?.scanId).toBe('s2');
  });
});
