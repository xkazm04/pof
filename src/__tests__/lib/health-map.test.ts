import { describe, it, expect } from 'vitest';
import { buildModuleHealth, layoutHealthMap, type ModuleHealthNode } from '@/lib/crash-health/health-map';

const reports = [
  { id: 'c1', mappedModule: 'arpg-character', severity: 'critical' as const },
  { id: 'c2', mappedModule: 'arpg-character', severity: 'high' as const },
  { id: 'c3', mappedModule: 'arpg-character', severity: 'low' as const },
  { id: 'c4', mappedModule: 'arpg-combat', severity: 'low' as const },
];
const patterns = [
  { name: 'Null in HandleDeath', occurrences: 3, isSystemic: true, crashIds: ['c1', 'c2'] },
  { name: 'Bigger', occurrences: 5, isSystemic: false, crashIds: ['c3'] },
  { name: 'Combat ensure', occurrences: 2, isSystemic: false, crashIds: ['c4'] },
];

describe('buildModuleHealth', () => {
  const nodes = buildModuleHealth({ reports, patterns });

  it('ranks the higher-risk module first', () => {
    expect(nodes[0].moduleId).toBe('arpg-character');
    expect(nodes[0].riskScore).toBeGreaterThan(nodes[1].riskScore);
  });

  it('counts crashes and worst severity per module', () => {
    expect(nodes[0].crashCount).toBe(3);
    expect(nodes[0].maxSeverity).toBe('critical');
    const combat = nodes.find((n) => n.moduleId === 'arpg-combat')!;
    expect(combat.crashCount).toBe(1);
    expect(combat.maxSeverity).toBe('low');
  });

  it('attributes patterns to a module, sorted by occurrences and capped at 3', () => {
    expect(nodes[0].patternCount).toBe(2);
    expect(nodes[0].topPatterns[0].name).toBe('Bigger');      // 5 > 3
    expect(nodes[0].topPatterns[1].name).toBe('Null in HandleDeath');
    expect(nodes[0].topPatterns.length).toBeLessThanOrEqual(3);
    expect(nodes[0].systemicCount).toBe(1);
  });
});

describe('layoutHealthMap', () => {
  const nodes: ModuleHealthNode[] = [
    { moduleId: 'a', crashCount: 10, riskScore: 20, maxSeverity: 'critical', patternCount: 0, systemicCount: 0, topPatterns: [] },
    { moduleId: 'b', crashCount: 2, riskScore: 5, maxSeverity: 'low', patternCount: 0, systemicCount: 0, topPatterns: [] },
    { moduleId: 'c', crashCount: 5, riskScore: 10, maxSeverity: 'high', patternCount: 0, systemicCount: 0, topPatterns: [] },
  ];

  it('is deterministic and preserves node count', () => {
    const a = layoutHealthMap(nodes, { width: 640, height: 420 });
    expect(a).toEqual(layoutHealthMap(nodes, { width: 640, height: 420 }));
    expect(a).toHaveLength(3);
  });

  it('places the highest-risk node at the centre', () => {
    const pos = layoutHealthMap(nodes, { width: 640, height: 420 });
    expect(pos[0].node.moduleId).toBe('a');
    expect(pos[0].x).toBeCloseTo(320);
    expect(pos[0].y).toBeCloseTo(210);
  });

  it('sizes node radius by crash count', () => {
    const pos = layoutHealthMap(nodes, { width: 640, height: 420 });
    const ra = pos.find((p) => p.node.moduleId === 'a')!.r;
    const rb = pos.find((p) => p.node.moduleId === 'b')!.r;
    expect(ra).toBeGreaterThan(rb);
  });
});
