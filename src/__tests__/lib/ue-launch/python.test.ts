import { describe, it, expect } from 'vitest';
import { buildPythonExecCmd, buildPythonExecFile } from '@/lib/ue-launch/python';

describe('buildPythonExecCmd', () => {
  it('prefixes a single `py` and semicolon-joins the statements', () => {
    // UE`s `py` console command takes the WHOLE rest of the line as one Python
    // string, so chaining multiple `py` prefixes is a SyntaxError — one prefix,
    // `;`-separated plain Python (proven in the Phase-0 spike).
    expect(buildPythonExecCmd(['import unreal', "unreal.log('hi')"]))
      .toBe("py import unreal; unreal.log('hi')");
  });

  it('handles a single statement', () => {
    expect(buildPythonExecCmd(["unreal.log('x')"])).toBe("py unreal.log('x')");
  });

  it('rejects double quotes — they collide with UE -ExecCmds="…" and truncate the value', () => {
    expect(() => buildPythonExecCmd(['unreal.log("x")'])).toThrow(/single quote/i);
  });

  it('rejects an empty statement list', () => {
    expect(() => buildPythonExecCmd([])).toThrow(/at least one/i);
  });
});

describe('buildPythonExecFile', () => {
  it('wraps a file path in a quote-safe exec one-liner (no inline-quoting hell)', () => {
    // The robust pattern for multi-statement Python: write a file, exec it via a
    // single-quoted one-liner. Avoids the -ExecCmds double-quote truncation that
    // cost several tries in the Phase 0/2 spikes.
    expect(buildPythonExecFile('C:/x/probe.py')).toBe("py exec(open('C:/x/probe.py').read())");
  });

  it('rejects a path containing a single quote (would break the wrapper)', () => {
    expect(() => buildPythonExecFile("C:/x'/probe.py")).toThrow(/single quote/i);
  });
});
