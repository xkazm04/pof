import type { AcceptanceResult } from './types';

/**
 * node:fs / node:path are SERVER-ONLY here.
 *
 * This module is transitively imported by client components: the lab shell
 * (`Baseline.tsx`) side-effect-imports the pipeline registry barrel so
 * `getCatalogPipeline()` resolves client-side, and every pipeline file imports
 * the `cppSymbolExists` / `seedRowPresent` builders below for its `staticChecks`.
 *
 * The builders only RUN server-side (the L3/L4 drain runner + the
 * pipeline-artifacts API routes). But a static `import ... from 'node:fs'` would
 * drag the Node module into the client bundle, and Next 16's Turbopack dev
 * bundler hard-rejects external Node modules in a client chunk:
 *   "the chunking context does not support external modules (request: node:fs)".
 *
 * So we resolve fs/path lazily through an indirected `require` the bundler
 * cannot statically follow, guarded so a stray client-side call fails loudly
 * instead of silently shipping Node code to the browser.
 */
type NodeFs = typeof import('node:fs');
type NodePath = typeof import('node:path');

let _fs: NodeFs | undefined;
let _path: NodePath | undefined;

function serverModules(): { fs: NodeFs; path: NodePath } {
  if (!_fs || !_path) {
    // Resolve fs/path at runtime, server-only, WITHOUT a static import (which would drag
    // node:fs into the client bundle — Turbopack rejects that). `process.getBuiltinModule`
    // is a synchronous builtin accessor (Node 20.16+/22.3+) that works in CJS *and* ESM,
    // so it also runs under vitest (incl. its jsdom env, which still executes on Node) —
    // unlike the old `typeof window` guard + indirected `require`, which threw in tests.
    const proc = (globalThis as {
      process?: { getBuiltinModule?: <T>(id: string) => T; versions?: { node?: string } };
    }).process;
    const getBuiltin = proc?.getBuiltinModule;
    if (typeof getBuiltin === 'function') {
      _fs = getBuiltin<NodeFs>('node:fs');
      _path = getBuiltin<NodePath>('node:path');
    } else if (proc?.versions?.node) {
      // Older Node server runtime (no getBuiltinModule): the CJS require, still kept out of
      // the client graph by the indirection.
      const req = Function('return require')() as NodeRequire;
      _fs = req('node:fs');
      _path = req('node:path');
    } else {
      // No Node runtime at all = a real browser bundle. Filesystem checks are server-only.
      throw new Error('ueStaticCheckers: filesystem checks are server-only (called in the browser)');
    }
  }
  // Non-null: a branch above always assigns both, or throws.
  return { fs: _fs!, path: _path! };
}

/** A UE-static checker is parameterised, then takes the UE project root. */
export type UeChecker = (ueRoot: string | null) => AcceptanceResult;

export function resolveUeRoot(): string | null {
  const { fs } = serverModules();
  const env = process.env.POF_UE_ROOT;
  if (env && fs.existsSync(env)) return env;
  // No per-user literal: the Unreal Launcher's default project folder under the CURRENT user's home.
  // Anywhere else, set POF_UE_ROOT (a null here is reported by the callers as "UE root not found").
  const { path } = serverModules();
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return null;
  const fallback = path.join(home, 'Documents', 'Unreal Projects', 'PoF');
  return fs.existsSync(fallback) ? fallback : null;
}

/** Whether a configured engine-project root exists on disk (server-only, same lazy fs as the checkers). */
export function ueRootExists(root: string): boolean {
  return serverModules().fs.existsSync(root);
}

/**
 * Collect files ending in `ext`. An entry that cannot be stat'd or listed (a dangling link, a locked
 * file, an Intermediate junction) is SKIPPED and recorded in `skipped` - one bad entry costs that entry,
 * never the sweep - and the caller says so in its reason.
 */
function walk(dir: string, ext: string, skipped: string[], out: string[] = []): string[] {
  const { fs, path } = serverModules();
  if (!fs.existsSync(dir)) return out;
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    skipped.push(dir);
    return out;
  }
  for (const name of names) {
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).isDirectory()) walk(p, ext, skipped, out);
      else if (name.endsWith(ext)) out.push(p);
    } catch {
      skipped.push(p);
    }
  }
  return out;
}

