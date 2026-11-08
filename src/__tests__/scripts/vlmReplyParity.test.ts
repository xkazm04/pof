// @vitest-environment node
/** One rule for the VLM reply protocol: the shared Python parser and parseGateReply must
 *  agree on every fixture, and both scripts must load the shared helper under `python -I`. */
import { describe, it, expect } from 'vitest';
import { parseGateReply } from '@/lib/visual-gen/input-gate';
import { pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

/** reply -> the score both parsers must read (null = no verdict). */
const FIXTURES: Array<[string, number | null]> = [
  ['SCORE=7; DEFECTS=x; VERDICT=y', 7],
  ['SCORE=0; DEFECTS=none; VERDICT=y', 0],
  ['SCORE=10; DEFECTS=none; VERDICT=y', 10],
  ['SCORE=7.5; DEFECTS=x; VERDICT=y', 7.5],
  ['SCORE=10.5; DEFECTS=x; VERDICT=y', null],
  ['SCORE=85; DEFECTS=none; VERDICT=great', null],
  ['SCORE=<0-10 integer>; DEFECTS=x; VERDICT=y', null],
  ['DEFECTS=x; VERDICT=no score given', null],
];

function pythonScores(): Array<number | null> {
  const helper = scriptPath('pof_vlm_reply.py');
  const code = [
    'import json, runpy, sys',
    `ns = runpy.run_path(${JSON.stringify(helper)})`,
    `replies = json.loads(sys.argv[1])`,
    'print(json.dumps([ns["parse_score"](ns["parse_fields"](r).get("SCORE")) for r in replies]))',
  ].join('\n');
  const r = runPy(['-c', code, JSON.stringify(FIXTURES.map((f) => f[0]))]);
  return JSON.parse(r.stdout.trim());
}

describe.skipIf(!pythonAvailable)('VLM reply protocol parity', () => {
  it('Python and TS read the same score from every fixture (0 disagreements)', () => {
    const py = pythonScores();
    const ts = FIXTURES.map(([reply]) => {
      const g = parseGateReply(reply);
      return g.ok ? (g.score ?? null) : null;
    });
    const disagreements = FIXTURES.filter((_, i) => py[i] !== ts[i]).map((f) => f[0]);
    expect(disagreements).toEqual([]);
    expect(py).toEqual(FIXTURES.map((f) => f[1]));
  });
});
