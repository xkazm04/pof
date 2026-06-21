/** The DOM marker the LayoutLab renders once the catalog shell is interactive. Its
 *  presence is what proves "the server under test is PoF" vs a stray dev server that
 *  happened to occupy the port. Single source of truth — gotoLab + global-setup share it. */
export const POF_READY_TESTID = 'harness-lab-ready';

/** Actionable failure when the lab marker never appears. Almost always a NON-PoF dev
 *  server squatting on the port (Playwright's reuseExistingServer grabbed it), which
 *  otherwise surfaces as N identical silent `harness-lab-ready` timeouts against the wrong
 *  app — the exact trap that made a whole walker run meaningless. */
export function pofNotDetectedMessage(baseURL: string, timeoutMs: number): string {
  return (
    `PoF lab not detected at ${baseURL} within ${timeoutMs}ms (no "${POF_READY_TESTID}" marker). ` +
    `Most likely a NON-PoF dev server is squatting on the port and Playwright reused it ` +
    `(reuseExistingServer) — stop that server, or re-run with PLAYWRIGHT_PORT set to a free port. ` +
    `Less commonly, the /layout lab failed to compile.`
  );
}