/** Read one file, or record it as skipped when it cannot be read. */
function readOrSkip(f: string, skipped: string[]): string | null {
  try {
    return serverModules().fs.readFileSync(f, 'utf8');
  } catch {
    skipped.push(f);
    return null;
  }
}

/** Header text keyed by walked dir + ext, alive only inside {@link withHeaderCorpus} (one sweep). */
let activeCorpus: Map<string, { text: string; skipped: string[] }> | null = null;

/**
 * Run `fn` with ONE shared read of each walked source tree: inside it, `cppSymbolExists` tests the
 * joined text instead of re-walking and re-reading every header per call. Scoped to the call (the
 * cache is dropped in `finally`), never module-lifetime, so an edited header is seen by the next sweep.
 */
export function withHeaderCorpus<T>(fn: () => T): T {
  if (activeCorpus) return fn();
  activeCorpus = new Map();
  try {
    return fn();
  } finally {
    activeCorpus = null;
  }
}

function filesContain(root: string, subdir: string, ext: string, needle: RegExp): { found: boolean; skipped: string[] } {
  const { path } = serverModules();
  const dir = path.join(root, subdir);
  if (activeCorpus) {
    const key = `${dir}|${ext}`;
    let entry = activeCorpus.get(key);
    if (entry === undefined) {
      const skipped: string[] = [];
      const text = walk(dir, ext, skipped).map((f) => readOrSkip(f, skipped) ?? '').join('\n');
      entry = { text, skipped };
      activeCorpus.set(key, entry);
    }
    return { found: needle.test(entry.text), skipped: entry.skipped };
  }
  const skipped: string[] = [];
  const found = walk(dir, ext, skipped).some((f) => {
    const text = readOrSkip(f, skipped);
    return text !== null && needle.test(text);
  });
  return { found, skipped };
}

/** A name matched LITERALLY: a metacharacter in a row/symbol name must neither throw nor act as a wildcard. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Best-effort: matches the symbol anywhere in a .h (incl. comments/forward-decls). Adequate for an "exists in source" L2 gate, not a semantic guarantee.
/** L2: the C++ class/struct symbol is declared somewhere in Source/. */
export function cppSymbolExists(symbol: string, label: string): UeChecker {
  return (ueRoot) => {
    const { fs } = serverModules();
    if (!ueRoot || !fs.existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const { found, skipped } = filesContain(ueRoot, 'Source', '.h', new RegExp(`\\b${escapeRegExp(symbol)}\\b`));
    const unreadable = skipped.length ? ` (${skipped.length} unreadable entr${skipped.length === 1 ? 'y' : 'ies'} under Source/ skipped, e.g. ${skipped[0]})` : '';
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${symbol} declared in Source/` }
      : { label, tier: 'L2', status: 'deferred', detail: `${symbol} not in Source/`, reason: `${symbol} not found in UE Source${unreadable} — generate/commit C++ then re-check` };
  };
}

/** L2: a row name appears in a seed script under Content/Python. */
export function seedRowPresent(seedFile: string, rowName: string, label: string): UeChecker {
  return (ueRoot) => {
    const { fs, path } = serverModules();
    if (!ueRoot || !fs.existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const filePath = path.join(ueRoot, 'Content', 'Python', seedFile);
    const found = fs.existsSync(filePath) && new RegExp(`["']${escapeRegExp(rowName)}["']`).test(fs.readFileSync(filePath, 'utf8'));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${rowName} seeded in ${seedFile}` }
      : { label, tier: 'L2', status: 'deferred', detail: `${rowName} not in ${seedFile}`, reason: `${rowName} not found in ${seedFile}` };
  };
}

/** Run a step's declared L2 static checks against the UE root (server/CLI-side). */
export function runStaticChecks(checks: UeChecker[], ueRoot: string | null): AcceptanceResult[] {
  return checks.map((c) => runChecker(c, ueRoot));
}

/**
 * One checker, contained: a throw (a filesystem fault, a bad pattern) becomes a DEFERRED result naming
 * the error, so it costs that check rather than aborting the whole sweep. Never a pass or a fail:
 * a check that could not run proves nothing either way.
 */
export function runChecker(check: UeChecker, ueRoot: string | null): AcceptanceResult {
  try {
    return check(ueRoot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { label: 'static check', tier: 'L2', status: 'deferred', detail: 'static check could not run', reason: `static check threw: ${msg}` };
  }
}
