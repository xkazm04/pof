import { describe, it, expect } from 'vitest';
import { computeProjectHealth } from '@/lib/health-engine';
import type {
  ProjectHealthSummary,
  PerfHealthInput,
  CrashHealthInput,
} from '@/types/project-health';
import type { EvaluatorReport } from '@/types/evaluator';

/**
 * The holistic health summary fuses the latest performance triage and the
 * crash-analyzer stats into a real Performance dimension + drillable subsystem
 * signals (previously both were hardcoded as "Ready"/healthy).
 */

function signal(summary: ProjectHealthSummary, subsystem: string) {
  return summary.subsystemSignals.find((s) => s.subsystem === subsystem);
}

describe('computeProjectHealth — performance fusion', () => {
  it('reports a null performance score and an inactive, drillable perf signal when untriaged', () => {
    const h = computeProjectHealth({}, [], null);
    expect(h.performanceScore).toBeNull();

    const perf = signal(h, 'performance');
    expect(perf).toBeDefined();
    expect(perf!.status).toBe('inactive');
    expect(perf!.linkTab).toBe('perf');
  });

  it('fuses the triage overallScore into performanceScore and a healthy perf signal', () => {
    const perfInput: PerfHealthInput = {
      overallScore: 82,
      bottleneck: 'game-thread',
      avgFPS: 58,
      findingCount: 3,
      sessionName: 'Combat 50 enemies',
    };
    const h = computeProjectHealth({}, [], null, perfInput, null);

    expect(h.performanceScore).toBe(82);
    const perf = signal(h, 'performance')!;
    expect(perf.status).toBe('healthy'); // 82 >= 70
    expect(perf.metric).toContain('82');
    expect(perf.detail).toContain('58 FPS');
    expect(perf.detail).toContain('game-thread');
    expect(perf.detail).toContain('3 findings');
    expect(perf.linkTab).toBe('perf');
  });

  it('maps a low triage score to a critical perf signal', () => {
    const perfInput: PerfHealthInput = {
      overallScore: 30,
      bottleneck: 'gpu',
      avgFPS: 22,
      findingCount: 9,
      sessionName: null,
    };
    const h = computeProjectHealth({}, [], null, perfInput, null);
    expect(h.performanceScore).toBe(30);
    expect(signal(h, 'performance')!.status).toBe('critical'); // < 40
  });
});

describe('computeProjectHealth — crash fusion', () => {
  it('reports an inactive, drillable crash signal when no crash data is supplied', () => {
    const h = computeProjectHealth({}, [], null);
    const crash = signal(h, 'crash-analyzer')!;
    expect(crash.status).toBe('inactive');
    expect(crash.linkTab).toBe('crashes');
  });

  it('reports a healthy crash signal when zero crashes are recorded', () => {
    const crashInput: CrashHealthInput = {
      totalCrashes: 0,
      recentCrashes: 0,
      criticalCrashes: 0,
      systemicIssues: 0,
      mostAffectedModule: 'none',
    };
    const h = computeProjectHealth({}, [], null, null, crashInput);
    const crash = signal(h, 'crash-analyzer')!;
    expect(crash.status).toBe('healthy');
    expect(crash.metric).toBe('No crashes');
  });

  it('reports a critical crash signal with counts for critical/systemic crashes', () => {
    const crashInput: CrashHealthInput = {
      totalCrashes: 7,
      recentCrashes: 2,
      criticalCrashes: 3,
      systemicIssues: 1,
      mostAffectedModule: 'arpg-combat',
    };
    const h = computeProjectHealth({}, [], null, null, crashInput);
    const crash = signal(h, 'crash-analyzer')!;
    expect(crash.status).toBe('critical');
    expect(crash.metric).toContain('7');
    expect(crash.detail).toContain('arpg-combat');
    expect(crash.detail).toContain('2 in 24h');
    expect(crash.detail).toContain('1 systemic');
  });

  it('reports a warning crash signal when only recent (non-critical) crashes exist', () => {
    const crashInput: CrashHealthInput = {
      totalCrashes: 2,
      recentCrashes: 1,
      criticalCrashes: 0,
      systemicIssues: 0,
      mostAffectedModule: 'arpg-loot',
    };
    const h = computeProjectHealth({}, [], null, null, crashInput);
    expect(signal(h, 'crash-analyzer')!.status).toBe('warning');
  });
});

describe('computeProjectHealth — evaluator signal + back-compat', () => {
  it('drives the evaluator signal from the latest scan score and makes it drillable', () => {
    const lastScan: EvaluatorReport = {
      id: 's1',
      timestamp: 1,
      overallScore: 45,
      moduleScores: [],
      recommendations: [],
      summary: '',
    };
    const h = computeProjectHealth({}, [], lastScan);
    const ev = signal(h, 'evaluator')!;
    expect(ev.status).toBe('warning'); // 40 <= 45 < 70
    expect(ev.metric).toContain('45');
    expect(ev.linkTab).toBe('scanner');
  });

  it('keeps the legacy 3-arg call working with the new signals present', () => {
    const h = computeProjectHealth({}, [], null);
    expect(h.performanceScore).toBeNull();
    expect(signal(h, 'performance')).toBeDefined();
    expect(signal(h, 'crash-analyzer')).toBeDefined();
  });
});
