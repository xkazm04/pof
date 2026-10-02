/**
 * scan-sweep --challenge (module-topology-graph/A): every Nexus overlay is ONE pure
 * projection over durable sources — session_analytics module stats, the persisted
 * deep-eval scans, and the pattern-library dashboard — instead of client stores
 * nothing writes. A module with no data reads `null` (no badge), never 0, and a
 * FAILED source is never drawn as an empty/clean one.
 */
import { describe, it, expect } from 'vitest';
import { projectNexusSignals } from '@/lib/evaluator/nexus-signals';
import type { SourceState } from '@/lib/evaluator/nexus-signals';
import { buildModuleTopology, TOPOLOGY_ROOMY } from '@/lib/topology/moduleGraph';
import type { ScanLike } from '@/lib/evaluator/scan-delta';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { ModuleStats } from '@/types/session-analytics';
import type { SubModuleId } from '@/types/modules';

const NODES = buildModuleTopology(new Map(), TOPOLOGY_ROOMY).nodes;

function ready<T>(data: T): SourceState<T> {
  return { state: 'ready', data };
}

function stats(moduleId: string, totalSessions: number, successCount: number, avgDurationMs: number): ModuleStats {
  return {
    moduleId: moduleId as SubModuleId,
    totalSessions,
    successCount,
    failCount: totalSessions - successCount,
    successRate: totalSessions ? successCount / totalSessions : 0,
    avgDurationMs,
    avgSuccessDurationMs: avgDurationMs,
    avgFailDurationMs: 0,
    contextInjectedCount: 0,
    contextInjectedSuccessRate: 0,
    noContextCount: 0,
    noContextSuccessRate: 0,
  };
}

const CRIT: EvalFinding = {
  id: 'f-crit',
  scanId: 's1',
  moduleId: 'arpg-combat' as SubModuleId,
  pass: 'quality',
  category: 'gas',
  severity: 'critical',
  file: 'Source/Combat.cpp',
  line: 7,
  description: 'Combat crit',
  suggestedFix: 'fix it',
  effort: 'small',
  timestamp: 0,
};

const SCAN: ScanLike = {
  scanId: 's1',
  scannedAt: new Date(1000).toISOString(),
  timestamp: 1000,
  modulesEvaluated: ['arpg-combat', 'arpg-loot'],
  findings: [CRIT],
};

function node<N extends { moduleId: string }>(nodes: readonly N[], id: string): N {
  const n = nodes.find((x) => x.moduleId === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
}

describe('projectNexusSignals', () => {
  it('runs: per-module session counts, success rate and duration from session_analytics; absent module = 0 sessions, null duration', () => {
    const { nodes, layerState } = projectNexusSignals(NODES, {
      runs: ready([stats('arpg-combat', 4, 3, 90000)]),
    });
    const combat = node(nodes, 'arpg-combat');
    expect(combat.sessionCount).toBe(4);
    expect(combat.runSuccessRate).toBe(0.75);
    expect(combat.avgDurationMs).toBe(90000);
    const loot = node(nodes, 'arpg-loot');
    expect(loot.sessionCount).toBe(0);
    expect(loot.avgDurationMs).toBeNull();
    expect(layerState.sessions).toBe('ready');
  });

  it('runs failed: the sessions layer is failed and no node claims 0 sessions', () => {
    const { nodes, layerState } = projectNexusSignals(NODES, {
      runs: { state: 'failed', error: 'boom' },
    });
    expect(layerState.sessions).toBe('failed');
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) expect(n.sessionCount).toBeNull();
  });

  it('findings: critical count + health from the newest persisted scan; an unevaluated module is null, not 0/clean', () => {
    const { nodes, layerState, recommendationsByModule } = projectNexusSignals(NODES, {
      findings: ready([SCAN]),
    });
    const combat = node(nodes, 'arpg-combat');
    expect(combat.criticalFindings).toBe(1);
    expect(combat.healthScore).toBe(80);
    const loot = node(nodes, 'arpg-loot');
    expect(loot.criticalFindings).toBe(0);
    expect(loot.healthScore).toBe(100);
    const gas = node(nodes, 'arpg-gas');
    expect(gas.criticalFindings).toBeNull();
    expect(gas.healthScore).toBeNull();
    expect(layerState.builds).toBe('ready');
    expect(recommendationsByModule.get('arpg-combat')?.map((r) => r.id)).toEqual(['f-crit']);
  });

  it('patterns: mean success rate and count per module from the dashboard rows; a module with none is null', () => {
    const { nodes, layerState } = projectNexusSignals(NODES, {
      patterns: ready([
        { moduleId: 'arpg-gas', successRate: 0.5 },
        { moduleId: 'arpg-gas', successRate: 1.0 },
      ]),
    });
    const gas = node(nodes, 'arpg-gas');
    expect(gas.patternSuccessRate).toBe(0.75);
    expect(gas.patternCount).toBe(2);
    expect(node(nodes, 'arpg-loot').patternSuccessRate).toBeNull();
    expect(layerState.patterns).toBe('ready');
  });

  it('a source not yet settled is loading, and its fields stay null', () => {
    const { nodes, layerState } = projectNexusSignals(NODES, {});
    expect(layerState).toMatchObject({ sessions: 'loading', builds: 'loading', patterns: 'loading', genre: 'ready' });
    const combat = node(nodes, 'arpg-combat');
    expect(combat.sessionCount).toBeNull();
    expect(combat.criticalFindings).toBeNull();
    expect(combat.patternCount).toBeNull();
  });
});
