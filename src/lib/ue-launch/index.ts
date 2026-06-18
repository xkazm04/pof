/**
 * src/lib/ue-launch — reusable, production-usable autonomous UE launcher.
 *
 * Lets PoF spawn a (headless, by default) UnrealEditor of a CHOSEN engine version
 * (env-overridable; defaults to 5.8 — the official-MCP engine) and read results
 * back from the abslog. Used by the ue58-mcp Phase-0 spike and reusable by the
 * harness / test-gate-runner for fully autonomous UE operation. Pure cores
 * (engines/args/parse) are unit-tested; `launchEditor` is the spawn seam.
 */
export { resolveEditorBinary, type ResolveEditorOptions, type EnvLike } from './engines';
export { buildLaunchArgs, type LaunchArgsOptions } from './args';
export { extractLogMarker } from './parse';
export { buildPythonExecCmd } from './python';
export { launchEditor, type LaunchEditorOptions, type LaunchEditorResult, type LaunchDeps } from './launch';
