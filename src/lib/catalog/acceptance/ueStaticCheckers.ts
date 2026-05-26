import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AcceptanceResult } from './types';

/** A UE-static checker is parameterised, then takes the UE project root. */
export type UeChecker = (ueRoot: string | null) => AcceptanceResult;

export function resolveUeRoot(): string | null {
  const env = process.env.POF_UE_ROOT;
  if (env && existsSync(env)) return env;
  const fallback = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
  return existsSync(fallback) ? fallback : null;
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

function filesContain(root: string, subdir: string, ext: string, needle: RegExp): boolean {
  return walk(join(root, subdir), ext).some((f) => needle.test(readFileSync(f, 'utf8')));
}

// Best-effort: matches the symbol anywhere in a .h (incl. comments/forward-decls). Adequate for an "exists in source" L2 gate, not a semantic guarantee.
/** L2: the C++ class/struct symbol is declared somewhere in Source/. */
export function cppSymbolExists(symbol: string, label: string): UeChecker {
  return (ueRoot) => {
    if (!ueRoot || !existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const found = filesContain(ueRoot, 'Source', '.h', new RegExp(`\\b${symbol}\\b`));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${symbol} declared in Source/` }
      : { label, tier: 'L2', status: 'deferred', detail: `${symbol} not in Source/`, reason: `${symbol} not found in UE Source — generate/commit C++ then re-check` };
  };
}

/** L2: a row name appears in a seed script under Content/Python. */
export function seedRowPresent(seedFile: string, rowName: string, label: string): UeChecker {
  return (ueRoot) => {
    if (!ueRoot || !existsSync(ueRoot)) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const path = join(ueRoot, 'Content', 'Python', seedFile);
    const found = existsSync(path) && new RegExp(`["']${rowName}["']`).test(readFileSync(path, 'utf8'));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${rowName} seeded in ${seedFile}` }
      : { label, tier: 'L2', status: 'deferred', detail: `${rowName} not in ${seedFile}`, reason: `${rowName} not found in ${seedFile}` };
  };
}

/** Run a step's declared L2 static checks against the UE root (server/CLI-side). */
export function runStaticChecks(checks: UeChecker[], ueRoot: string | null): AcceptanceResult[] {
  return checks.map((c) => c(ueRoot));
}
