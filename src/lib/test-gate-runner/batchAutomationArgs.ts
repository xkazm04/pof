/**
 * The pure, dependency-free half of batch automation: the one-boot
 * `UnrealEditor-Cmd` argument list. Split from `batchAutomation.ts` (which pulls
 * `node:fs` / `node:os`) so client-bundled prompt builders — the AI Testing
 * Sandbox's run prompt — can spell the exact same command without dragging Node
 * builtins into the browser graph. `batchAutomation.ts` re-exports it unchanged.
 */

/**
 * Args for `UnrealEditor-Cmd` to run MANY automation tests in ONE headless boot:
 * `Automation RunTests A+B+C;Quit`, with `-ReportOutputPath=<dir>` so a machine-readable
 * per-test report (`index.json`) is written, plus the same `-abslog` fallback the single
 * path uses. Pure (tested).
 */
export function buildBatchAutomationArgs(
  testNames: readonly string[],
  uproject: string,
  abslog: string,
  reportDir: string,
): string[] {
  const filter = testNames.join('+');
  return [
    uproject,
    `-ExecCmds=Automation RunTests ${filter};Quit`,
    '-unattended',
    '-nopause',
    '-nosplash',
    '-nullrhi',
    '-log',
    `-abslog=${abslog}`,
    `-ReportOutputPath=${reportDir}`,
  ];
}
