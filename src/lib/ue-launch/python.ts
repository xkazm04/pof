/**
 * Builds the `-ExecCmds` value for running Python in a launched UE editor —
 * encoding the rules proven the hard way in the ue58-mcp Phase-0 spike:
 *
 *  1. UE's `py` console command consumes the WHOLE rest of the line as one
 *     Python string. So you get ONE `py ` prefix, then plain Python with `;`
 *     between simple statements — never a second `py` (that's a SyntaxError).
 *  2. Use SINGLE quotes in the Python. Double quotes collide with UE's own
 *     `-ExecCmds="…"` quoting and truncate the value at the first inner `"`.
 *  3. `unreal` is importable; emit results as `unreal.log('KEY=' + value)` and
 *     read them back with `extractLogMarker` anchored on the `LogPython:` prefix
 *     (the abslog also echoes the raw command line, which contains your KEY=).
 *
 * NOTE: a bare `Quit` appended here will NOT exit a headless 5.8 editor (it
 * idles) — poll the abslog for your marker then kill the process, or launch with
 * `-game` (self-exits). See launch.ts.
 */
export function buildPythonExecCmd(statements: string[]): string {
  if (statements.length === 0) {
    throw new Error('buildPythonExecCmd: at least one Python statement is required');
  }
  for (const s of statements) {
    if (s.includes('"')) {
      throw new Error(
        `buildPythonExecCmd: double quotes break UE -ExecCmds parsing — use single quotes in: ${s}`,
      );
    }
  }
  return `py ${statements.join('; ')}`;
}
