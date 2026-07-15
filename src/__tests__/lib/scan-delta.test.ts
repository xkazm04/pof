import { describe, it, expect } from 'vitest';
import { deriveScanDeltas } from '@/lib/evaluator/scan-delta';
import type { ScanLike } from '@/lib/evaluator/scan-delta';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

let seq = 0;
function finding(over: Partial<EvalFinding> & { file: string; description: string }): EvalFinding {
  return {
    id: over.id ?? `f${seq++}`,
    scanId: over.scanId ?? 'scan',
    moduleId: (over.moduleId ?? 'arpg-combat') as EvalFinding['moduleId'],
    pass: over.pass ?? 'quality',
    category: over.category ?? 'General',
    severity: over.severity ?? 'high',
    file: over.file,
    line: over.line ?? 1,
    description: over.description,
    suggestedFix: 'fix',
    effort: 'small',
    timestamp: 1,
  };
}

/** Build a newest-first scan list from oldest→newest findings arrays. */
function scans(...entries: { id: string; ts: string; modules: string[]; findings: EvalFinding[] }[]): ScanLike[] {
  return entries
    .map((e) => ({ scanId: e.id, scannedAt: e.ts, timestamp: Date.parse(e.ts), modulesEvaluated: e.modules, findings: e.findings }))
    .reverse(); // caller passes oldest→newest; feed expects newest-first
}

describe('deriveScanDeltas', () => {
  it('returns [] for empty history', () => {
    expect(deriveScanDeltas([])).toEqual([]);
  });

  it('marks the oldest scan as the baseline (no previous, nothing resolved)', () => {
    const f = [finding({ file: 'A.cpp', description: 'leak', severity: 'critical' })];
    const deltas = deriveScanDeltas(scans({ id: 's1', ts: '2026-07-15T01:00:00Z', modules: ['arpg-combat'], findings: f }));
    expect(deltas).toHaveLength(1);
    expect(deltas[0].hasPrevious).toBe(false);
    expect(deltas[0].newTotal).toBe(1);
    expect(deltas[0].resolvedTotal).toBe(0);
    expect(deltas[0].newBySeverity.critical).toBe(1);
  });

  it('diffs each scan against the immediately-older one (new/resolved/persisting)', () => {
    const a = finding({ id: 'a', file: 'A.cpp', description: 'leak' });
    const b = finding({ id: 'b', file: 'B.cpp', description: 'null deref' });
    const bAgain = finding({ id: 'b2', file: 'B.cpp', description: 'null deref' }); // same fingerprint as b
    const c = finding({ id: 'c', file: 'C.cpp', description: 'race' });

    // scan1: {a, b}  →  scan2: {b, c}  (a resolved, c new, b persisting)
    const deltas = deriveScanDeltas(
      scans(
        { id: 's1', ts: '2026-07-15T01:00:00Z', modules: ['arpg-combat'], findings: [a, b] },
        { id: 's2', ts: '2026-07-15T02:00:00Z', modules: ['arpg-combat'], findings: [bAgain, c] },
      ),
    );

    // newest-first: s2 then s1
    expect(deltas.map((d) => d.scanId)).toEqual(['s2', 's1']);
    const s2 = deltas[0];
    expect(s2.hasPrevious).toBe(true);
    expect(s2.newTotal).toBe(1); // c
    expect(s2.resolvedTotal).toBe(1); // a
    expect(s2.persistingTotal).toBe(1); // b
  });

  it('scopes the diff to the modules a scan re-evaluated (untouched modules not falsely resolved)', () => {
    const combat = finding({ id: 'x', file: 'Combat.cpp', description: 'combat issue', moduleId: 'arpg-combat' });
    const loot = finding({ id: 'y', file: 'Loot.cpp', description: 'loot issue', moduleId: 'arpg-loot' });

    // scan1 (both modules) baseline {combat, loot}; scan2 re-evaluates only arpg-combat
    // and combat's issue is gone. loot must NOT be reported resolved (out of scope).
    const deltas = deriveScanDeltas(
      scans(
        { id: 's1', ts: '2026-07-15T01:00:00Z', modules: ['arpg-combat', 'arpg-loot'], findings: [combat, loot] },
        { id: 's2', ts: '2026-07-15T02:00:00Z', modules: ['arpg-combat'], findings: [loot] },
      ),
    );

    const s2 = deltas[0];
    expect(s2.resolvedTotal).toBe(1); // only combat (in scope), NOT loot
    expect(s2.newTotal).toBe(0);
  });
});
