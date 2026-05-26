/**
 * `runtimeDeferred(testName, …)` (acceptance/deferred.ts) writes the reason
 * `live-UE runner not yet run: <testName>`. The runner recovers the test name
 * from there — keep this prefix in lockstep with that factory.
 */
const RUNTIME_PREFIX = 'live-UE runner not yet run:';

export function parseTestName(reason?: string): string | null {
  if (!reason) return null;
  const i = reason.indexOf(RUNTIME_PREFIX);
  if (i === -1) return null;
  const name = reason.slice(i + RUNTIME_PREFIX.length).trim();
  return name.length ? name : null;
}
