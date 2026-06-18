import { describe, it, expect } from 'vitest';
import { buildPythonExecCmd } from '@/lib/ue-launch/python';

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
