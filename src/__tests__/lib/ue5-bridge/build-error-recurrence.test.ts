/**
 * Recurring build errors are derived from the charted builds' own stored
 * diagnostics (headless_builds.diagnostics_json), fingerprinted, and judged
 * resolved PER LANE (target|type|configuration|platform) — the latest build of
 * each lane the error occurred in decides whether it is still failing.
 *
 * Before this module the Build Health card read `error_memory`, a project-blind
 * table no build in the app writes (the only enqueue caller sends no moduleId).
 */

import { describe, it, expect } from 'vitest';
import {
  deriveRecurringErrors,
  laneLabel,
  type RecurrenceBuild,
} from '@/lib/ue5-bridge/build-error-recurrence';

const UNDECLARED = "'UFoo': undeclared identifier";

function diag(message: string, line: number, severity: 'error' | 'warning' = 'error', code: string | null = 'C2065') {
  return { id: `d-${line}`, severity, file: 'A.cpp', line, column: 1, code, message, rawText: message, category: 'compile' };
}

function mk(o: Partial<RecurrenceBuild> & { buildId: string; createdAt: string }): RecurrenceBuild {
  return {
    targetName: 'Did',
    targetType: 'Editor',
    configuration: 'Development',
    platform: 'Win64',
    status: 'success',
    errorCount: 0,
    diagnosticsJson: null,
    ...o,
  };
}

/** b1 failed (line 12), b2 failed (same message, line 40), b3 = caller's choice. */
function editorSeries(b3: Partial<RecurrenceBuild> = {}): RecurrenceBuild[] {
  return [
    mk({ buildId: 'b1', createdAt: '2026-09-01T10:00:00Z', status: 'failed', errorCount: 1, diagnosticsJson: JSON.stringify([diag(UNDECLARED, 12)]) }),
    mk({ buildId: 'b2', createdAt: '2026-09-02T10:00:00Z', status: 'failed', errorCount: 1, diagnosticsJson: JSON.stringify([diag(UNDECLARED, 40)]) }),
    mk({ buildId: 'b3', createdAt: '2026-09-03T10:00:00Z', ...b3 }),
  ];
}

describe('deriveRecurringErrors', () => {
  it('counts builds containing a fingerprint and marks it resolved when the lane\'s latest build is clean', () => {
    const out = deriveRecurringErrors(editorSeries());
    expect(out).toHaveLength(1);
    const [e] = out;
    expect(e.occurrences).toBe(2);
    expect(e.lastSeenBuildId).toBe('b2');
    expect(e.lastSeenAt).toBe('2026-09-02T10:00:00Z');
    expect(e.stillFailing).toBe(false);
    expect(e.wasResolved).toBe(true);
    expect(e.errorCode).toBe('C2065');
    expect(e.fixDescription).toContain('UFoo');
    expect(e.lane).toBe('DidEditor Development Win64');
    expect(e.buildsScanned).toBe(3);
    expect(typeof e.moduleId).toBe('string');
  });

  it('marks it still failing when the latest lane build still carries it, and sorts still-failing first', () => {
    const builds = [
      ...editorSeries({ status: 'failed', errorCount: 1, diagnosticsJson: JSON.stringify([diag(UNDECLARED, 40)]) }),
      // a DIFFERENT error that recurs more often but was fixed by b3 of its own lane
      ...['x1', 'x2', 'x3', 'x4'].map((id, i) =>
        mk({
          buildId: id,
          targetName: 'Other',
          createdAt: `2026-08-0${i + 1}T10:00:00Z`,
          status: 'failed',
          errorCount: 1,
          diagnosticsJson: JSON.stringify([diag('unresolved external symbol "void __cdecl Bar(void)" (?Bar@@YAXXZ)', 1, 'error', 'LNK2019')]),
        }),
      ),
      mk({ buildId: 'x5', targetName: 'Other', createdAt: '2026-08-05T10:00:00Z' }),
    ];
    const out = deriveRecurringErrors(builds);
    expect(out).toHaveLength(2);
    const undeclared = out.find((e) => e.pattern === 'UFoo')!;
    expect(undeclared.occurrences).toBe(3);
    expect(undeclared.stillFailing).toBe(true);
    expect(undeclared.wasResolved).toBe(false);
    expect(out[0]).toBe(undeclared); // 3 occurrences, but still failing beats 4 resolved
    expect(out[1].occurrences).toBe(4);
    expect(out[1].stillFailing).toBe(false);
  });

  it('judges resolution per lane the error occurred in, not by whichever build ran last overall', () => {
    const builds = [
      mk({ buildId: 's1', targetType: 'Game', configuration: 'Shipping', createdAt: '2026-09-01T10:00:00Z', status: 'failed', errorCount: 1, diagnosticsJson: JSON.stringify([diag(UNDECLARED, 12)]) }),
      mk({ buildId: 'e1', createdAt: '2026-09-02T10:00:00Z' }), // clean Editor build ran LAST overall
    ];
    const [e] = deriveRecurringErrors(builds);
    expect(e.stillFailing).toBe(true);
    expect(e.wasResolved).toBe(false);
    expect(e.lane).toBe('Did Shipping Win64');
  });

  it('ignores warnings and unparseable diagnostics without throwing', () => {
    const builds = [
      mk({ buildId: 'w', createdAt: '2026-09-01T10:00:00Z', errorCount: 0, diagnosticsJson: JSON.stringify([diag('C4996 deprecated', 3, 'warning', 'C4996')]) }),
      mk({ buildId: 'bad', createdAt: '2026-09-02T10:00:00Z', status: 'failed', errorCount: 2, diagnosticsJson: '{not json' }),
      mk({ buildId: 'obj', createdAt: '2026-09-03T10:00:00Z', status: 'failed', errorCount: 1, diagnosticsJson: '{"message":"not an array"}' }),
      mk({ buildId: 'junk', createdAt: '2026-09-04T10:00:00Z', status: 'failed', errorCount: 1, diagnosticsJson: '[null, 3, {"severity":"error"}]' }),
    ];
    expect(() => deriveRecurringErrors(builds)).not.toThrow();
    expect(deriveRecurringErrors(builds)).toEqual([]);
  });

  it('does not let an aborted build or a failed build with unparseable diagnostics resolve an error', () => {
    const base = editorSeries({ status: 'aborted' });
    expect(deriveRecurringErrors(base)[0].stillFailing).toBe(true);
    const unparsed = editorSeries({ status: 'failed', errorCount: 3, diagnosticsJson: '{not json' });
    expect(deriveRecurringErrors(unparsed)[0].stillFailing).toBe(true);
  });

  it('caps the list at the requested limit', () => {
    const builds = Array.from({ length: 12 }, (_, i) =>
      mk({
        buildId: `m${i}`,
        createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        status: 'failed',
        errorCount: 1,
        diagnosticsJson: JSON.stringify([diag(`'UThing${i}': undeclared identifier`, i)]),
      }),
    );
    expect(deriveRecurringErrors(builds)).toHaveLength(8);
    expect(deriveRecurringErrors(builds, 3)).toHaveLength(3);
  });
});

describe('laneLabel', () => {
  it('does not double the target type when the target name already carries it', () => {
    expect(laneLabel({ targetName: 'DidEditor', targetType: 'Editor', configuration: 'Development', platform: 'Win64' })).toBe('DidEditor Development Win64');
    expect(laneLabel({ targetName: 'Did', targetType: 'Game', configuration: 'Shipping', platform: 'Win64' })).toBe('Did Shipping Win64');
  });
});
