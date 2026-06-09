import { describe, it, expect } from 'vitest';
import { diffScans, mergeBaseline } from '@/lib/evaluator/regression-diff';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

let seq = 0;
function mk(partial: Partial<EvalFinding> & { description: string }): EvalFinding {
  return {
    id: `f-${seq++}`,
    scanId: 'scan-x',
    moduleId: 'arpg-combat' as SubModuleId,
    pass: 'structure',
    category: 'General',
    severity: 'medium',
    file: null,
    line: null,
    suggestedFix: '',
    effort: 'small',
    timestamp: 0,
    ...partial,
  };
}

describe('diffScans', () => {
  it('treats a null previous as a baseline: no prior scan, everything tagged new', () => {
    const current = [mk({ description: 'Missing null check', file: 'a.cpp' })];
    const diff = diffScans(null, current);

    expect(diff.hasPrevious).toBe(false);
    expect(diff.tagged.every((t) => t.status === 'new')).toBe(true);
    expect(diff.resolved).toHaveLength(0);
  });

  it('tags findings as new, persisting, and resolved across two scans', () => {
    const previous = [
      mk({ description: 'Persisting issue', file: 'a.cpp', severity: 'high' }),
      mk({ description: 'Fixed issue', file: 'b.cpp', severity: 'critical' }),
    ];
    const current = [
      mk({ description: 'Persisting issue', file: 'a.cpp', severity: 'high' }),
      mk({ description: 'Brand new issue', file: 'c.cpp', severity: 'critical' }),
    ];

    const diff = diffScans(previous, current);

    expect(diff.hasPrevious).toBe(true);
    const byDesc = Object.fromEntries(diff.tagged.map((t) => [t.description, t.status]));
    expect(byDesc['Persisting issue']).toBe('persisting');
    expect(byDesc['Brand new issue']).toBe('new');

    expect(diff.resolved).toHaveLength(1);
    expect(diff.resolved[0].description).toBe('Fixed issue');
  });

  it('matches a finding that shifted line numbers as persisting, not new+resolved', () => {
    const previous = [mk({ description: 'Same issue', file: 'a.cpp', line: 10 })];
    const current = [mk({ description: 'Same issue', file: 'a.cpp', line: 42 })];

    const diff = diffScans(previous, current);

    expect(diff.tagged[0].status).toBe('persisting');
    expect(diff.resolved).toHaveLength(0);
  });

  it('summarizes counts per severity for new, resolved, and persisting', () => {
    const previous = [
      mk({ description: 'old crit', file: 'a.cpp', severity: 'critical' }),
      mk({ description: 'still here', file: 'b.cpp', severity: 'medium' }),
    ];
    const current = [
      mk({ description: 'still here', file: 'b.cpp', severity: 'medium' }),
      mk({ description: 'new crit', file: 'c.cpp', severity: 'critical' }),
      mk({ description: 'new high', file: 'd.cpp', severity: 'high' }),
    ];

    const diff = diffScans(previous, current);

    expect(diff.summary.newTotal).toBe(2);
    expect(diff.summary.new.critical).toBe(1);
    expect(diff.summary.new.high).toBe(1);
    expect(diff.summary.resolvedTotal).toBe(1);
    expect(diff.summary.resolved.critical).toBe(1);
    expect(diff.summary.persistingTotal).toBe(1);
    expect(diff.summary.persisting.medium).toBe(1);
  });

  it('scopes the diff to evaluated modules so a single-module re-eval does not mark other modules resolved', () => {
    const previous = [
      mk({ description: 'combat issue', moduleId: 'arpg-combat', file: 'combat.cpp' }),
      mk({ description: 'loot issue', moduleId: 'arpg-loot', file: 'loot.cpp' }),
    ];
    // Re-evaluated only arpg-combat; the combat issue is gone now.
    const current: EvalFinding[] = [];

    const diff = diffScans(previous, current, { scopeModuleIds: ['arpg-combat'] });

    // Only the combat issue counts as resolved; the loot issue is out of scope.
    expect(diff.resolved).toHaveLength(1);
    expect(diff.resolved[0].description).toBe('combat issue');
  });

  it('exposes a status-by-id lookup for tagging the tree', () => {
    const current = [mk({ id: 'fixed-id', description: 'x', file: 'a.cpp' })];
    const diff = diffScans([], current);
    expect(diff.statusById['fixed-id']).toBe('new');
  });
});

describe('mergeBaseline', () => {
  it('replaces re-evaluated modules and keeps untouched modules from the previous baseline', () => {
    const previous = [
      mk({ description: 'combat old', moduleId: 'arpg-combat', file: 'combat.cpp' }),
      mk({ description: 'loot keep', moduleId: 'arpg-loot', file: 'loot.cpp' }),
    ];
    const current = [
      mk({ description: 'combat new', moduleId: 'arpg-combat', file: 'combat.cpp' }),
    ];

    const merged = mergeBaseline(previous, current, ['arpg-combat']);
    const descs = merged.map((f) => f.description).sort();
    expect(descs).toEqual(['combat new', 'loot keep']);
  });

  it('returns just the current findings when there is no previous baseline', () => {
    const current = [mk({ description: 'first', moduleId: 'arpg-combat' })];
    expect(mergeBaseline(null, current, ['arpg-combat'])).toEqual(current);
  });
});
