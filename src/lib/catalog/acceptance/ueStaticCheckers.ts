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
  if (typeof window !== 'undefined') {
    throw new Error('ueStaticCheckers: filesystem checks are server-only (called in the browser)');
  }
  if (!_fs || !_path) {
    // Indirected require — hidden from static bundler analysis so node:fs/node:path
    // never enter the client graph. Resolves to the CJS require in Next's Node runtime.
    const req = Function('return require')() as NodeRequire;
    _fs = req('node:fs');
    _path = req('node:path');
  }
  // Non-null: the block above always assigns both when either is unset.
  return { fs: _fs!, path: _path! };
}

/** A UE-static checker is parameterised, then takes the UE project root. */
export type UeChecker = (ueRoot: string | null) => AcceptanceResult;

export function resolveUeRoot(): string | null {
  const { fs } = serverModules();
  const env = process.env.POF_UE_ROOT;
  if (env && fs.existsSync(env)) return env;
  const fallback = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
  return fs.existsSync(fallback) ? fallback : null;
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  const { fs, path } = serverModules();
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

function filesContain(root: string, subdir: string, ext: string, needle: RegExp): boolean {
  const { fs, path } = serverModules();
  return walk(path.join(root, subdir), ext).some((f) => needle.test(fs.readFileSync(f, 'utf8')));
}

// Best-effort: matches the symbol anywhere in a .h (incl. comments/forward-decls). Adequate for an "exists in source" L2 gate, not a semantic guarantee.
/** L2: the C++ class/struct symbol is declared somewhere in Source/. */
export function cppSymbolExists(symbol: string, label: string): UeChecker {
  return (ueRoot) => {
    const { fs } = serverModules();
    if (!ueRoot || !fs.existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const found = filesContain(ueRoot, 'Source', '.h', new RegExp(`\\b${symbol}\\b`));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${symbol} declared in Source/` }
      : { label, tier: 'L2', status: 'deferred', detail: `${symbol} not in Source/`, reason: `${symbol} not found in UE Source — generate/commit C++ then re-check` };
  };
}

/** L2: a row name appears in a seed script under Content/Python. */
export function seedRowPresent(seedFile: string, rowName: string, label: string): UeChecker {
  return (ueRoot) => {
    const { fs, path } = serverModules();
    if (!ueRoot || !fs.existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const filePath = path.join(ueRoot, 'Content', 'Python', seedFile);
    const found = fs.existsSync(filePath) && new RegExp(`["']${rowName}["']`).test(fs.readFileSync(filePath, 'utf8'));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${rowName} seeded in ${seedFile}` }
      : { label, tier: 'L2', status: 'deferred', detail: `${rowName} not in ${seedFile}`, reason: `${rowName} not found in ${seedFile}` };
  };
}

/** Run a step's declared L2 static checks against the UE root (server/CLI-side). */
export function runStaticChecks(checks: UeChecker[], ueRoot: string | null): AcceptanceResult[] {
  return checks.map((c) => c(ueRoot));
}
