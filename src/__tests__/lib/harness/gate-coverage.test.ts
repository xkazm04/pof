/**
 * Gate verdict coverage — the reviewer's agenda at run end.
 *
 * A plan item inherits "verified" from whichever REQUIRED gates passed in its
 * area, which is right for the compile gate and silently wrong for everything
 * above it: an item whose requirement is perceptual gets certified by a type
 * check when the gate that could have judged it (ue-visual, ue-tests) was
 * advisory and never returned a verdict. So the run end prints, per gate, how
 * many verdicts it actually returned, and names any gate with none — the static
 * preflight excludes runtime-determined gates on purpose, so this is the only
 * place that absence can surface.
 */
import { describe, it, expect } from 'vitest';
import { tallyGateVerdicts, formatGateCoverageLines, type GateVerdictTally } from '@/lib/harness/orchestrator';
import type { VerificationGate } from '@/lib/harness/types';

const GATES: VerificationGate[] = [
  { name: 'ue-compile', type: 'ue-compile', required: true, command: 'build' },
  { name: 'ue-tests', type: 'ue-test', required: false },
  { name: 'ue-visual', type: 'ue-visual', required: false },
];

function report(gates: Array<{ gate: string; passed: boolean; unverifiable?: boolean }>) {
  return { gates: gates.map((g) => ({ ...g, output: '', durationMs: 0 })) };
}

describe('tallyGateVerdicts', () => {
  it('counts pass / fail / unverifiable per gate across reports', () => {
    const tally: Record<string, GateVerdictTally> = {};
    tallyGateVerdicts(tally, report([
      { gate: 'ue-compile', passed: true },
      { gate: 'ue-tests', passed: false, unverifiable: true },
      { gate: 'ue-visual', passed: false, unverifiable: true },
    ]));
    tallyGateVerdicts(tally, report([
      { gate: 'ue-compile', passed: false },
      { gate: 'ue-tests', passed: true },
      { gate: 'ue-visual', passed: false, unverifiable: true },
    ]));
    expect(tally).toEqual({
      'ue-compile': { pass: 1, fail: 1, unverifiable: 0 },
      'ue-tests': { pass: 1, fail: 0, unverifiable: 1 },
      'ue-visual': { pass: 0, fail: 0, unverifiable: 2 },
    });
  });
});

describe('formatGateCoverageLines', () => {
  it('names a gate that only ever answered unverifiable as returning NO verdict', () => {
    const tally: Record<string, GateVerdictTally> = {
      'ue-compile': { pass: 3, fail: 1, unverifiable: 0 },
      'ue-tests': { pass: 2, fail: 0, unverifiable: 1 },
      'ue-visual': { pass: 0, fail: 0, unverifiable: 4 },
    };
    const lines = formatGateCoverageLines(tally, GATES);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Gate coverage: ue-compile (required) — 3 pass / 1 fail');
    expect(lines[1]).toBe('Gate coverage: ue-tests (advisory) — 2 pass / 0 fail / 1 unverifiable');
    expect(lines[2]).toContain('ue-visual (advisory) returned NO verdict this run (4 unverifiable, 0 real verdicts)');
    expect(lines[2]).toContain('review those features by hand');
  });

  it('names a configured gate that never ran at all', () => {
    const lines = formatGateCoverageLines({ 'ue-compile': { pass: 1, fail: 0, unverifiable: 0 } }, GATES);
    expect(lines[1]).toContain('ue-tests (advisory) returned NO verdict this run (never ran)');
    expect(lines[2]).toContain('ue-visual (advisory) returned NO verdict this run (never ran)');
  });

  it('is derived from the configured gate list, so a gate absent from the tally cannot vanish', () => {
    const lines = formatGateCoverageLines({}, GATES);
    expect(lines.map((l) => /Gate coverage: ([\w-]+)/.exec(l)?.[1])).toEqual(['ue-compile', 'ue-tests', 'ue-visual']);
    expect(lines.every((l) => l.includes('NO verdict'))).toBe(true);
  });
});
